// Shared helpers for the importer: polite HTTP, text clean-up, ids and duplicate keys,
// and the step that turns a connector's raw record into an OMT catalogue item.
import { verifyRights } from './rights.mjs';
import { classify, contentType } from './classify.mjs';

export const USER_AGENT = 'OMT-Library-Bot/1.0 (+https://web.omt-workinggroup.com/about.html; free educational catalogue)';

/** fetch with our user agent, a timeout and a polite back-off on 429/503. */
export async function http(url, { fetchImpl = fetch, accept = 'application/json', timeoutMs = 20000, tries = 3 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: accept }, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 429 || res.status === 503) {
        last = new Error(`${new URL(url).host} asked us to slow down (${res.status})`);
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
      return accept.includes('json') ? await res.json() : await res.text();
    } catch (err) {
      last = err;
      if (/returned 4\d\d/.test(err.message)) break; // a 4xx will not fix itself
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

export const clean = (s, max = 700) => {
  const t = String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, '’')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : t;
};

export const slug = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);

const STOP = /\b(the|a|an|and|of|for|to|in|on|with)\b/g;
/** Same key for the same book from different sources: ISBN-13 when known, else title + first author's surname. */
export function dedupeKey({ title, authors, isbn = [], doi }) {
  const isbn13 = isbn.map((i) => String(i).replace(/[^0-9X]/gi, '')).find((i) => i.length === 13);
  if (isbn13) return `isbn:${isbn13}`;
  if (doi) return `doi:${String(doi).toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}`;
  const t = String(title ?? '').toLowerCase().split(/[:(—–]| - /)[0].replace(STOP, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const first = String(authors ?? '').split(/,|;| and | & /)[0].trim().toLowerCase().split(/\s+/).pop() ?? '';
  return `t:${t}|${first.replace(/[^a-z]/g, '')}`;
}

const SAFE_URL = /^https:\/\/[^\s"'<>]+$/;
const safeUrl = (u) => (u && SAFE_URL.test(String(u)) ? String(u) : null);

/**
 * Raw connector record -> catalogue item (or null when it is off-topic or rights forbid even listing it).
 * raw: { source_id, title, authors, publisher, year, isbn, doi, language, description, cover_url, source_url, read_url,
 *        file_url, file_format, licence, licence_url, evidence, selfDeclared, jurisdictionNote, subjects, hint }
 */
export function buildItem(prefix, source, raw) {
  if (!raw?.source_id || !raw.title || !safeUrl(raw.source_url)) return { skip: 'incomplete' };
  if (raw.language && !/^en/i.test(raw.language)) return { skip: 'language' };
  const cls = classify({ title: raw.title, description: raw.description, subjects: raw.subjects ?? [], hint: raw.hint ?? '' });
  if (!cls) return { skip: 'off-topic' };
  const rights = verifyRights({ licence: raw.licence, licenceUrl: raw.licence_url, evidence: raw.evidence, selfDeclared: raw.selfDeclared, jurisdictionNote: raw.jurisdictionNote, attribution: raw.attribution ?? raw.authors });
  if (rights.rights_state === 'REJECTED') return { skip: 'all rights reserved' };
  const fileFormat = ['pdf', 'epub'].includes(raw.file_format) && safeUrl(raw.file_url) ? raw.file_format : null;
  const item = {
    id: `${prefix}-${slug(raw.source_id)}`.slice(0, 110),
    source,
    source_id: String(raw.source_id).slice(0, 300),
    title: clean(raw.title, 300),
    authors: clean(raw.authors, 300) || null,
    publisher: clean(raw.publisher, 200) || null,
    year: raw.year ? String(raw.year).slice(0, 10) : null,
    edition: raw.edition ? String(raw.edition).slice(0, 60) : null,
    isbn: (raw.isbn ?? []).map(String).slice(0, 6),
    doi: raw.doi ? String(raw.doi).slice(0, 200) : null,
    language: 'en',
    description: clean(raw.description) || null,
    cover_url: safeUrl(raw.cover_url),
    category: cls.category,
    subjects: cls.subjects,
    level: cls.level,
    content_type: contentType({ title: raw.title, hint: raw.hint }),
    source_url: safeUrl(raw.source_url),
    read_url: safeUrl(raw.read_url),
    file_url: fileFormat ? safeUrl(raw.file_url) : null,
    file_format: fileFormat,
    ...rights,
    can_download: rights.can_download && !!fileFormat,
    can_read_on_omt: rights.can_read_on_omt && !!fileFormat,
    published: rights.listable,
  };
  delete item.listable_reason;
  item.dedupe_key = dedupeKey(item);
  return { item };
}
