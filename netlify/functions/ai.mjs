// OMT AI — serverless endpoint (Netlify Functions v2), served at /api/ai.
//
//   GET  /api/ai  -> { configured: boolean }  (lets the page choose live or demo mode)
//   POST /api/ai  -> { ok: true, mode: "live", reply, resources }
//                    { ok: false, error: { code, message } }
//
// The API key is read from the ANTHROPIC_API_KEY environment variable on the server.
// It never reaches the browser. See README.md, "Configure the AI assistant".

import Anthropic from '@anthropic-ai/sdk';
import catalogData from '../../data/resources.json' with { type: 'json' };
import { searchCatalog } from '../../js/core/search.js';
import { ACCESS, CATEGORIES } from '../../js/core/taxonomy.js';
import { normalizeOpenLibraryDoc } from '../../js/core/openlibrary.js';

const MODEL = process.env.OMT_AI_MODEL || 'claude-opus-5-5';
const EFFORT = ['low', 'medium', 'high'].includes(process.env.OMT_AI_EFFORT) ? process.env.OMT_AI_EFFORT : 'low';
const MAX_BODY_BYTES = 32_000;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: Number(process.env.OMT_AI_RATE_LIMIT) || 20 };

const catalog = catalogData.resources;

const SYSTEM_PROMPT = `You are OMT AI, the study assistant of OMT WORKING GROUP, a free digital library for students.
You help students (1) find books and learning resources, (2) understand what a resource is about,
(3) get an overview of a resource, and (4) understand difficult concepts such as Excel formulas,
Word and PowerPoint features, databases, programming basics and study techniques.

Each user turn comes with a <search_results> block that the website builds from its catalogue and from Open Library.
Base every recommendation on those results:
- Recommend only resources that appear in <search_results>, and refer to them by title. Never invent a title, author,
  publisher, year, link or availability. If nothing fits, say so and suggest better search words or a kind of
  resource to look for (for example an OpenStax textbook or a library loan).
- State how each recommended resource can be accessed using its access label: "On OMT" (original OMT content,
  free), "Free & open" (public domain or open licence), "Official source" (free on the provider's website),
  "Buy or borrow" (in copyright), or for Open Library records the label given.
- Never provide, reproduce or point to unauthorised copies of copyrighted books, and do not reproduce long passages
  of copyrighted text. For a copyrighted book, give a short, high-level overview based on widely known
  bibliographic information, say that you have not read the full text, and suggest legal ways to read it plus free
  alternatives from the results.
- When explaining or summarising a resource, use the metadata provided. If you add general knowledge, say so, and
  never claim to know specific chapter contents you were not given.
- When explaining a concept, use simple language, numbered steps, a small worked example (with a formula or code
  if relevant) and finish with one short practice exercise.

Style: friendly, clear and concise; most students read on a phone. Use short paragraphs, **bold** for key terms,
"- " bullet lists, "1. " numbered lists and \`code\` or fenced code blocks. Do not use headings, tables or HTML.

Answer with a JSON object that matches the schema: "reply" is your message to the student, and
"recommended" lists the ids (from <search_results>) of the resources you recommend, best first, at most 4.
Leave "recommended" empty when you are not recommending resources.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    recommended: { type: 'array', items: { type: 'string' } },
  },
  required: ['reply', 'recommended'],
  additionalProperties: false,
};

// ---------- helpers ----------
const json = (status, body, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
});
const fail = (status, code, message, headers) => json(status, { ok: false, error: { code, message } }, headers);

const hits = new Map();
function rateLimited(key) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (recent.length >= RATE_LIMIT.max) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded on long-lived instances
  return false;
}

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
  formats: r.formats,
  access: ACCESS[r.accessType]?.label ?? 'Info only',
  license: r.license,
  description: r.description,
  tags: r.tags,
});

async function openLibrary(query, fetchImpl) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query.slice(0, 200))}&limit=5&fields=key,title,author_name,first_publish_year,cover_i,ebook_access`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { 'User-Agent': 'OMT-WORKING-GROUP/1.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs ?? []).map(normalizeOpenLibraryDoc).filter((d) => d.url);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Build the retrieval context for this turn: catalogue matches plus Open Library records. */
export async function buildContext({ messages, resourceId, fetchImpl = fetch }) {
  const question = messages[messages.length - 1].content;
  const selected = resourceId ? catalog.find((r) => r.id === resourceId) : null;
  // Search with the newest message; include the previous user turn so follow-ups keep their topic.
  const previous = [...messages].reverse().find((m, i) => i > 0 && m.role === 'user')?.content ?? '';
  let matches = searchCatalog(catalog, { q: question });
  if (matches.length < 3 && previous) matches = [...matches, ...searchCatalog(catalog, { q: previous })];
  if (selected) matches = [selected, ...searchCatalog(catalog, { q: selected.tags?.slice(0, 3).join(' ') ?? '' })];
  const unique = [...new Map(matches.map((r) => [r.id, r])).values()].slice(0, 8);

  const external = selected && selected.accessType !== 'paid' ? [] : await openLibrary(selected ? selected.title : question, fetchImpl);
  const olRecords = external.map((d, i) => ({ id: `ol-${i + 1}`, title: d.title, author: d.author, year: d.year, source: 'Open Library', access: d.access === 'public' ? 'Free to read on Open Library' : d.access === 'borrowable' ? 'Borrow free with an Open Library account' : 'Catalogue record only (no free ebook)', url: d.url }));

  const block = {
    selected_resource: selected ? catalogRecord(selected) : null,
    omt_catalogue: unique.map(catalogRecord),
    open_library: olRecords,
  };
  return {
    text: `<search_results>\n${JSON.stringify(block)}\n</search_results>`,
    lookup: { catalogue: new Map(unique.map((r) => [r.id, r])), external: new Map(olRecords.map((r, i) => [r.id, external[i]])) },
  };
}

function toResourceCards(ids, lookup) {
  const out = [];
  for (const id of ids ?? []) {
    if (typeof id !== 'string' || out.length >= 4) continue;
    const r = lookup.catalogue.get(id);
    if (r) { out.push({ source: 'omt', id: r.id, title: r.title, author: r.author, accessType: r.accessType, url: `resource.html?id=${encodeURIComponent(r.id)}` }); continue; }
    const d = lookup.external.get(id);
    if (d && /^https:\/\/openlibrary\.org\/works\//.test(d.url)) out.push({ source: 'openlibrary', title: d.title, author: d.author, year: d.year, access: d.access, url: d.url });
  }
  return out;
}

// ---------- handler ----------
export function createHandler({ client, fetchImpl = fetch } = {}) {
  return async (req, context = {}) => {
    const apiKeyConfigured = Boolean(client || process.env.ANTHROPIC_API_KEY);
    if (req.method === 'GET') return json(200, { configured: apiKeyConfigured });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', { Allow: 'GET, POST' });
    if (!apiKeyConfigured) return fail(503, 'not_configured', 'The AI assistant is not configured on this server.');

    const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
    if (rateLimited(ip)) return fail(429, 'rate_limited', 'You are sending messages too quickly. Please wait a few minutes and try again.', { 'Retry-After': '120' });

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'Your message is too long.');
    let body;
    try { body = JSON.parse(raw); } catch { return fail(400, 'invalid_json', 'The request could not be read.'); }
    const problem = validateBody(body);
    if (problem) return fail(400, 'invalid_request', problem);

    const messages = toApiMessages(body.messages);
    const { text: contextText, lookup } = await buildContext({ messages, resourceId: body.resourceId, fetchImpl });
    // Attach the search results to the newest user message only.
    messages[messages.length - 1] = { role: 'user', content: `${contextText}\n\n${messages[messages.length - 1].content}` };

    const anthropic = client ?? new Anthropic({ timeout: 24_000, maxRetries: 1 });
    try {
      const response = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages,
        output_config: { effort: EFFORT, format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });

      if (response.stop_reason === 'refusal') {
        return json(200, { ok: true, mode: 'live', reply: "I can't help with that request. I can help you find books and learning resources, or explain a topic you're studying.", resources: [] });
      }
      const textBlock = response.content.find((b) => b.type === 'text');
      let parsed = null;
      try { parsed = JSON.parse(textBlock?.text ?? ''); } catch { /* handled below */ }
      if (!parsed || typeof parsed.reply !== 'string') {
        return fail(502, 'bad_response', 'The AI returned an unexpected answer. Please try again.');
      }
      return json(200, { ok: true, mode: 'live', reply: parsed.reply.slice(0, 8000), resources: toResourceCards(parsed.recommended, lookup) });
    } catch (err) {
      // Log the status/type only; never log message content or keys.
      console.error('AI provider error', err?.status ?? '', err?.name ?? '');
      if (err instanceof Anthropic.RateLimitError) return fail(429, 'rate_limited', 'OMT AI is busy right now. Please try again in a minute.', { 'Retry-After': '60' });
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return fail(503, 'not_configured', 'The AI assistant is not configured correctly.');
      if (err instanceof Anthropic.APIConnectionTimeoutError) return fail(504, 'timeout', 'OMT AI took too long to answer. Please try again.');
      if (err instanceof Anthropic.APIError && err.status === 529) return fail(503, 'overloaded', 'OMT AI is busy right now. Please try again shortly.');
      return fail(502, 'provider_error', 'OMT AI is having trouble right now. Please try again shortly.');
    }
  };
}

export default createHandler();

export const config = { path: '/api/ai' };
