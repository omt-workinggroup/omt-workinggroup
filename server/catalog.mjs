// HTTP handlers for the free-book aggregator:
//   GET  /api/catalog-extra        published imported books (what the library merges in), CDN-cached
//   GET  /api/sync                 the daily import (Vercel Cron, Authorization: Bearer CRON_SECRET)
//   POST /api/admin {action,args}  administrator dashboard (x-admin-key header)
//   GET  /api/file?id=&mode=       stream an approved PDF/EPUB for the reader or as a download
import { fail, json, createRateLimiter } from './http.mjs';
import { timingSafeEqual, createHash } from 'node:crypto';
import { createStore, createTrustedStore, runSync, probe } from './aggregator/pipeline.mjs';
import { USER_AGENT } from './aggregator/normalize.mjs';

// ---------- Published catalogue ----------
export function createCatalogExtraHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async () => {
    let rows = [];
    try {
      rows = await createStore({ env, fetchImpl })('catalog_published');
    } catch {
      return json(200, { ok: true, items: [] }, { 'Cache-Control': 'public, s-maxage=60' });
    }
    return json(200, { ok: true, items: rows ?? [] }, { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400' });
  };
}

// ---------- Scheduled import ----------
export function createSyncHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async (req) => {
    const secret = env.CRON_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return fail(401, 'unauthorized', 'Not allowed.');
    try {
      return json(200, await runSync({ env, fetchImpl, budgetMs: 240000 }));
    } catch (err) {
      console.error('sync failed', err.message);
      return fail(500, 'sync_failed', err.message);
    }
  };
}

// ---------- Administrator ----------
const ADMIN_ACTIONS = new Set(['overview', 'list', 'decide', 'edit', 'source', 'decisions']);
export function createAdminHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const limited = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 120 });
  const wrongKey = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
  return async (req, context = {}) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', { Allow: 'POST' });
    const ip = context.ip || 'unknown';
    if (limited(ip)) return fail(429, 'rate_limited', 'Too many requests. Try again in a few minutes.');
    const expected = env.ADMIN_KEY ?? '';
    if (expected.length < 12) return fail(503, 'not_configured', 'The admin dashboard is not set up yet (ADMIN_KEY).');
    const digest = (v) => createHash('sha256').update(v).digest();
    if (!timingSafeEqual(digest(req.headers.get('x-admin-key') ?? ''), digest(expected))) {
      if (wrongKey(ip)) return fail(429, 'rate_limited', 'Too many wrong keys. Try again later.');
      return fail(403, 'forbidden', 'That admin key is not right.');
    }
    let body;
    try { body = JSON.parse(await req.text()); } catch { return fail(400, 'invalid_json', 'Bad request.'); }
    const { action, args = {} } = body ?? {};
    try {
      const rpc = createTrustedStore({ env, fetchImpl });
      if (ADMIN_ACTIONS.has(action)) return json(200, { ok: true, data: await rpc('catalog_admin', { p_action: action, p_args: args }) });
      if (action === 'sync') {
        const only = Array.isArray(args.sources) ? args.sources.map(String).slice(0, 10) : null;
        return json(200, { ok: true, data: await runSync({ env, fetchImpl, only, budgetMs: 45000, pagesPerSource: 2, force: !!args.force }) });
      }
      if (action === 'probe') return json(200, { ok: true, data: await probe(String(args.source ?? ''), { fetchImpl }) });
      return fail(400, 'unknown_action', 'Unknown action.');
    } catch (err) {
      console.error('admin action failed', action, err.message);
      return fail(500, 'admin_failed', err.message);
    }
  };
}

// ---------- Files for the reader and downloads ----------
// Only these hosts are fetched (SSRF protection): the file servers of the connected sources.
const FILE_HOSTS = /^(downloads\.libretexts\.org|assets\.openstax\.org|openstax\.org|www\.gutenberg\.org|gutenberg\.org|standardebooks\.org|directory\.doabooks\.org|library\.oapen\.org|open\.umn\.edu)$/;
const MAX_BYTES = 80 * 1024 * 1024;
const MAGIC = { pdf: [0x25, 0x50, 0x44, 0x46], epub: [0x50, 0x4b, 0x03, 0x04] };

