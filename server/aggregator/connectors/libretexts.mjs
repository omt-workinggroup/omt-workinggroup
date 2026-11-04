// LibreTexts: the Commons catalogue API lists every book (about 4,000) with a licence code and PDF link.
// We page through it 500 at a time and keep the STEM and workforce shelves.
import { http } from '../normalize.mjs';

const SHELVES = new Set(['eng', 'math', 'phys', 'chem', 'stats', 'workforce', 'k12']);
const PAGE = 500;

export default {
  id: 'libretexts',
  prefix: 'lt',
  async next(cursor, { fetchImpl }) {
    const page = cursor?.page ?? 1;
    const data = await http(`https://commons.libretexts.org/api/v1/commons/catalog?activePage=${page}&limit=${PAGE}`, { fetchImpl, timeoutMs: 40000 });
    const books = data.books ?? [];
    const records = books.filter((b) => SHELVES.has(b.library)).map((b) => {
      const version = (b.libraryTags ?? []).find((t) => t.startsWith('licenseversion:'))?.split(':')[1];
      return {
        source_id: b.bookID,
        title: b.title,
        authors: b.author,
        publisher: b.affiliation ? `LibreTexts (${b.affiliation})` : 'LibreTexts',
        year: b.lastUpdated ? String(new Date(b.lastUpdated).getUTCFullYear()) : null,
        description: b.summary,
        cover_url: typeof b.thumbnail === 'string' ? b.thumbnail : null,
        source_url: b.links?.online,
        read_url: b.links?.online,
        file_url: b.links?.pdf,
        file_format: b.links?.pdf ? 'pdf' : null,
        licence: b.license,
        licence_url: version && /^cc/.test(b.license ?? '') ? `https://creativecommons.org/licenses/${b.license.replace(/^cc/, '').replace(/(by|nc|nd|sa)/g, '$1-').replace(/-$/, '')}/${version.slice(0, 1)}.${version.slice(1) || '0'}/` : null,
        evidence: 'LibreTexts Commons catalogue API (license, libraryTags)',
        subjects: [b.subject, b.library].filter(Boolean),
        hint: b.shelfPath ?? '',
      };
    });
    const total = data.numTotal ?? 0;
    const done = page * PAGE >= total || books.length === 0;
    return { records, cursor: done ? { done: true, at: new Date().toISOString() } : { page: page + 1 } };
  },
};
