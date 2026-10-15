// Open Library search (https://openlibrary.org/developers/api). Free, no API key, CORS-enabled.
// Results are bibliographic records. A match does NOT mean the book is free to read.

const ENDPOINT = 'https://openlibrary.org/search.json';
const FIELDS = 'key,title,author_name,first_publish_year,cover_i,ebook_access,edition_count';

export const OL_ACCESS = {
  public: { label: 'Free to read', badge: 'open', explain: 'Public-domain scan, free to read on Open Library / Internet Archive.' },
  borrowable: { label: 'Borrow free', badge: 'official', explain: 'Can be borrowed for free with an Open Library account, when a copy is available.' },
  printdisabled: { label: 'Print-disabled access', badge: 'info', explain: 'Only available to readers with a qualifying print disability.' },
  no_ebook: { label: 'Info only', badge: 'info', explain: 'No ebook on Open Library. Look for it at a library or bookseller.' },
};

export function normalizeOpenLibraryDoc(doc) {
  const access = OL_ACCESS[doc.ebook_access] ? doc.ebook_access : 'no_ebook';
  return {
    source: 'openlibrary',
    title: String(doc.title ?? 'Untitled'),
    author: Array.isArray(doc.author_name) ? doc.author_name.slice(0, 3).join(', ') : 'Unknown author',
    year: doc.first_publish_year ? String(doc.first_publish_year) : '',
    url: typeof doc.key === 'string' && doc.key.startsWith('/works/') ? `https://openlibrary.org${doc.key}` : null,
    cover: Number.isInteger(doc.cover_i) ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    access,
  };
}

/** Search Open Library. Throws on network/HTTP errors so callers can show an error state. */
export async function searchOpenLibrary(query, { limit = 6, signal } = {}) {
  const q = String(query ?? '').trim().slice(0, 200);
  if (!q) return [];
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&limit=${limit}&fields=${FIELDS}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  signal?.addEventListener('abort', () => controller.abort());
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Open Library returned ${res.status}`);
    const data = await res.json();
    return (data.docs ?? []).map(normalizeOpenLibraryDoc).filter((d) => d.url);
  } finally {
    clearTimeout(timeout);
  }
}