async function fetchAllowed(url, fetchImpl, hops = 4) {
  let current = url;
  for (let i = 0; i < hops; i++) {
    const u = new URL(current);
    if (u.protocol !== 'https:' || !FILE_HOSTS.test(u.hostname)) throw new Error(`host not allowed: ${u.hostname}`);
    const res = await fetchImpl(u, { redirect: 'manual', headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(25000) });
    if ([301, 302, 303, 307, 308].includes(res.status)) { current = new URL(res.headers.get('location'), u).href; continue; }
    return res;
  }
  throw new Error('too many redirects');
}

export function createFileHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const limited = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });
  return async (req, context = {}) => {
    const q = new URL(req.url).searchParams;
    const id = q.get('id') ?? '';
    const mode = q.get('mode') === 'download' ? 'download' : 'read';
    if (!/^[a-z0-9-]{3,120}$/.test(id)) return fail(400, 'invalid_request', 'Unknown book.');
    if (limited(context.ip || 'unknown')) return fail(429, 'rate_limited', 'Too many files at once. Try again in a few minutes.');
    let rpc;
    try { rpc = createTrustedStore({ env, fetchImpl }); } catch { return fail(503, 'not_configured', 'Files are not available yet.'); }
    const item = await rpc('catalog_file', { p_item_id: id }).catch(() => null);
    if (!item?.file_url) return fail(404, 'not_found', 'This book has no file OMT may share.');
    if (mode === 'download' ? !item.can_download : !item.can_read_on_omt) return fail(403, 'not_permitted', 'The licence for this book does not allow OMT to share the file. Open it on the original source instead.');
    let upstream;
    try { upstream = await fetchAllowed(item.file_url, fetchImpl); } catch (err) { return fail(502, 'source_failed', `The source is not available right now (${err.message}).`); }
    if (!upstream.ok || !upstream.body) return fail(502, 'source_failed', `The source returned ${upstream.status}.`);
    const size = Number(upstream.headers.get('content-length') ?? 0);
    if (size > MAX_BYTES) return fail(413, 'too_large', 'This file is too large to deliver through OMT. Open it on the original source.');

    // Check the first bytes really are a PDF or EPUB before passing anything on.
    const reader = upstream.body.getReader();
    const head = await reader.read();
    const firstBytes = head.value ?? new Uint8Array();
    const magic = MAGIC[item.file_format];
    const ok = !!magic && magic.every((b, i) => firstBytes[i] === b);
    rpc('catalog_file_checked', { p_item_id: id, p_bytes: size || null, p_sha256: null, p_ok: ok }).catch(() => {});
    if (!ok) { reader.cancel().catch(() => {}); return fail(502, 'bad_file', 'The source did not return a valid file. Open it on the original source.'); }
    rpc('catalog_track', { p_item_id: id, p_kind: mode }).catch(() => {});

    let sent = firstBytes.length;
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(firstBytes); },
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        sent += value.length;
        if (sent > MAX_BYTES) { controller.error(new Error('too large')); reader.cancel(); return; }
        controller.enqueue(value);
      },
      cancel() { reader.cancel().catch(() => {}); },
    });
    const name = `${item.title.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 80)}.${item.file_format}`;
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': item.file_format === 'pdf' ? 'application/pdf' : 'application/epub+zip',
        'Content-Disposition': `${mode === 'download' ? 'attachment' : 'inline'}; filename="${name}"`,
        ...(size ? { 'Content-Length': String(size) } : {}),
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
        'X-OMT-Licence': encodeURIComponent(item.licence_name ?? ''),
        'X-OMT-Source': item.source_url ?? '',
      },
    });
  };
}
