import { SITE } from './config.js';

let cache = null;

/** Load the resource catalogue once per page. Throws a friendly Error on failure. */
export async function loadCatalog() {
  if (cache) return cache;
  let response;
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
  cache = (data.resources ?? []).filter((r) => r && r.id && r.title);
  return cache;
}

export async function getResource(id) {
  const all = await loadCatalog();
  return all.find((r) => r.id === id) ?? null;
}
