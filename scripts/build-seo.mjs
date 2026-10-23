// Writes search-engine and AI-assistant metadata into each page: robots and social tags, plus
// schema.org structured data (JSON-LD) describing the company, the site and each page.
// Everything it adds carries a data-seo attribute, so re-running replaces it cleanly.
// Run after changing page titles or the company details: node scripts/build-seo.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const SITE = (process.env.SITE_URL || 'https://web.omt-workinggroup.com').replace(/\/$/, '');
const { resources } = JSON.parse(readFileSync(new URL('data/resources.json', root), 'utf8'));
const TOTAL = resources.length;

const SECTORS = [
  ['Renewable energy', 'Operation, maintenance and performance monitoring of renewable energy installations.'],
  ['Power systems', 'Care of generation, distribution and backup power equipment, with planned maintenance.'],
  ['Civil works', 'Construction and upkeep of the sites, structures and foundations that infrastructure stands on.'],
  ['Information and communication technology (ICT)', 'Support for networks, systems and IT infrastructure, from installation to routine upkeep.'],
  ['Telecommunications', 'Operations and maintenance for telecom sites and networks.'],
  ['Training and capacity development', 'Targeted training programmes and knowledge transfer that develop local talent.'],
];

const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;

const organization = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'OMT Working Group',
  alternateName: ['OMT – Working Group', 'OMT WORKING GROUP', 'Operations, Maintenance and Training Working Group', 'OMT'],
  url: `${SITE}/`,
  logo: { '@type': 'ImageObject', url: `${SITE}/assets/logo-512.png`, width: 512, height: 512 },
  image: `${SITE}/assets/og-image.png`,
  description: 'OMT – Working Group is an integrated operations, maintenance, and training company providing specialized services across renewable energy, power systems, civil works, information and communication technology (ICT), and telecommunications.',
  knowsAbout: ['Operations and maintenance (O&M)', 'Renewable energy', 'Power systems', 'Civil works', 'ICT infrastructure', 'Telecommunications', 'Technical training', 'Capacity development', 'Asset lifecycle management'],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Operations, maintenance and training services',
    itemListElement: SECTORS.map(([name, description]) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name, description, provider: { '@id': ORG_ID } } })),
  },
};

const website = {
  '@type': 'WebSite',
  '@id': SITE_ID,
  url: `${SITE}/`,
  name: 'OMT Working Group',
  description: `Company website of OMT Working Group, with a free engineering library of ${TOTAL.toLocaleString('en')} books and learning resources.`,
  inLanguage: 'en',
  publisher: { '@id': ORG_ID },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/library.html?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

const crumbs = (...items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [['Home', '/'], ...items].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE}${path}` })),
});

const page = (type, path, name, description, extra = {}) => ({
  '@type': type,
  '@id': `${SITE}${path}#webpage`,
  url: `${SITE}${path}`,
  name,
  description,
  inLanguage: 'en',
  isPartOf: { '@id': SITE_ID },
  publisher: { '@id': ORG_ID },
  ...extra,
});

const library = { '@type': 'Collection', name: 'OMT Resources library', description: `${TOTAL.toLocaleString('en')} books, guides, templates and courses for developers, network, telecom and power engineers, IT students and office workers.` };

