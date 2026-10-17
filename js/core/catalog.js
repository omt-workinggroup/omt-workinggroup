import { SITE } from './config.js';
import { toResource } from './external.js';

let cache = null;

/** Books added from Google Books, Open Library and Gutenberg (by OMT AI or approved suggestions). */
async function loadAdditions() {
  try {
    const res = await fetch('/api/additions', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.additions ?? []).filter((a) => a?.ext_id && a.title && a.url).map(toResource);
  } catch {
    return []; // static hosting or offline: the core catalogue still works
  }
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
