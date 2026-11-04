// The import pipeline. Each run picks up every enabled source where it left off (the cursor is saved in
// Supabase after each batch, so runs are resumable and idempotent), fetches a page, normalises it,
// classifies it, checks rights, merges duplicates and saves the batch. Runs stop before the time budget.
import openstax from './connectors/openstax.mjs';
import libretexts from './connectors/libretexts.mjs';
import wikibooks from './connectors/wikibooks.mjs';
import gutenberg from './connectors/gutenberg.mjs';
import internetArchive from './connectors/internet-archive.mjs';
import standardEbooks from './connectors/standard-ebooks.mjs';
import doab from './connectors/doab.mjs';
import openTextbookLibrary from './connectors/open-textbook-library.mjs';
import { createHash } from 'node:crypto';
import { buildItem, dedupeKey } from './normalize.mjs';

export const CONNECTORS = Object.fromEntries([openstax, libretexts, wikibooks, gutenberg, internetArchive, standardEbooks, doab, openTextbookLibrary].map((c) => [c.id, c]));

const DAY = 24 * 60 * 60 * 1000;

export function createStore({ env = process.env, fetchImpl = fetch } = {}) {
  const url = env.SUPABASE_URL?.replace(/\/$/, '');
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  return async function rpc(name, args) {
    const res = await fetchImpl(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args ?? {}),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(res.status === 403 || /forbidden/.test(text) ? 'forbidden' : `database error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return text ? JSON.parse(text) : null;
  };
}

/**
 * Like createStore, but signs every call with this server's CATALOG_SYNC_TOKEN. On first use the database
 * learns the token's hash (it accepts that only while no token is registered), then the call is retried.
 */
export function createTrustedStore({ env = process.env, fetchImpl = fetch } = {}) {
  const rpc = createStore({ env, fetchImpl });
  const token = env.CATALOG_SYNC_TOKEN;
  if (!token || token.length < 24) throw new Error('CATALOG_SYNC_TOKEN must be set (at least 24 characters)');
  return async function call(name, args) {
    try {
      return await rpc(name, { p_token: token, ...args });
    } catch (err) {
      if (err.message !== 'forbidden') throw err;
      const registered = await rpc('catalog_bootstrap', { p_hash: createHash('sha256').update(token).digest('hex') }).catch(() => false);
      if (!registered) throw err; // a different token is registered: the request really is not allowed
      return rpc(name, { p_token: token, ...args });
    }
  };
}

/** Dedupe keys of the books already on the site (data/resources.json), so imports merge into them. */
async function staticKeys(siteUrl, fetchImpl) {
  try {
    const res = await fetchImpl(`${siteUrl}/data/resources.json`, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    return new Map((data.resources ?? []).map((r) => [dedupeKey({ title: r.title, authors: r.author, isbn: r.isbn ? [r.isbn] : [] }), r.id]));
  } catch {
    return new Map();
  }
}

/**
 * @param {object} o
 * @param {string[]} [o.only]   source ids to run (default: every enabled connector)
 * @param {number} [o.budgetMs] stop starting new batches after this long
 * @param {number} [o.pagesPerSource]
 * @param {boolean} [o.force]   ignore "up to date today"
 */
export async function runSync({ env = process.env, fetchImpl = fetch, only = null, budgetMs = 200000, pagesPerSource = 4, force = false, log = () => {} } = {}) {
  const rpc = createTrustedStore({ env, fetchImpl });
  const started = Date.now();
  const sources = (await rpc('catalog_sync_state', {}))
    .filter((s) => s.enabled && CONNECTORS[s.id] && (!only || only.includes(s.id)))
    .sort((a, b) => String(a.last_run_at ?? '').localeCompare(String(b.last_run_at ?? '')));

  const site = (env.SITE_URL || 'https://web.omt-workinggroup.com').replace(/\/$/, '');
  const known = await staticKeys(site, fetchImpl);
  for (const row of await rpc('catalog_sync_keys', {})) {
    if (row.dedupe_key && !row.merged_into && !known.has(row.dedupe_key)) known.set(row.dedupe_key, row.id);
  }

  const report = [];
  for (const s of sources) {
    const c = CONNECTORS[s.id];
    let cursor = s.cursor ?? {};
    if (cursor.done) {
      // A finished source starts again from the top once a day to pick up new and changed books.
      if (!force && Date.now() - Date.parse(cursor.at ?? 0) < DAY) { report.push({ source: s.id, status: 'up to date' }); continue; }
      cursor = {};
    }
    const r = { source: s.id, pages: 0, fetched: 0, saved: 0, published: 0, skipped: {}, status: 'ok' };
    for (let page = 0; page < pagesPerSource && Date.now() - started < budgetMs; page++) {
      try {
        const { records, cursor: next } = await c.next(cursor, { fetchImpl });
        const items = new Map();
        let skipped = 0;
        for (const raw of records) {
          const { item, skip } = buildItem(c.prefix, s.id, raw);
          if (!item) { skipped++; r.skipped[skip] = (r.skipped[skip] ?? 0) + 1; continue; }
          const owner = known.get(item.dedupe_key);
          if (owner && owner !== item.id) item.merged_into = owner;
          else known.set(item.dedupe_key, item.id);
          items.set(item.id, item);
        }
        const saved = await rpc('catalog_sync_save', { p_source: s.id, p_items: [...items.values()], p_cursor: next, p_error: null, p_fetched: records.length, p_skipped: skipped });
        r.pages++; r.fetched += records.length; r.saved += saved?.upserted ?? 0; r.published += saved?.published ?? 0;
        cursor = next;
        log(`${s.id}: page ${r.pages}, ${records.length} fetched, ${items.size} saved`);
        if (next?.done) break;
      } catch (err) {
        r.status = 'error'; r.error = String(err.message ?? err).slice(0, 300);
        await rpc('catalog_sync_save', { p_source: s.id, p_items: [], p_cursor: cursor, p_error: r.error, p_fetched: 0, p_skipped: 0 }).catch(() => {});
        log(`${s.id}: ${r.error}`);
        break;
      }
    }
    report.push(r);
    if (Date.now() - started >= budgetMs) break;
  }
  return { ok: true, ms: Date.now() - started, report };
}

/** Admin diagnostics: fetch one page from a connector without saving anything. */
export async function probe(sourceId, { fetchImpl = fetch } = {}) {
  const c = CONNECTORS[sourceId];
  if (!c) return { ok: false, error: 'No connector for this source (link only).' };
  const t = Date.now();
  try {
    const { records } = await c.next({}, { fetchImpl });
    const built = records.map((raw) => buildItem(c.prefix, sourceId, raw));
    return {
      ok: true, ms: Date.now() - t, fetched: records.length,
      importable: built.filter((b) => b.item).length,
      skipped: built.filter((b) => !b.item).reduce((m, b) => ({ ...m, [b.skip]: (m[b.skip] ?? 0) + 1 }), {}),
      sample: built.filter((b) => b.item).slice(0, 3).map(({ item }) => ({ title: item.title, licence: item.licence_name, state: item.rights_state, category: item.category, file: item.file_format })),
    };
  } catch (err) {
    return { ok: false, ms: Date.now() - t, error: String(err.message ?? err) };
  }
}
