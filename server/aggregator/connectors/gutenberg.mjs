// Project Gutenberg: the official OPDS search feed (the access method Gutenberg offers for apps),
// one subject per run. Books are public domain in the USA; readers elsewhere must check local law.
import { http } from '../normalize.mjs';

const SUBJECTS = ['computers', 'mathematics', 'electricity', 'physics', 'chemistry', 'engineering', 'telegraph', 'radio', 'astronomy', 'geometry'];

const tag = (xml, name) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]?.trim();

// Search results list one <entry> per book (id .../ebooks/<n>.opds, title, author in <content>),
// plus a few navigation entries without a book number, which we drop.
export function parseOpds(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    gid: (tag(e, 'id') ?? '').match(/\/ebooks\/(\d+)(?:\.opds)?$/)?.[1],
    title: tag(e, 'title'),
    author: tag(e, 'content') ?? tag(tag(e, 'author') ?? '', 'name'),
  })).filter((b) => b.gid && b.title && !/\((german|french|spanish|italian|dutch|latin|finnish|portuguese|esperanto|chinese)\)$/i.test(b.title));
}


export default {
  id: 'gutenberg',
  prefix: 'pg',
  async next(cursor, { fetchImpl }) {
    const i = cursor?.subject ?? 0;
    const start = cursor?.start ?? 1;
    const xml = await http(`https://www.gutenberg.org/ebooks/search.opds/?query=${encodeURIComponent(`s.${SUBJECTS[i]} l.en`)}&start_index=${start}`, { fetchImpl, accept: 'application/atom+xml' });
    const books = parseOpds(xml);
    const records = books.map((b) => ({
      source_id: b.gid,
      title: b.title,
      authors: b.author,
      publisher: 'Project Gutenberg',
      cover_url: `https://www.gutenberg.org/cache/epub/${b.gid}/pg${b.gid}.cover.medium.jpg`,
      source_url: `https://www.gutenberg.org/ebooks/${b.gid}`,
      read_url: `https://www.gutenberg.org/ebooks/${b.gid}.html.images`,
      file_url: `https://www.gutenberg.org/ebooks/${b.gid}.epub3.images`,
      file_format: 'epub',
      licence: 'Public domain',
      evidence: 'Project Gutenberg OPDS catalogue (public domain in the USA)',
      jurisdictionNote: 'Public domain in the USA. Outside the USA, check your country’s copyright rules before downloading.',
      attribution: 'Project Gutenberg',
      subjects: [SUBJECTS[i]],
    }));
    const more = /rel="next"/.test(xml) && books.length > 0 && start < 200;
    let next;
    if (more) next = { subject: i, start: start + books.length };
    else if (i + 1 < SUBJECTS.length) next = { subject: i + 1, start: 1 };
    else next = { done: true, at: new Date().toISOString() };
    return { records, cursor: next };
  },
};
