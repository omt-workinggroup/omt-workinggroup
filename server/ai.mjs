// OMT AI — request handler. Served at /api/ai by api/ai.js (a Vercel Function).
//
//   GET  /api/ai  -> { configured: boolean }  (lets the page choose live or demo mode)
//   POST /api/ai  { messages, resourceId?, stream? }
//        stream: true  -> application/x-ndjson, one JSON event per line:
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
const MAX_BODY_BYTES = 32_000;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: Number(process.env.OMT_AI_RATE_LIMIT) || 20 };
// The answer starts streaming only after the book search, so slow sources are dropped after this long.
const SEARCH_DEADLINE_MS = 2500;
const META_MARK = '<<meta';

const catalog = catalogData.resources;

const SYSTEM_PROMPT = `You are OMT AI, the assistant inside the OMT WORKING GROUP website (Operations Maintenance and Training
Working Group). OMT is a free discovery platform for IT lovers: developers, network and telecom engineers, sysadmins,
cloud, security and data people, and students. OMT does not write or publish books. It brings together free and official
tech resources and searches millions of books on Google Books, Open Library and Project Gutenberg, then sends readers to
the official source to read, borrow or buy.

Talk like a sharp, friendly senior engineer who loves books: natural, direct and warm. Answer the question first, then
add what helps. You can:
- recommend books and learning resources, compare them, and suggest a reading order or learning path;
- explain what a book or resource covers, who it suits and what to read before or after it;
- answer questions about books in general: authors, editions, which book fits a goal, free vs paid options;
- teach difficult concepts (programming, networking and subnetting, 4G/5G and telecom, Linux, cloud and DevOps,
  cybersecurity, data and AI, Microsoft Office) with simple language, a small worked example and, when useful, code;
- ask the user a short clarifying question when their goal or level is unclear (for example "Are you new to Linux, or
  preparing for an exam?"). Ask at most one question, and still give a useful first answer.

Every user turn comes with a <search_results> block that the website builds from the OMT catalogue and from Google Books,
Open Library and Project Gutenberg. Ground everything about specific books in it:
- Recommend only resources that appear in <search_results>. Never invent a title, author, publisher, year, link or
  availability. External books you recommend are added to the OMT library automatically.
- Link a resource by its "link" field, as a Markdown link: [Title](link). Use no other URLs, except these search links
  when the results don't have what the user needs: https://openlibrary.org/search?q=WORDS and
  https://www.google.com/search?tbm=bks&q=WORDS (words joined with +).
- Point to the website's own pages when they help: library.html?q=WORDS (search the library), office.html (Microsoft
  Office center), presentations.html (presentation skills), favorites.html (saved books), about.html.
- Say how each recommended resource can be read, using its access label.
- OMT is never the author. Credit the real author and source.
- Never provide or point to unauthorised copies of copyrighted books, and do not reproduce long passages of copyrighted
  text. For a copyrighted book give a short overview from well-known information, say you haven't read the full text,
  and suggest legal ways to read it.
- Never claim to know chapter contents you were not given.

Style: most readers are on a phone. Keep answers tight: short paragraphs, **bold** key terms, "- " bullets, "1. " steps,
\`code\` and fenced code blocks. No headings, tables or HTML. Don't open with filler like "Great question".

After your answer, on the very last line, write a metadata line in exactly this form:
<<meta {"recommended":["id",...],"followups":["...","..."]}>>
"recommended": ids from <search_results> you recommended, best first, at most 4 (empty list if none).
"followups": 2 or 3 short next questions the user might tap, written as the user would ask them.`;

// ---------- helpers ----------
const rateLimited = createRateLimiter(RATE_LIMIT);

export function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object.';
  const { messages, resourceId } = body;
  if (!Array.isArray(messages) || messages.length === 0) return 'messages must be a non-empty array.';
  if (messages.length > MAX_MESSAGES) return `Send at most ${MAX_MESSAGES} messages.`;
  for (const m of messages) {
    if (!m || !['user', 'assistant'].includes(m.role)) return 'Each message needs a role of "user" or "assistant".';
    if (typeof m.content !== 'string' || !m.content.trim()) return 'Each message needs text content.';
    if (m.content.length > MAX_MESSAGE_CHARS) return `Messages must be ${MAX_MESSAGE_CHARS} characters or fewer.`;
  }
  if (messages[messages.length - 1].role !== 'user') return 'The last message must be from the user.';
  if (resourceId !== undefined && resourceId !== null && !(typeof resourceId === 'string' && /^[a-z0-9-]{1,80}$/.test(resourceId))) {
    return 'resourceId is invalid.';
  }
  return null;
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
  if (!SMALL_TALK.test(question) && (!selected || selected.accessType === 'paid')) {
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
    const { text: contextText, lookup, links } = await buildContext({ messages, resourceId: body.resourceId, fetchImpl });
    // Attach the search results to the newest user message only.
    messages[messages.length - 1] = { role: 'user', content: `${contextText}\n\n${messages[messages.length - 1].content}` };

    const anthropic = client ?? new Anthropic({ timeout: 45_000, maxRetries: 1 });
    const stream = anthropic.beta.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages,
      output_config: { effort: EFFORT },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    /** Run the model, calling onText with each new piece of visible answer text. */
    const run = async (onText) => {
      let text = '';
      let shown = 0;
      for await (const event of stream) {
        if (event.type !== 'content_block_delta' || event.delta?.type !== 'text_delta') continue;
        text += event.delta.text;
        const end = visibleLength(text);
        if (end > shown) { onText(text.slice(shown, end)); shown = end; }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') return { reply: REFUSAL_REPLY, resources: [], followups: [], links: [], refused: true };
      const { reply, meta } = splitMeta(text);
      const followups = (Array.isArray(meta.followups) ? meta.followups : [])
        .filter((f) => typeof f === 'string' && f.trim()).slice(0, 3).map((f) => f.trim().slice(0, 120));
      const resources = await toResourceCards(Array.isArray(meta.recommended) ? meta.recommended : [], lookup, { fetchImpl, env });
      return { reply: reply.slice(0, 12000), resources, followups, links };
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
          const result = await run((piece) => send({ type: 'delta', text: piece }));
          send({ type: 'done', ...result });
        } catch (err) {
          const e = providerError(err);
          send({ type: 'error', error: { code: e.code, message: e.message } });
        }
        controller.close();
      },
      cancel() { stream.abort?.(); },
    });
    return new Response(body$, {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
    });
  };
}
