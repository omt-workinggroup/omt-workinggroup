// OMT AI — request handler. Served at /api/ai by api/ai.js (a Vercel Function).
//
//   GET  /api/ai  -> { configured: boolean }  (lets the page choose live or demo mode)
//   POST /api/ai  { messages, resourceId?, stream? }
//        The newest user message may carry attachments: [{ kind: "image"|"pdf", mediaType, data (base64), name }].
//        stream: true  -> application/x-ndjson, one JSON event per line:
//                         { type: "status", text }           (what OMT AI is doing: searching the web, …)
//                         { type: "delta", text }            (answer text as it is written)
//                         { type: "done", reply, resources, followups, links }
//                         { type: "error", error: { code, message } }
//        otherwise     -> { ok: true, mode: "live", reply, resources, followups, links }
//        errors before the answer starts are always plain JSON: { ok: false, error: { code, message } }
//
// The API key is read from the ANTHROPIC_API_KEY environment variable on the server.
// It never reaches the browser. See README.md, "Configure the AI assistant".

import Anthropic from '@anthropic-ai/sdk';
import catalogData from '../data/resources.json' with { type: 'json' };
import { searchCatalog } from '../js/core/search.js';
import { ACCESS, CATEGORIES } from '../js/core/taxonomy.js';
import { searchExternal } from './books.mjs';
import { saveAdditions } from './additions.mjs';
import { resourceIdFor } from '../js/core/external.js';
import { createRateLimiter, fail, json } from './http.mjs';

const MODEL = process.env.OMT_AI_MODEL || 'claude-opus-5-5';
const EFFORT = ['low', 'medium', 'high'].includes(process.env.OMT_AI_EFFORT) ? process.env.OMT_AI_EFFORT : 'low';
// Web search lets OMT AI answer questions about recent things. Set OMT_AI_WEB_SEARCH=off to disable it.
const WEB_SEARCH = process.env.OMT_AI_WEB_SEARCH !== 'off';
// Vercel Functions accept request bodies up to 4.5 MB; attachments must fit inside that.
const MAX_BODY_BYTES = 4_400_000;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 24_000;
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_CHARS = 4_000_000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: Number(process.env.OMT_AI_RATE_LIMIT) || 40 };
// The answer starts streaming only after the book search, so slow sources are dropped after this long.
const SEARCH_DEADLINE_MS = 2500;
const META_MARK = '<<meta';

const catalog = catalogData.resources;

