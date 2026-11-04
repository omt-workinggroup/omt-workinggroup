// Internet Archive: the advanced search API, texts with a Creative Commons or public-domain licence URL.
// Those licences are declared by whoever uploaded the item, not checked by a publisher, so every record
// goes to the review queue and nothing is published or hosted until an administrator approves it.
import { http } from '../normalize.mjs';

const QUERY = '(subject:("computer science" OR "computer programming" OR "computer networks" OR "information technology" OR "software engineering" OR "cybersecurity" OR "data science")) AND mediatype:texts AND (licenseurl:*creativecommons.org* OR licenseurl:*publicdomain*)';
const ROWS = 100;
const first = (v) => (Array.isArray(v) ? v[0] : v);

export default {
  id: 'internet-archive',
  prefix: 'ia',
  async next(cursor, { fetchImpl }) {
    const page = cursor?.page ?? 1;
    const fl = ['identifier', 'title', 'creator', 'description', 'licenseurl', 'subject', 'date', 'publisher', 'language'].map((f) => `fl[]=${f}`).join('&');
    const data = await http(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(QUERY)}&${fl}&rows=${ROWS}&page=${page}&output=json`, { fetchImpl });
    const docs = data.response?.docs ?? [];
    const records = docs.map((d) => ({
      source_id: d.identifier,
      title: first(d.title),
      authors: [].concat(d.creator ?? []).slice(0, 3).join(', '),
      publisher: first(d.publisher),
      year: String(first(d.date) ?? '').slice(0, 4) || null,
      language: /^(eng|en)/i.test(String(first(d.language) ?? 'en')) ? 'en' : String(first(d.language)),
      description: first(d.description),
      cover_url: `https://archive.org/services/img/${d.identifier}`,
      source_url: `https://archive.org/details/${d.identifier}`,
      read_url: `https://archive.org/details/${d.identifier}`,
      licence: d.licenseurl,
      licence_url: d.licenseurl,
      evidence: 'Internet Archive item metadata (licenseurl, set by the uploader)',
      selfDeclared: true,
      subjects: [].concat(d.subject ?? []).slice(0, 8),
    }));
    const done = page * ROWS >= (data.response?.numFound ?? 0) || docs.length === 0 || page >= 20;
    return { records, cursor: done ? { done: true, at: new Date().toISOString() } : { page: page + 1 } };
  },
};
