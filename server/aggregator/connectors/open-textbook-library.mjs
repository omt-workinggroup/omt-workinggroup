// Open Textbook Library (University of Minnesota): the textbooks.json API, one page per run, with the
// licence, ISBN, contributors, subjects and format links of each book.
import { http } from '../normalize.mjs';

const names = (people = []) => people.map((p) => p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' ')).filter(Boolean).slice(0, 4).join(', ');

export default {
  id: 'open-textbook-library',
  prefix: 'otl',
  async next(cursor, { fetchImpl }) {
    const page = cursor?.page ?? 1;
    const data = await http(`https://open.umn.edu/opentextbooks/textbooks.json?page=${page}`, { fetchImpl, timeoutMs: 40000 });
    const books = data.data ?? data.textbooks ?? (Array.isArray(data) ? data : []);
    const records = books.map((b) => {
      const formats = b.formats ?? [];
      const pdf = formats.find((f) => /pdf/i.test(f.type ?? f.format ?? '') && /^https:/.test(f.url ?? ''));
      const epub = formats.find((f) => /epub/i.test(f.type ?? f.format ?? '') && /^https:/.test(f.url ?? ''));
      const file = pdf ?? epub;
      return {
        source_id: String(b.id),
        title: b.title,
        authors: names(b.contributors ?? b.authors),
        publisher: (b.publishers ?? [])[0]?.name,
        year: b.copyright_year ?? b.year,
        isbn: [b.ISBN13, b.ISBN10, b.isbn13, b.isbn].filter(Boolean),
        language: b.language ?? 'en',
        description: b.description,
        cover_url: b.cover_url ?? b.image_url,
        source_url: b.url ?? `https://open.umn.edu/opentextbooks/textbooks/${b.id}`,
        read_url: b.url ?? null,
        file_url: file?.url,
        file_format: file ? (pdf ? 'pdf' : 'epub') : null,
        licence: b.license ?? b.license_name,
        licence_url: b.license_url,
        evidence: 'Open Textbook Library API (license)',
        subjects: (b.subjects ?? []).map((s) => s.name ?? s),
      };
    });
    const more = books.length > 0 && (data.links?.next || data.meta?.next_page || books.length >= 10) && page < 200;
    return { records, cursor: more ? { page: page + 1 } : { done: true, at: new Date().toISOString() } };
  },
};