const SYSTEM_PROMPT = `You are OMT AI, the assistant of the OMT WORKING GROUP website (Operations Maintenance and Training
Working Group). OMT is a free discovery platform for tech ebooks and learning resources: it brings together free and
official books, courses and standards, and searches Google Books, Open Library and Project Gutenberg, then sends readers
to the official source. OMT does not write or publish books.

You are a full general-purpose assistant, as capable as any modern AI chat app. Help with anything a thoughtful expert
could: explaining concepts at any level, coding and debugging in any language, maths, writing and editing, summarising,
planning, career and study advice, brainstorming, and everyday questions. Your home ground is tech (programming,
networking and subnetting, 4G/5G and telecom, Linux, cloud and DevOps, cybersecurity, data and AI, Microsoft Office,
design) and books, and you love pointing people to the right book, but never force a book into an answer that doesn't
need one.

Voice: a sharp, warm senior engineer. Natural and direct. Answer first, then add what helps. Match the length to the
question: a quick question gets a short answer; "explain", "teach me", "compare" or a hard problem gets a thorough,
well-structured one. If the request is ambiguous, give your best useful answer and ask one short clarifying question.
Don't open with filler ("Great question!") and don't end with a list of offers.

Formatting (rendered as Markdown in the chat):
- Use ## and ### headings for longer answers, **bold** for key terms, bullet and numbered lists, > for a key takeaway,
  tables (GitHub pipe syntax) for comparisons, and fenced code blocks with a language tag (\`\`\`python, \`\`\`bash, …).
- For maths, write clear plain text or Unicode (x², √, ≤, Σ); put longer derivations in a code block.

Illustrations. You can draw. When a picture explains better than words (architectures, flows, protocols, timelines,
hierarchies, comparisons, data, or when the user asks you to draw, sketch, illustrate or visualise something), include
one of these fenced blocks. Keep each one focused; at most three per answer.
1. \`\`\`mermaid for diagrams: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, mindmap,
   timeline, pie. Use simple node ids, quote labels that contain punctuation: A["Core (5GC)"]. No click handlers, no
   %%{init}%% directives, no HTML in labels. In sequenceDiagram write participant R as Recursive resolver (no quotes).
2. \`\`\`chart for data charts, as JSON only:
   {"type":"bar"|"line"|"pie"|"donut","title":"...","labels":["..."],"series":[{"name":"...","data":[1,2]}],"unit":"%"}
   Use real or clearly illustrative numbers and say which.
3. \`\`\`svg for drawings, icons, scenes, labelled sketches and visual explanations a diagram can't express: one
   complete <svg> with xmlns="http://www.w3.org/2000/svg" and a viewBox (about 640×400), a light background rect,
   readable labels (font-family sans-serif, size ≥ 13), a tasteful palette. No scripts, event handlers, external images,
   links or foreignObject. Keep it under 8 KB.
Write a sentence before or after an illustration saying what it shows. You cannot generate photographs; for a
photo-style request, draw an SVG illustration instead and say so.

Files: the user may attach images, PDFs or text files. Read them carefully and refer to what is actually in them.

Web: you may have a web_search tool. Use it for current events, prices, versions, release dates or anything after
your training, and cite what you found with Markdown links to the pages you used. Don't search for things you know,
and never narrate tool use ("Let me search…"): just search, then answer.

Books and the OMT library. Every user turn comes with a <search_results> block that the website builds from the OMT
catalogue (and, for book-related questions, from Google Books, Open Library and Project Gutenberg):
- Recommend books only when they help the user, and recommend specific titles only from <search_results>. Never invent
  a title, author, year, link or availability. External books you recommend are added to the OMT library.
- Link a result by its "link" field as [Title](link). Other links you may use: pages you found with web search,
  official documentation you are certain of (for example https://docs.python.org/3/, https://developer.mozilla.org/,
  https://kubernetes.io/docs/), and book searches https://openlibrary.org/search?q=WORDS or
  https://www.google.com/search?tbm=bks&q=WORDS (words joined with +).
- Site pages you can link: library.html?q=WORDS (search the library), office.html, presentations.html, favorites.html,
  about.html.
- Say how each recommended book can be read, using its access label. Credit the real author; OMT is never the author.
- Never provide or point to unauthorised copies of copyrighted books, and don't reproduce long passages of copyrighted
  text. For a copyrighted book give a short overview from well-known information and suggest legal ways to read it.

After your answer, on the very last line, write a metadata line in exactly this form:
<<meta {"recommended":["id",...],"followups":["...","..."]}>>
"recommended": ids from <search_results> you recommended, best first, at most 4 (empty list if none).
"followups": 2 or 3 short, specific next questions the user might tap, written as the user would ask them.`;

// ---------- helpers ----------
const rateLimited = createRateLimiter(RATE_LIMIT);

export function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object.';
  const { messages, resourceId } = body;
  if (!Array.isArray(messages) || messages.length === 0) return 'messages must be a non-empty array.';
  if (messages.length > MAX_MESSAGES) return `Send at most ${MAX_MESSAGES} messages.`;
  for (const [i, m] of messages.entries()) {
    if (!m || !['user', 'assistant'].includes(m.role)) return 'Each message needs a role of "user" or "assistant".';
    if (typeof m.content !== 'string' || !m.content.trim()) return 'Each message needs text content.';
    if (m.content.length > MAX_MESSAGE_CHARS) return `Messages must be ${MAX_MESSAGE_CHARS} characters or fewer.`;
    if (m.attachments !== undefined) {
      if (i !== messages.length - 1 || m.role !== 'user') return 'Only the newest message can carry attachments.';
      const problem = validateAttachments(m.attachments);
      if (problem) return problem;
    }
  }
  if (messages[messages.length - 1].role !== 'user') return 'The last message must be from the user.';
  if (resourceId !== undefined && resourceId !== null && !(typeof resourceId === 'string' && /^[a-z0-9-]{1,80}$/.test(resourceId))) {
    return 'resourceId is invalid.';
  }
  return null;
}

function validateAttachments(list) {
  if (!Array.isArray(list) || list.length > MAX_ATTACHMENTS) return `Attach at most ${MAX_ATTACHMENTS} files.`;
  let total = 0;
  for (const a of list) {
    if (!a || !['image', 'pdf'].includes(a.kind)) return 'Attachments must be images or PDFs.';
    if (a.kind === 'image' && !IMAGE_TYPES.includes(a.mediaType)) return 'Images must be JPEG, PNG, GIF or WebP.';
    if (a.kind === 'pdf' && a.mediaType !== 'application/pdf') return 'PDF attachments must be application/pdf.';
    if (typeof a.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(a.data)) return 'Attachment data must be base64.';
    total += a.data.length;
  }
  if (total > MAX_ATTACHMENT_CHARS) return 'Attachments are too large. Try a smaller file.';
  return null;
}

