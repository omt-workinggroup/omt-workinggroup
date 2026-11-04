// Standard Ebooks: the public "new releases" Atom feed (their full OPDS catalogue needs a Patrons Circle login).
// Their editions are public domain in the USA and their own work is CC0. Mostly literature, so most entries
// are outside OMT's technology scope and the classifier skips them.
import { http } from '../normalize.mjs';

const tag = (xml, name) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]?.trim();

export default {
  id: 'standard-ebooks',
  prefix: 'se',
  async next(_cursor, { fetchImpl }) {
    const xml = await http('https://standardebooks.org/feeds/atom/new-releases', { fetchImpl, accept: 'application/atom+xml' });
    const records = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
      const href = e.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1] ?? tag(e, 'id');
      const epub = e.match(/<link[^>]*href="([^"]+\.epub)"[^>]*>/)?.[1];
      return {
        source_id: String(tag(e, 'id') ?? href).replace(/^https:\/\/standardebooks\.org\/ebooks\//, ''),
        title: tag(e, 'title'),
        authors: tag(tag(e, 'author') ?? '', 'name'),
        publisher: 'Standard Ebooks',
        description: tag(e, 'summary') ?? tag(e, 'content'),
        source_url: href,
        read_url: href,
        file_url: epub ? new URL(epub, 'https://standardebooks.org/').href : null,
        file_format: epub ? 'epub' : null,
        licence: 'Public domain',
        evidence: 'Standard Ebooks feed (US public domain texts; Standard Ebooks’ own work under CC0)',
        jurisdictionNote: 'Public domain in the USA. Outside the USA, check your country’s copyright rules before downloading.',
        attribution: 'Standard Ebooks',
        subjects: [...e.matchAll(/<category[^>]*term="([^"]*)"/g)].map((m) => m[1]),
      };
    }).filter((r) => r.title && r.source_url);
    return { records, cursor: { done: true, at: new Date().toISOString() } };
  },
};
