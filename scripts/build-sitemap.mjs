// Generate sitemap.xml from the public pages and the resource catalogue.
// Usage: SITE_URL=https://your-domain.example node scripts/build-sitemap.mjs
import { readFile, writeFile } from 'node:fs/promises';

const SITE = (process.env.SITE_URL || 'https://omt-workinggroup.com').replace(/\/$/, '');
const PAGES = ['', 'home.html', 'library.html', 'office.html', 'presentations.html', 'assistant.html', 'about.html', 'privacy.html', 'terms.html'];
const { resources, updated } = JSON.parse(await readFile(new URL('../data/resources.json', import.meta.url), 'utf8'));
const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const urls = [
  ...PAGES.map((p) => ({ loc: `${SITE}/${p}`, lastmod: updated })),
  ...resources.map((r) => ({ loc: `${SITE}/resource.html?id=${encodeURIComponent(r.id)}`, lastmod: r.added || updated })),
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
await writeFile(new URL('../sitemap.xml', import.meta.url), xml);
console.log(`sitemap.xml: ${urls.length} URLs for ${SITE}`);
