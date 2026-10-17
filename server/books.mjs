// Search external book catalogues server-side:
//   Open Library  (no key)            https://openlibrary.org/developers/api
//   Google Books  (optional API key)  https://developers.google.com/books
//   Project Gutenberg via Gutendex    https://gutendex.com (public-domain full texts)
// Every record is normalised to the same shape and only links to the official source.
import { fail, json, createRateLimiter, clientIp } from './http.mjs';

const TIMEOUT = 6000;
const clean = (s, max) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const https = (u) => (typeof u === 'string' ? u.replace(/^http:\/\//, 'https://') : null);

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { Accept: 'application/json', 'User-Agent': 'OMT-WORKING-GROUP/1.0 (library search)' } });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

// ---------- Open Library ----------
function fromOpenLibrary(doc) {
  if (typeof doc.key !== 'string' || !/^\/works\/OL\d+W$/.test(doc.key)) return null;
  const id = doc.key.split('/').pop();
  const ebook = doc.ebook_access;
  return {
    extId: `ol:${id}`, source: 'openlibrary',
    title: clean(doc.title, 300), authors: clean((doc.author_name ?? []).slice(0, 3).join(', '), 300),
    year: doc.first_publish_year ? String(doc.first_publish_year) : '',
    description: '', subjects: (doc.subject ?? []).slice(0, 8).map((s) => clean(s, 60)),
    access: ebook === 'public' ? 'open' : ebook === 'borrowable' ? 'official' : 'paid',
    url: `https://openlibrary.org/works/${id}`,
    readUrl: ebook === 'public' || ebook === 'borrowable' ? `https://openlibrary.org/works/${id}` : null,
    cover: Number.isInteger(doc.cover_i) ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
  };
}

export async function searchOpenLibrary(q, { fetchImpl = fetch, limit = 6 } = {}) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,ebook_access,subject`;
  const data = await getJson(fetchImpl, url);
  return (data.docs ?? []).map(fromOpenLibrary).filter(Boolean);
}

// ---------- Google Books ----------
function fromGoogle(item) {
  const v = item.volumeInfo ?? {};
  const a = item.accessInfo ?? {};
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(item.id ?? '') || !v.title) return null;
  const full = a.publicDomain || a.viewability === 'ALL_PAGES';
  const partial = a.viewability === 'PARTIAL';
  return {
    extId: `gb:${item.id}`, source: 'googlebooks',
    title: clean(v.subtitle ? `${v.title}: ${v.subtitle}` : v.title, 300), authors: clean((v.authors ?? []).slice(0, 3).join(', '), 300),
    year: clean(v.publishedDate, 4), description: clean(v.description, 1200),
    subjects: (v.categories ?? []).slice(0, 6).map((s) => clean(s, 60)),
    access: full ? 'open' : partial ? 'preview' : 'paid',
    url: `https://books.google.com/books?id=${item.id}`,
    readUrl: full || partial ? `https://books.google.com/books?id=${item.id}&printsec=frontcover` : null,
    cover: https(v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail) || null,
  };
}

export async function searchGoogleBooks(q, { fetchImpl = fetch, key = process.env.GOOGLE_BOOKS_API_KEY, limit = 6 } = {}) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${limit}&printType=books${key ? `&key=${encodeURIComponent(key)}` : ''}`;
  const data = await getJson(fetchImpl, url);
  return (data.items ?? []).map(fromGoogle).filter(Boolean);
}

// ---------- Project Gutenberg (Gutendex) ----------
function fromGutenberg(b) {
  if (!Number.isInteger(b.id) || !b.title) return null;
  const html = Object.entries(b.formats ?? {}).find(([type]) => type.startsWith('text/html'))?.[1];
  const cover = b.formats?.['image/jpeg'];
  return {
    extId: `pg:${b.id}`, source: 'gutenberg',
    title: clean(b.title, 300), authors: clean((b.authors ?? []).map((a) => a.name).slice(0, 3).join('; '), 300),
    year: '', description: clean((b.summaries ?? [])[0], 1200),
    subjects: [...(b.bookshelves ?? []), ...(b.subjects ?? [])].slice(0, 8).map((s) => clean(s.replace(/^Browsing: /, ''), 60)),
    access: 'open',
    url: `https://www.gutenberg.org/ebooks/${b.id}`,
    readUrl: html && /^https:\/\/www\.gutenberg\.org\//.test(html) ? html : `https://www.gutenberg.org/ebooks/${b.id}`,
    cover: cover && /^https:\/\/www\.gutenberg\.org\//.test(cover) ? cover : null,
  };
}

