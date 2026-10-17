// Turning external book records (Open Library, Google Books, Project Gutenberg) into OMT resources.
// No DOM access: shared by the browser and the server functions.
import { normalize } from './search.js';

export const SOURCES = {
  openlibrary: { name: 'Open Library', short: 'Open Library' },
  googlebooks: { name: 'Google Books', short: 'Google Books' },
  gutenberg: { name: 'Project Gutenberg', short: 'Gutenberg' },
};

const CATEGORY_HINTS = [
  ['telecom', /\b(5g|4g|lte|gsm|umts|telecom\w*|wireless|mobile communication|radio|antenna|rf|fib(re|er) optic|optical fib|microwave|satellite|signal processing|3gpp)\b/],
  ['networking', /\b(network\w*|tcp|ip\b|internet protocol|routing|router|switching|cisco|ccna|lan|wan|sdn|dns|wi-?fi)\b/],
  ['security', /\b(security|cyber\w*|hacking|cryptograph\w*|penetration|malware|encryption|forensic\w*)\b/],
  ['cloud', /\b(cloud|devops|kubernetes|docker|container\w*|aws|azure|microservice\w*|site reliability|terraform)\b/],
  ['data-ai', /\b(machine learning|deep learning|artificial intelligence|neural network\w*|data science|statistics|data mining|big data|sql|database\w*|analytics)\b/],
  ['linux', /\b(linux|unix|operating system\w*|shell|bash|system administration|sysadmin)\b/],
  ['computer-science', /\b(program\w*|python|java\w*|c\+\+|rust|golang|software|algorithm\w*|computer science|coding|web development|data structure\w*|computer\w*)\b/],
  ['business', /\b(business|management|economics|entrepreneur\w*|marketing|finance)\b/],
];

export function guessCategory(text) {
  const t = ` ${normalize(text)} `;
  for (const [cat, re] of CATEGORY_HINTS) if (re.test(t)) return cat;
  return 'general';
}

export const resourceIdFor = (extId) => `ext-${extId.replace(':', '-')}`;
export const extIdFromResourceId = (id) => (/^ext-(ol|gb|pg)-/.test(id) ? id.slice(4).replace('-', ':') : null);

const LICENSE = {
  open: 'Free to read (public domain or open access)',
  official: 'Free to borrow with an Open Library account',
  preview: 'Free preview; buy or borrow for the full text',
  paid: 'In copyright: buy it or borrow it from a library',
};

/** A stored or searched external record -> an OMT resource object. */
export function toResource(rec) {
  const src = SOURCES[rec.source] ?? { name: rec.source };
  const subjects = (rec.subjects ?? []).map((s) => String(s).toLowerCase()).slice(0, 8);
  return {
    id: resourceIdFor(rec.ext_id ?? rec.extId),
    title: rec.title,
    author: rec.authors || 'Unknown author',
    publisher: src.name,
    year: rec.year || '',
    kind: 'book',
    category: guessCategory(`${rec.title} ${subjects.join(' ')} ${rec.description ?? ''}`),
    level: 'intermediate',
    formats: rec.access === 'open' ? ['Online book'] : ['Print', 'eBook'],
    accessType: rec.access,
    license: LICENSE[rec.access] ?? '',
    description: String(rec.description || `${rec.title}${rec.authors ? ` by ${rec.authors}` : ''}, from ${src.name}.`).slice(0, 400),
    tags: [...new Set([...subjects, 'book', src.short.toLowerCase()])],
    sourceName: src.name,
    sourceUrl: rec.url,
    readUrl: rec.read_url ?? rec.readUrl ?? undefined,
    cover: rec.cover_url ?? rec.cover ?? undefined,
    added: String(rec.created_at ?? '').slice(0, 10) || undefined,
    external: true,
    addedBy: rec.added_by,
  };
}