// Per page: structured data, and whether search engines may index it.
const PAGES = {
  'index.html': { graph: [organization, website, page('WebPage', '/', 'OMT Working Group: operations, maintenance and training', 'Integrated operations, maintenance and training company for renewable energy, power systems, civil works, ICT and telecommunications.', { about: { '@id': ORG_ID }, primaryImageOfPage: `${SITE}/assets/og-image.png` })] },
  'resources.html': { graph: [page('CollectionPage', '/resources', 'OMT Resources: the engineer’s bookshelf', `Free engineering library: ${TOTAL.toLocaleString('en')} books and resources on programming, networking, 5G and telecom, Linux, cloud, security, data and Microsoft Office.`, { mainEntity: library }), crumbs(['Resources', '/resources'])] },
  'home.html': { graph: [page('CollectionPage', '/home.html', 'OMT library home', 'Staff picks, new arrivals and shelves for every track in the OMT library.', { mainEntity: library }), crumbs(['Resources', '/resources'], ['Library home', '/home.html'])] },
  'library.html': { graph: [page('SearchResultsPage', '/library.html', 'Explore the OMT library', `Search and filter ${TOTAL.toLocaleString('en')} books, specs, templates and courses by topic, level and access.`, { mainEntity: library }), crumbs(['Resources', '/resources'], ['Explore library', '/library.html'])] },
  'office.html': { graph: [page('CollectionPage', '/office.html', 'Microsoft Office resource center', 'Guides, templates and books for Word, Excel, PowerPoint, Access and Outlook.'), crumbs(['Resources', '/resources'], ['Microsoft Office', '/office.html'])] },
  'presentations.html': { graph: [page('CollectionPage', '/presentations.html', 'Presentations and public speaking', 'Slide design, public speaking, storytelling and ready-made decks.'), crumbs(['Resources', '/resources'], ['Presentations', '/presentations.html'])] },
  'assistant.html': { graph: [
    { '@type': 'WebApplication', '@id': `${SITE}/assistant.html#app`, name: 'OMT AI', url: `${SITE}/assistant.html`, applicationCategory: 'EducationalApplication', operatingSystem: 'Any (web browser)', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, description: 'AI study assistant that explains technical topics, writes code, draws diagrams and charts, reads files and recommends books from the OMT library.', publisher: { '@id': ORG_ID } },
    crumbs(['Resources', '/resources'], ['OMT AI', '/assistant.html']),
  ] },
  'about.html': { graph: [organization, page('AboutPage', '/about.html', 'About OMT Working Group', 'Who we are, how resource access works, how to contact us, and how to report a copyright concern.', { about: { '@id': ORG_ID }, mainEntity: { '@id': ORG_ID } }), crumbs(['About', '/about.html'])] },
  'privacy.html': { graph: [page('WebPage', '/privacy.html', 'Privacy Policy', 'How OMT Working Group handles your data.'), crumbs(['Privacy Policy', '/privacy.html'])] },
  'terms.html': { graph: [page('WebPage', '/terms.html', 'Terms of Use', 'Terms of use for the OMT Working Group website and library.'), crumbs(['Terms of Use', '/terms.html'])] },
  'resource.html': { graph: null }, // the page adds Book data for the book it shows (js/pages/resource.js)
  'favorites.html': { noindex: true },
  '404.html': { noindex: true },
};

const ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

for (const [file, cfg] of Object.entries(PAGES)) {
  const url = new URL(file, root);
  let html = readFileSync(url, 'utf8');
  html = html.replace(/\n[ \t]*<script type="application\/ld\+json" data-seo>[\s\S]*?<\/script>/g, '').replace(/\n[ \t]*<[^>]*\bdata-seo\b[^>]*>/g, '');

  const tags = [];
  if (!cfg.noindex) {
    if (!/<meta name="robots"/.test(html)) tags.push(`<meta name="robots" content="${ROBOTS}" data-seo>`);
    tags.push('<meta property="og:locale" content="en_US" data-seo>');
    const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1];
    const ogDesc = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1];
    if (ogTitle && !/<meta name="twitter:title"/.test(html)) tags.push(`<meta name="twitter:title" content="${ogTitle}" data-seo>`);
    if (ogDesc && !/<meta name="twitter:description"/.test(html)) tags.push(`<meta name="twitter:description" content="${ogDesc}" data-seo>`);
    tags.push('<link rel="alternate" type="text/plain" href="/llms.txt" title="Site summary for AI assistants" data-seo>');
  }
  if (cfg.graph) {
    const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': cfg.graph }, null, 2).replace(/</g, '\\u003c');
    tags.push(`<script type="application/ld+json" data-seo>\n${json}\n  </script>`);
  }
  if (tags.length) {
    // Right after the canonical link (or the description on pages without one).
    const anchor = /(\n[ \t]*<link rel="canonical"[^>]*>)/.test(html) ? /(\n[ \t]*<link rel="canonical"[^>]*>)/ : /(\n[ \t]*<meta name="description"[^>]*>)/;
    html = html.replace(anchor, `$1\n${tags.map((t) => `  ${t}`).join('\n')}`);
  }
  writeFileSync(url, html);
  console.log(file, cfg.noindex ? 'noindex' : `${tags.length} tags`);
}