export async function searchGutenberg(q, { fetchImpl = fetch, limit = 5 } = {}) {
  const data = await getJson(fetchImpl, `https://gutendex.com/books/?search=${encodeURIComponent(q)}`);
  return (data.results ?? []).slice(0, limit).map(fromGutenberg).filter(Boolean);
}

// ---------- Combined search ----------
const dedupeKey = (r) => `${r.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)}|${r.authors.toLowerCase().split(/[,;]/)[0].replace(/[^a-z]/g, '')}`;

/** Search all three sources in parallel; one failing source never breaks the others. */
export async function searchExternal(q, opts = {}) {
  const query = String(q ?? '').trim().slice(0, 200);
  if (!query) return { results: [], sources: {} };
  const runs = { googlebooks: searchGoogleBooks, openlibrary: searchOpenLibrary, gutenberg: searchGutenberg };
  const settled = await Promise.allSettled(Object.values(runs).map((fn) => fn(query, opts)));
  const lists = settled.map((s) => (s.status === 'fulfilled' ? s.value : []));
  const sources = Object.fromEntries(Object.keys(runs).map((k, i) => [k, settled[i].status === 'fulfilled' ? 'ok' : 'unavailable']));
  // Interleave sources so the first results show variety, then de-duplicate.
  const merged = [];
  for (let i = 0; i < Math.max(...lists.map((l) => l.length), 0); i++) for (const l of lists) if (l[i]) merged.push(l[i]);
  const seen = new Set();
  const results = merged.filter((r) => { const k = dedupeKey(r); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, opts.max ?? 12);
  return { results, sources };
}

/** Re-fetch one record from its own source, so a client can never supply book details. */
export async function fetchExternal(extId, { fetchImpl = fetch, key = process.env.GOOGLE_BOOKS_API_KEY } = {}) {
  const m = /^(ol|gb|pg):([A-Za-z0-9_-]{1,40})$/.exec(String(extId ?? ''));
  if (!m) return null;
  const [, kind, id] = m;
  if (kind === 'gb') {
    const item = await getJson(fetchImpl, `https://www.googleapis.com/books/v1/volumes/${id}${key ? `?key=${encodeURIComponent(key)}` : ''}`);
    return fromGoogle(item);
  }
  if (kind === 'pg') {
    if (!/^\d+$/.test(id)) return null;
    return fromGutenberg(await getJson(fetchImpl, `https://gutendex.com/books/${id}`));
  }
  if (!/^OL\d+W$/.test(id)) return null;
  const data = await getJson(fetchImpl, `https://openlibrary.org/search.json?q=key:/works/${id}&limit=1&fields=key,title,author_name,first_publish_year,cover_i,ebook_access,subject`);
  return (data.docs ?? []).map(fromOpenLibrary).find((r) => r?.extId === `ol:${id}`) ?? null;
}

// ---------- /api/books handler ----------
export function createBooksHandler({ fetchImpl = fetch } = {}) {
  const limited = createRateLimiter({ windowMs: 60 * 1000, max: 30 });
  return async (req) => {
    if (req.method !== 'GET') return fail(405, 'method_not_allowed', 'Use GET.', { Allow: 'GET' });
    if (limited(clientIp(req))) return fail(429, 'rate_limited', 'Too many searches. Please wait a moment.');
    const q = new URL(req.url).searchParams.get('q') ?? '';
    if (!q.trim()) return fail(400, 'invalid_request', 'Add a search term.');
    const data = await searchExternal(q, { fetchImpl });
    return json(200, { ok: true, ...data }, { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' });
  };
}
