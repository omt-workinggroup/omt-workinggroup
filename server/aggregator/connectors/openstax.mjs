// OpenStax: the CMS API lists every textbook with its licence name and URL, PDF and online reader.
import { http } from '../normalize.mjs';

export default {
  id: 'openstax',
  prefix: 'ox',
  async next(cursor, { fetchImpl }) {
    const url = 'https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&fields=title,license_name,license_url,book_state,cover_url,high_resolution_pdf_url,webview_rex_link,description&limit=250';
    const data = await http(url, { fetchImpl });
    const records = (data.items ?? []).filter((b) => b.book_state === 'live' && (b.meta?.locale ?? 'en').startsWith('en')).map((b) => ({
      source_id: b.meta?.slug ?? String(b.id),
      title: b.title,
      authors: 'OpenStax',
      publisher: 'OpenStax, Rice University',
      year: b.meta?.first_published_at?.slice(0, 4),
      description: b.description,
      cover_url: b.cover_url,
      source_url: b.meta?.html_url ?? `https://openstax.org/details/books/${b.meta?.slug}`,
      read_url: b.webview_rex_link,
      file_url: b.high_resolution_pdf_url,
      file_format: b.high_resolution_pdf_url ? 'pdf' : null,
      licence: b.license_name,
      licence_url: b.license_url,
      evidence: 'OpenStax CMS API (license_name, license_url)',
      attribution: 'OpenStax, Rice University',
    }));
    return { records, cursor: { done: true, at: new Date().toISOString() } };
  },
};