// llms.txt (https://llmstxt.org): a plain summary of the company and the site for AI assistants.
const count = (cat) => resources.filter((r) => r.category === cat).length;
const free = resources.filter((r) => r.accessType !== 'paid' && r.accessType !== 'info').length;
const office = ['word', 'excel', 'powerpoint', 'access', 'outlook'].reduce((n, c) => n + count(c), 0);
const llms = `# OMT Working Group

> OMT – Working Group is an integrated operations, maintenance, and training company providing specialized services across renewable energy, power systems, civil works, information and communication technology (ICT), and telecommunications. Its website also hosts OMT Resources, a free engineering library of ${TOTAL.toLocaleString('en')} books and learning resources (${free} free to read), and OMT AI, a study assistant.

## Company

- Name: OMT Working Group (also written "OMT – Working Group"; OMT stands for Operations, Maintenance and Training)
- What it does: operates and maintains critical infrastructure assets and trains the people who run them, with a results-oriented approach guided by international best practices and industry standards. It partners with public and private sector clients to deliver turnkey solutions that enhance operational efficiency, minimize downtime, and extend the lifecycle of assets.
- Sectors: ${SECTORS.map(([name]) => name).join('; ')}
- Mission: To provide reliable and sustainable operations, maintenance, and training solutions that optimize performance, empower people, and drive long-term value across energy, infrastructure, and technology sectors.
- Vision: To be a leading regional provider of integrated technical and operational solutions, recognized for excellence, innovation, and the development of local capacity for sustainable growth.
- Core values: Safety, Integrity, Excellence, Innovation, Collaboration, Capacity Development
- Contact: the form at ${SITE}/#contact

## Main pages

- [Company homepage](${SITE}/): who we are, services, mission and vision, values, deployment process, training, contact
- [About](${SITE}/about.html): about OMT and its library, how resource access works, contact, copyright reports
- [OMT Resources](${SITE}/resources): front page of the free library
- [Explore the library](${SITE}/library.html): search and filter every resource (add ?q=your+topic to search)
- [Microsoft Office resource center](${SITE}/office.html): Word, Excel, PowerPoint, Access and Outlook (${office} resources)
- [Presentations](${SITE}/presentations.html): slide design and public speaking (${count('presentations')} resources)
- [OMT AI](${SITE}/assistant.html): AI assistant that explains technical topics, writes code, draws diagrams and charts, and recommends books
- [Mobile app preview](${SITE}/app): the OMT Resources app for Android and iOS

## Library topics

- Programming and computer science: ${count('computer-science')} resources
- Networking: ${count('networking')}
- Telecom and 5G: ${count('telecom')}
- Cybersecurity: ${count('security')}
- Cloud and DevOps: ${count('cloud')}
- Linux and systems: ${count('linux')}
- Data and AI: ${count('data-ai')}
- Design: ${count('design')}
- Business: ${count('business')}; Productivity: ${count('productivity')}; Study skills: ${count('study-skills')}; Success: ${count('success')}; General learning: ${count('general')}

Each book has its own page at ${SITE}/resource.html?id=<id>, listed in the sitemap. OMT does not host copyrighted books: every record links to its official source, a free open edition, or a library copy.

## Optional

- [Sitemap](${SITE}/sitemap.xml)
- [Privacy Policy](${SITE}/privacy.html)
- [Terms of Use](${SITE}/terms.html)
`;
writeFileSync(new URL('llms.txt', root), llms);
console.log('llms.txt', llms.length, 'chars');
