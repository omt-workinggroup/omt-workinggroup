import { SITE } from './config.js';
import { toResource } from './external.js';

let cache = null;

const ADDITIONS_KEY = 'omt:additions';

/** Books added from Google Books, Open Library and Gutenberg (by OMT AI or approved suggestions). */
async function fetchAdditions() {
  try {
    const res = await fetch('/api/additions', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = data.additions ?? [];
    try { sessionStorage.setItem(ADDITIONS_KEY, JSON.stringify({ at: Date.now(), rows })); } catch { /* storage blocked */ }
    return rows;
  } catch {
    return null; // static hosting or offline: the core catalogue still works
  }
}

/** Use this tab's copy when it is fresh; never hold the page up for long waiting on the network. */
async function loadAdditions() {
  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(ADDITIONS_KEY) ?? 'null'); } catch { /* storage blocked */ }
  let rows = cached && Date.now() - cached.at < 5 * 60 * 1000 ? cached.rows : null;
  if (!rows) {
    const fresh = fetchAdditions();
    rows = await Promise.race([fresh, new Promise((resolve) => setTimeout(() => resolve(null), 1500))]) ?? cached?.rows ?? [];
  }
  return rows.filter((a) => a?.ext_id && a.title && a.url).map(toResource);
}

/** Load the resource catalogue once per page. Throws a friendly Error on failure. */
export async function loadCatalog() {
  if (cache) return cache;
  let response;
  const additions = loadAdditions();
  try {
    response = await fetch(SITE.catalogUrl, { headers: { Accept: 'application/json' } });
  } catch {
    const fileHint = location.protocol === 'file:'
      ? ' The site must be served by a web server (see README: "Run locally").'
      : ' Check your internet connection and try again.';
    throw new Error('We couldn\'t load the library.' + fileHint);
  }
  if (!response.ok) throw new Error('We couldn\'t load the library right now. Please try again in a moment.');
  const data = await response.json();
  const core = (data.resources ?? []).filter((r) => r && r.id && r.title);
  const ids = new Set(core.map((r) => r.id));
  cache = [...core, ...(await additions).filter((r) => !ids.has(r.id))];
  return cache;
}

export async function getResource(id) {
  const all = await loadCatalog();
  return all.find((r) => r.id === id) ?? null;
}

/** Search Google Books, Open Library and Project Gutenberg through /api/books. */
export async function searchExternalBooks(q, { signal } = {}) {
  const res = await fetch(`/api/books?q=${encodeURIComponent(q)}`, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  return data.results ?? [];
}

/** Suggest an external book for the OMT library. */
export async function suggestBook(extId) {
  const res = await fetch('/api/additions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ extId }) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message ?? 'The book could not be added. Please try again.');
  return data;
}
