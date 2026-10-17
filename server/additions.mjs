// Books added to the OMT library from external catalogues, stored in Supabase (public.library_additions).
//   GET  /api/additions          -> approved additions (shown in the library)
//   POST /api/additions {extId}  -> a visitor suggestion, saved for approval
// The AI handler calls saveAdditions() directly for books it recommends; those are approved automatically.
import { fail, json, createRateLimiter, clientIp } from './http.mjs';
import { fetchExternal } from './books.mjs';

const config = (env) => ({ url: env.SUPABASE_URL?.replace(/\/$/, ''), key: env.SUPABASE_SECRET_KEY || env.SUPABASE_PUBLISHABLE_KEY });
const headers = (key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra });

function toRow(rec, addedBy) {
  return {
    ext_id: rec.extId, source: rec.source, title: rec.title, authors: rec.authors || null, year: rec.year || null,
    description: rec.description || null, subjects: rec.subjects ?? [], access: rec.access,
    url: rec.url, read_url: rec.readUrl || null, cover_url: rec.cover || null,
    added_by: addedBy, approved: addedBy === 'ai',
  };
}

/** Insert records, ignoring ones already in the library. Returns true when the request succeeded. */
export async function saveAdditions(records, addedBy, { fetchImpl = fetch, env = process.env } = {}) {
  const { url, key } = config(env);
  if (!url || !key || !records.length) return false;
  try {
    const res = await fetchImpl(`${url}/rest/v1/library_additions?on_conflict=ext_id`, {
      method: 'POST',
      headers: headers(key, { Prefer: 'resolution=ignore-duplicates,return=minimal' }),
      body: JSON.stringify(records.map((r) => toRow(r, addedBy))),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) console.error('library_additions insert failed', res.status);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listAdditions({ fetchImpl = fetch, env = process.env } = {}) {
  const { url, key } = config(env);
  if (!url || !key) return [];
  const res = await fetchImpl(`${url}/rest/v1/library_additions?approved=eq.true&select=ext_id,source,title,authors,year,description,subjects,access,url,read_url,cover_url,added_by,created_at&order=created_at.desc&limit=1000`, {
    headers: headers(key), signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

export function createAdditionsHandler({ fetchImpl = fetch, env = process.env } = {}) {
  const limited = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 });
  return async (req) => {
    if (req.method === 'GET') {
      try {
        const rows = await listAdditions({ fetchImpl, env });
        return json(200, { ok: true, additions: rows }, { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' });
      } catch {
        return json(200, { ok: true, additions: [] });
      }
    }
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use GET or POST.', { Allow: 'GET, POST' });
    if (!config(env).url) return fail(503, 'not_configured', 'Adding books is not available right now.');
    if (limited(clientIp(req))) return fail(429, 'rate_limited', 'You have suggested a lot of books already. Please try again later.');
    let body;
    try { body = JSON.parse((await req.text()).slice(0, 2000)); } catch { return fail(400, 'invalid_json', 'The request could not be read.'); }
    let rec;
    try { rec = await fetchExternal(body?.extId, { fetchImpl }); } catch { rec = null; }
    if (!rec) return fail(404, 'not_found', 'We could not find that book at its source.');
    const ok = await saveAdditions([rec], 'visitor', { fetchImpl, env });
    if (!ok) return fail(502, 'store_failed', 'The book could not be saved. Please try again.');
    return json(200, { ok: true, status: 'pending', message: 'Thanks! The book will appear in the library once it is approved.' });
  };
}
