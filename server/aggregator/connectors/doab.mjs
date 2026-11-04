// Directory of Open Access Books: the DOAB REST API (DSpace), books classed under computing (Thema UY/UM/UT).
// DOAB records carry the licence URL in dc.rights; full texts are linked from the publisher or OAPEN.
import { http } from '../normalize.mjs';

const LIMIT = 50;
const QUERIES = ['dc.subject.classification:UY*', 'dc.subject.classification:UM*', 'dc.subject.classification:UT*', 'dc.subject.classification:TJ*'];

const meta = (item, key) => (item.metadata ?? []).filter((m) => m.key === key).map((m) => m.value);

export default {
  id: 'doab',
  prefix: 'doab',
  async next(cursor, { fetchImpl }) {
    const q = cursor?.q ?? 0;
    const offset = cursor?.offset ?? 0;
    const items = await http(`https://directory.doabooks.org/rest/search?query=${encodeURIComponent(QUERIES[q])}&expand=metadata,bitstreams&offset=${offset}&limit=${LIMIT}`, { fetchImpl, timeoutMs: 40000 });
    const list = Array.isArray(items) ? items : [];
    const records = list.map((it) => {
      const handle = it.handle ?? meta(it, 'dc.identifier.uri')[0]?.split('/handle/')[1];
      const pdf = (it.bitstreams ?? []).find((b) => /pdf/i.test(b.mimeType ?? b.format ?? ''));
      const uri = meta(it, 'dc.identifier.uri').find((u) => /^https:/.test(u) && !/doabooks\.org\/handle/.test(u));
      return {
        source_id: handle ?? String(it.uuid ?? it.id),
        title: meta(it, 'dc.title')[0] ?? it.name,
        authors: [...meta(it, 'dc.contributor.author'), ...meta(it, 'dc.contributor.editor')].slice(0, 4).join('; '),
        publisher: meta(it, 'publisher.name')[0] ?? meta(it, 'dc.publisher')[0],
        year: meta(it, 'dc.date.issued')[0]?.slice(0, 4),
        isbn: meta(it, 'dc.identifier.isbn'),
        doi: meta(it, 'oapen.identifier.doi')[0] ?? null,
        language: meta(it, 'dc.language')[0] ?? 'en',
        description: meta(it, 'dc.description.abstract')[0],
        source_url: handle ? `https://directory.doabooks.org/handle/${handle}` : uri,
        read_url: uri ?? null,
        file_url: pdf?.retrieveLink ? new URL(pdf.retrieveLink, 'https://directory.doabooks.org/').href : null,
        file_format: pdf ? 'pdf' : null,
        licence: meta(it, 'dc.rights')[0] ?? meta(it, 'dc.rights.uri')[0],
        licence_url: meta(it, 'dc.rights.uri')[0] ?? meta(it, 'dc.rights')[0],
        evidence: 'DOAB REST API (dc.rights)',
        subjects: [...meta(it, 'dc.subject.other'), ...meta(it, 'dc.subject.classification')],
      };
    });
    let next;
    if (list.length === LIMIT && offset < 2000) next = { q, offset: offset + LIMIT };
    else if (q + 1 < QUERIES.length) next = { q: q + 1, offset: 0 };
    else next = { done: true, at: new Date().toISOString() };
    return { records, cursor: next };
  },
};
