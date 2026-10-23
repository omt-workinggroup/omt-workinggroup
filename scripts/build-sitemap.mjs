// Generate sitemap.xml from the public pages and the resource catalogue (with each book's cover image).
// Usage: SITE_URL=https://your-domain.example node scripts/build-sitemap.mjs
import { readFile, writeFile } from 'node:fs/promises';

const SITE = (process.env.SITE_URL || 'https://web.omt-workinggroup.com').replace(/\/$/, '');
// Company homepage, the resources front page and About first, then the rest of the library.
const PAGES = [
  ['', 'weekly', '1.0'],
  ['resources', 'weekly', '0.9'],
  ['about.html', 'monthly', '0.8'],
  ['home.html', 'weekly', '0.8'],
  ['library.html', 'weekly', '0.8'],
  ['office.html', 'monthly', '0.7'],
  ['presentations.html', 'monthly', '0.7'],
  ['assistant.html', 'monthly', '0.7'],
  ['privacy.html', 'yearly', '0.3'],
  ['terms.html', 'yearly', '0.3'],
];
const { resources, updated } = JSON.parse(await readFile(new URL('../data/resources.json', import.meta.url), 'utf8'));
const latest = resources.reduce((d, r) => (r.added && r.added > d ? r.added : d), updated);
const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const urls = [
  ...PAGES.map(([p, changefreq, priority]) => ({ loc: `${SITE}/${p}`, lastmod: latest, changefreq, priority })),
  ...resources.map((r) => ({
    loc: `${SITE}/resource.html?id=${encodeURIComponent(r.id)}`,
    lastmod: r.added || updated,
    changefreq: 'monthly',
    priority: r.featured ? '0.7' : '0.6',
    image: r.cover?.startsWith('assets/') ? { loc: `${SITE}/${r.cover}`, title: r.title } : null,
  })),
];
const entry = (u) => [
  '  <url>',
  `    <loc>${x(u.loc)}</loc>`,
  `    <lastmod>${u.lastmod}</lastmod>`,
  `    <changefreq>${u.changefreq}</changefreq>`,
  `    <priority>${u.priority}</priority>`,
  ...(u.image ? [`    <image:image><image:loc>${x(u.image.loc)}</image:loc><image:title>${x(u.image.title)}</image:title></image:image>`] : []),
  '  </url>',
].join('\n');
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(entry).join('\n')}
</urlset>
`;
await writeFile(new URL('../sitemap.xml', import.meta.url), xml);
console.log(`sitemap.xml: ${urls.length} URLs (${urls.filter((u) => u.image).length} with cover images) for ${SITE}`);
