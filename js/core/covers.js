// Real book covers. Catalogue books carry their own cover (assets/covers/, taken from the official
// source or Open Library and checked by hand). Other books are looked up on Open Library's free
// Covers API (https://openlibrary.org/dev/docs/api/covers) in the visitor's browser, cached for a
// week, and only used when the author matches, so a wrong cover is never shown. The drawn poster
// stays as the fallback.
import { storage } from './util.js';
import { normalize } from './search.js';

const CACHE_KEY = 'omt:covers';
const TTL = 7 * 24 * 60 * 60 * 1000;
const cache = storage.get(CACHE_KEY, {}) ?? {};
const pending = new Map();
let active = 0;
const queue = [];

function surname(author) {
  const first = String(author ?? '').replace(/\(.*?\)/g, '').split(/,| and | with /)[0].trim();
  const parts = normalize(first).split(' ').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function runQueued(task) {
  return new Promise((resolve, reject) => {
    const start = async () => {
      active++;
      try { resolve(await task()); } catch (err) { reject(err); } finally { active--; queue.shift()?.(); }
    };
    if (active < 3) start(); else queue.push(start);
  });
}

async function lookup(r) {
  const name = surname(r.author);
  if (!name || name === 'openstax') return null;
  const q = encodeURIComponent(`${r.title.replace(/,? \d+(st|nd|rd|th) Edition/i, '')} ${name}`);
  const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=title,author_name,cover_i&limit=5`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(String(res.status));
  const { docs = [] } = await res.json();
  const titleWord = normalize(r.title).split(' ').find((w) => w.length > 3) ?? '';
  const match = docs.find((d) => Number.isInteger(d.cover_i)
    && (d.author_name ?? []).some((a) => normalize(a).includes(name))
    && normalize(d.title).includes(titleWord));
  return match ? `https://covers.openlibrary.org/b/id/${match.cover_i}-M.jpg` : null;
}

export function coverFor(r) {
  if (r.cover && /^(https:\/\/|assets\/covers\/)/.test(r.cover)) return Promise.resolve(r.cover);
  if (r.noCover) return Promise.resolve(null); // checked by hand: no good cover exists, keep the drawn one
  const hit = cache[r.id];
  if (hit && Date.now() - hit.t < TTL) return Promise.resolve(hit.url);
  if (!pending.has(r.id)) {
    pending.set(r.id, runQueued(() => lookup(r)).then((url) => {
      cache[r.id] = { url, t: Date.now() };
      storage.set(CACHE_KEY, cache);
      return url;
    }).catch(() => {
      pending.delete(r.id); // offline or blocked: keep the drawn cover, try again on a later page
      return null;
    }));
  }
  return pending.get(r.id);
}

/** Find book covers under `root` that can show a real cover and swap the image in. */
export function hydrateCovers(root, resources) {
  const byId = new Map(resources.map((r) => [r.id, r]));
  root.querySelectorAll('.cover[data-book]:not(.has-photo)').forEach(async (el) => {
    const r = byId.get(el.dataset.book);
    if (!r) return;
    const url = await coverFor(r);
    if (!url || el.classList.contains('has-photo')) return;
    const img = new Image();
    img.className = 'cover__photo';
    img.alt = '';
    img.decoding = 'async';
    img.onload = () => {
      // Open Library returns a 1×1 placeholder for missing covers.
      if (img.naturalWidth > 10) { el.append(img); el.classList.add('has-photo'); }
    };
    img.src = url;
  });
}

/** Watch a container and hydrate covers whenever new cards are rendered into it. */
export function watchCovers(root, resources) {
  hydrateCovers(root, resources);
  new MutationObserver(() => hydrateCovers(root, resources)).observe(root, { childList: true, subtree: true });
}