/** Content blocks for the newest user message: attachments first, then the text. */
function userContent(text, attachments) {
  if (!attachments?.length) return text;
  return [
    ...attachments.map((a) => a.kind === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data }, ...(a.name ? { title: String(a.name).slice(0, 120) } : {}) }
      : { type: 'image', source: { type: 'base64', media_type: a.mediaType, data: a.data } }),
    { type: 'text', text },
  ];
}

/** Messages must alternate user/assistant and start with the user. Merge or drop anything else. */
function toApiMessages(messages) {
  const out = [];
  for (const m of messages) {
    const content = m.content.trim();
    if (!out.length && m.role !== 'user') continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += `\n\n${content}`;
    else out.push({ role: m.role, content });
  }
  return out;
}

const catalogRecord = (r) => ({
  id: r.id,
  title: r.title,
  author: r.author,
  year: r.year,
  type: r.kind,
  category: CATEGORIES[r.category]?.label ?? r.category,
  level: r.level,
  access: ACCESS[r.accessType]?.label ?? 'Info only',
  source: r.sourceName,
  description: r.description,
  link: `resource.html?id=${r.id}`,
});

// Small talk needs no book search, which keeps those answers instant.
const SMALL_TALK = /^\s*(hi+|hello|hey|yo|thanks?|thank you|ok(ay)?|cool|nice|good (morning|afternoon|evening)|bye)\b[\s!.?]*$/i;
// The outside book search (up to 2.5 s) only runs when the question is about books or learning material.
const BOOKISH = /\b(e?books?|read(ing)?|novels?|authors?|pdfs?|textbooks?|library|publish\w*|editions?|courses?|guides?|resources?|recommend\w*|suggest\w*|learn(ing)?|study|tutorials?|beginners?|where (can|do) i (start|find))\b/i;
// Questions that deserve more thought get a higher effort level; everything else stays fast.
const HARD = /```|\b(debug|prove|proof|algorithm|optimi[sz]e|architecture|design (a|an|the)|step[- ]by[- ]step|derive|complexity|refactor|why does|calculate|solve)\b/i;

const searchCache = new Map();
async function cachedExternalSearch(q, fetchImpl) {
  const key = q.toLowerCase().trim();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.results;
  const { results, sources } = await searchExternal(q, { fetchImpl, max: 8, deadlineMs: SEARCH_DEADLINE_MS });
  // Cache only complete answers, so a slow source gets another chance next time.
  if (Object.values(sources).every((s) => s === 'ok')) {
    if (searchCache.size > 200) searchCache.clear();
    searchCache.set(key, { at: Date.now(), results });
  }
  return results;
}

/** Build the retrieval context for this turn: catalogue matches plus Google Books, Open Library and Gutenberg records. */
export async function buildContext({ messages, resourceId, fetchImpl = fetch }) {
  const question = messages[messages.length - 1].content;
  const selected = resourceId ? catalog.find((r) => r.id === resourceId) : null;
  // Search with the newest message; include the previous user turn so follow-ups keep their topic.
  const previous = [...messages].reverse().find((m, i) => i > 0 && m.role === 'user')?.content ?? '';
  let matches = searchCatalog(catalog, { q: question });
  if (matches.length < 3 && previous) matches = [...matches, ...searchCatalog(catalog, { q: previous })];
  if (selected) matches = [selected, ...searchCatalog(catalog, { q: selected.tags?.slice(0, 3).join(' ') ?? '' })];
  const unique = [...new Map(matches.map((r) => [r.id, r])).values()].slice(0, 8);

  let external = [];
  if (!SMALL_TALK.test(question) && (selected ? selected.accessType === 'paid' : BOOKISH.test(question))) {
    try { external = await cachedExternalSearch(selected ? selected.title : question, fetchImpl); } catch { external = []; }
  }
  const ACCESS_TEXT = { open: 'Free to read in full', official: 'Free to borrow with an Open Library account', preview: 'Free preview on Google Books', paid: 'In copyright: buy or borrow' };
  const SOURCE_TEXT = { googlebooks: 'Google Books', openlibrary: 'Open Library', gutenberg: 'Project Gutenberg' };
  const extRecords = external.map((d, i) => ({
    id: `ext-${i + 1}`, title: d.title, author: d.authors, year: d.year, source: SOURCE_TEXT[d.source] ?? d.source,
    access: ACCESS_TEXT[d.access], description: d.description?.slice(0, 300) || undefined, link: d.url,
  }));

  const block = {
    selected_resource: selected ? catalogRecord(selected) : null,
    omt_catalogue: unique.map(catalogRecord),
    external_books: extRecords,
  };
  return {
    text: `<search_results>\n${JSON.stringify(block)}\n</search_results>`,
    lookup: { catalogue: new Map(unique.map((r) => [r.id, r])), external: new Map(extRecords.map((r, i) => [r.id, external[i]])) },
    // Links the answer may contain; the page turns any other URL into plain text.
    links: [...unique.map((r) => `resource.html?id=${r.id}`), ...extRecords.map((r) => r.link).filter(Boolean)],
  };
}

/** Map the model's picks to cards. External picks are saved into the OMT library and link to their page there. */
async function toResourceCards(ids, lookup, { fetchImpl, env }) {
  const out = [];
  const externalPicks = [];
  for (const id of ids ?? []) {
    if (typeof id !== 'string' || out.length >= 4) continue;
    const r = lookup.catalogue.get(id);
    if (r) { out.push({ source: 'omt', id: r.id, title: r.title, author: r.author, accessType: r.accessType, url: `resource.html?id=${encodeURIComponent(r.id)}` }); continue; }
    const d = lookup.external.get(id);
    if (d) { externalPicks.push(d); out.push(d); }
  }
  const saved = externalPicks.length ? await saveAdditions(externalPicks, 'ai', { fetchImpl, env }) : false;
  return out.map((d) => (d.source === 'omt' ? d : {
    source: d.source, title: d.title, author: d.authors, year: d.year, accessType: d.access,
    url: saved ? `resource.html?id=${encodeURIComponent(resourceIdFor(d.extId))}` : d.url,
    addedToLibrary: saved,
  }));
}

/** Split the model's text into the visible answer and the trailing <<meta {...}>> line. */
export function splitMeta(text) {
  const at = text.lastIndexOf(META_MARK);
  if (at === -1) return { reply: text.trim(), meta: {} };
  const raw = text.slice(at + META_MARK.length).replace(/>>\s*$/, '').trim();
  let meta = {};
  try { meta = JSON.parse(raw); } catch { /* answer still shown without cards */ }
  return { reply: text.slice(0, at).trim(), meta: meta && typeof meta === 'object' ? meta : {} };
}

/** How much of the streamed text is safe to show: everything before the metadata line (or a partial "<<"). */
function visibleLength(text) {
  const at = text.indexOf(META_MARK);
  if (at !== -1) return at;
  for (let n = Math.min(META_MARK.length - 1, text.length); n > 0; n--) {
    if (META_MARK.startsWith(text.slice(-n))) return text.length - n;
  }
  return text.length;
}

const REFUSAL_REPLY = "I can't help with that request. I can help you find books and learning resources, or explain a tech topic you're learning.";

function providerError(err) {
  // Log the status/type only; never log message content or keys.
  console.error('AI provider error', err?.status ?? '', err?.name ?? '');
  if (err instanceof Anthropic.RateLimitError) return { status: 429, code: 'rate_limited', message: 'OMT AI is busy right now. Please try again in a minute.' };
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return { status: 503, code: 'not_configured', message: 'The AI assistant is not configured correctly.' };
  if (err instanceof Anthropic.APIConnectionTimeoutError) return { status: 504, code: 'timeout', message: 'OMT AI took too long to answer. Please try again.' };
  if (err instanceof Anthropic.APIError && err.status === 529) return { status: 503, code: 'overloaded', message: 'OMT AI is busy right now. Please try again shortly.' };
  return { status: 502, code: 'provider_error', message: 'OMT AI is having trouble right now. Please try again shortly.' };
}

// ---------- handler ----------
export function createHandler({ client, fetchImpl = fetch, env = process.env } = {}) {
  return async (req, context = {}) => {
    const apiKeyConfigured = Boolean(client || process.env.ANTHROPIC_API_KEY);
    if (req.method === 'GET') return json(200, { configured: apiKeyConfigured });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', { Allow: 'GET, POST' });
    if (!apiKeyConfigured) return fail(503, 'not_configured', 'The AI assistant is not configured on this server.');

    const ip = context.ip || 'unknown';
    if (rateLimited(ip)) return fail(429, 'rate_limited', 'You are sending messages too quickly. Please wait a few minutes and try again.', { 'Retry-After': '120' });

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'Your message is too long.');
    let body;
    try { body = JSON.parse(raw); } catch { return fail(400, 'invalid_json', 'The request could not be read.'); }
    const problem = validateBody(body);
    if (problem) return fail(400, 'invalid_request', problem);

    const messages = toApiMessages(body.messages);
    const question = messages[messages.length - 1].content;
    const { text: contextText, lookup, links } = await buildContext({ messages, resourceId: body.resourceId, fetchImpl });
    // Attach the search results (and any files) to the newest user message only.
    const attachments = body.messages[body.messages.length - 1].attachments;
    messages[messages.length - 1] = { role: 'user', content: userContent(`${contextText}\n\n${question}`, attachments) };
    const effort = EFFORT === 'low' && (HARD.test(question) || question.length > 1500) ? 'medium' : EFFORT;

    const anthropic = client ?? new Anthropic({ timeout: 120_000, maxRetries: 1 });
    let useTools = WEB_SEARCH && !client;
    const request = (msgs) => anthropic.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: msgs,
      output_config: { effort },
      ...(useTools ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }] } : {}),
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    let stream = null;

    /** Run the model, calling onText with each new piece of visible answer text and onStatus with progress notes. */
    const run = async (onText, onStatus = () => {}) => {
      let text = '';
      let shown = 0;
      // The first words are held back briefly, so "let me look that up" before a web search can be dropped.
      let released = false;
      const emit = () => {
        const end = visibleLength(text);
        if (end > shown) { onText(text.slice(shown, end)); shown = end; }
      };
      const cited = new Set();
      let msgs = messages;
      // pause_turn: the server paused a long web-search loop; send the turn back and it carries on.
      for (let round = 0; round < 3; round++) {
        stream = request(msgs);
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_start' && event.content_block?.type === 'server_tool_use') {
              onStatus('Searching the web…');
              if (!released) text = '';
              // Text after a search starts a new paragraph.
              else if (!/\n\s*$/.test(text)) text += '\n\n';
            }
            if (event.type !== 'content_block_delta') continue;
            if (event.delta?.type === 'citations_delta' && event.delta.citation?.url) cited.add(event.delta.citation.url);
            if (event.delta?.type !== 'text_delta') continue;
            text += event.delta.text;
            if (!released && (text.length >= 140 || text.includes('\n'))) released = true;
            if (released) emit();
          }
        } catch (err) {
          // An account without web search rejects the tool before any text: retry once without it.
          if (useTools && !text && err instanceof Anthropic.BadRequestError) { useTools = false; round--; continue; }
          throw err;
        }
        const final = await stream.finalMessage();
        released = true;
        emit();
        if (final.stop_reason === 'refusal') return { reply: REFUSAL_REPLY, resources: [], followups: [], links: [], refused: true };
        for (const block of final.content ?? []) {
          if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) for (const r of block.content) if (r?.url) cited.add(r.url);
          for (const c of block.citations ?? []) if (c?.url) cited.add(c.url);
        }
        if (final.stop_reason !== 'pause_turn') break;
        msgs = [...msgs, { role: 'assistant', content: final.content }];
      }
      const { reply, meta } = splitMeta(text);
      const followups = (Array.isArray(meta.followups) ? meta.followups : [])
        .filter((f) => typeof f === 'string' && f.trim()).slice(0, 3).map((f) => f.trim().slice(0, 120));
      const resources = await toResourceCards(Array.isArray(meta.recommended) ? meta.recommended : [], lookup, { fetchImpl, env });
      return { reply: reply.slice(0, 60000), resources, followups, links: [...links, ...[...cited].filter((u) => /^https:\/\//.test(u))] };
    };

    if (!body.stream) {
      try {
        const result = await run(() => {});
        return json(200, { ok: true, mode: 'live', ...result });
      } catch (err) {
        const e = providerError(err);
        return fail(e.status, e.code, e.message);
      }
    }

    const encoder = new TextEncoder();
    const body$ = new ReadableStream({
      async start(controller) {
        const send = (obj) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        try {
          const result = await run((piece) => send({ type: 'delta', text: piece }), (note) => send({ type: 'status', text: note }));
          send({ type: 'done', ...result });
        } catch (err) {
          const e = providerError(err);
          send({ type: 'error', error: { code: e.code, message: e.message } });
        }
        controller.close();
      },
      cancel() { stream?.abort?.(); },
    });
    return new Response(body$, {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
    });
  };
}
