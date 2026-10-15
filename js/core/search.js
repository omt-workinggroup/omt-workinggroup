// Shared catalogue search. Pure functions with no DOM access, so the browser
// and the serverless AI function (server/ai.mjs) use the same code.
import { CATEGORIES } from './taxonomy.js';

const STOPWORDS = new Set(`a an and are as at be but by can could do does for from get give go good great
have help how i i'm im in into is it its learn learning like looking me my need of on or please
recommend recommendation resource resources show some something teach teaches teaching that the
their them there this to understand use using want way what where which who why with would you your
find search about any best really very make create build start started starting beginning
explain tell know just also more one ones so up out all friendly professional useful quick
nice kind type topic topics subject subjects related level stuff things thing`.split(/\s+/));

// Words a student might type, mapped to the terms used in the catalogue.
const SYNONYMS = {
  spreadsheet: ['excel'], spreadsheets: ['excel'], sheet: ['excel'], sheets: ['excel'], xlsx: ['excel'],
  formula: ['formulas'], function: ['functions'],
  ppt: ['powerpoint'], pptx: ['powerpoint'], slide: ['slides', 'powerpoint'], slides: ['powerpoint'],
  deck: ['presentation'], decks: ['presentation'], slideshow: ['powerpoint', 'presentation'],
  presentations: ['presentation'], presenting: ['presentation'],
  docx: ['word'], document: ['word'], documents: ['word'],
  resume: ['cv'], 'résumé': ['cv'], resumes: ['cv'], cvs: ['cv'],
  email: ['outlook'], emails: ['outlook'], mail: ['outlook'], calendar: ['outlook'],
  database: ['access'], databases: ['access'], sql: ['database'],
  coding: ['programming'], code: ['programming'], program: ['programming'], programmer: ['programming'],
  js: ['javascript'], cs: ['computer science'],
  startup: ['entrepreneurship'], startups: ['entrepreneurship'], entrepreneur: ['entrepreneurship'],
  money: ['budget', 'finance'], budgeting: ['budget'],
  revise: ['revision', 'study'], revising: ['study'], exam: ['exams'], studying: ['study'],
  novel: ['fiction'], novels: ['fiction'], stories: ['fiction'],
  proposal: ['project proposal'], pitch: ['pitch deck'],
  manage: ['management'], managing: ['management'], leader: ['leadership'],
  habit: ['habits'], focus: ['focus'], concentration: ['focus'],
};

const LEVEL_HINTS = {
  beginner: 'beginner', beginners: 'beginner', basic: 'beginner', basics: 'beginner', intro: 'beginner',
  introduction: 'beginner', introductory: 'beginner', easy: 'beginner', simple: 'beginner', scratch: 'beginner', zero: 'beginner',
  intermediate: 'intermediate', advanced: 'advanced', expert: 'advanced',
};
const KIND_HINTS = {
  book: 'book', books: 'book', ebook: 'book', ebooks: 'book', textbook: 'book', textbooks: 'book', read: 'book', reading: 'book',
  template: 'template', templates: 'template', sample: 'template',
  course: 'course', courses: 'course', lecture: 'course', lectures: 'course', video: 'course', videos: 'course',
  tutorial: 'tutorial', tutorials: 'tutorial', guide: 'guide', guides: 'guide', lesson: 'tutorial', lessons: 'tutorial',
};

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();
}

/** Split a raw query into search terms plus level/kind hints. */
export function parseQuery(raw) {
  const text = normalize(raw);
  const words = text ? text.split(' ') : [];
  const hints = { level: null, kind: null };
  const terms = [];
  for (const word of words) {
    if (LEVEL_HINTS[word]) { hints.level = LEVEL_HINTS[word]; continue; }
    if (KIND_HINTS[word]) { hints.kind = KIND_HINTS[word]; continue; }
    if (STOPWORDS.has(word) || word.length < 2) continue;
    if (!terms.includes(word)) terms.push(word);
  }
  // A query made only of hints ("beginner books") still searches by the hint.
  return { text, terms, hints };
}

function indexResource(r) {
  if (r.__index) return r.__index;
  const cat = CATEGORIES[r.category]?.label ?? '';
  const idx = {
    title: normalize(r.title),
    author: normalize(`${r.author ?? ''} ${r.publisher ?? ''}`),
    tags: (r.tags ?? []).map(normalize),
    category: normalize(`${cat} ${r.category}`),
    description: normalize(r.description),
    formats: normalize((r.formats ?? []).join(' ')),
  };
  Object.defineProperty(r, '__index', { value: idx, enumerable: false });
  return idx;
}

const FIELD_WEIGHTS = { title: 6, tags: 4, category: 3, author: 3, description: 2, formats: 1 };

function termScore(idx, term) {
  let best = 0;
  const wordRe = new RegExp(`(^|\\s)${term.replace(/[+#]/g, '\\$&')}(\\s|$)`);
  const prefixRe = new RegExp(`(^|\\s)${term.replace(/[+#]/g, '\\$&')}`);
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    if (field === 'tags') {
      for (const tag of idx.tags) {
        if (tag === term) best = Math.max(best, weight * 1.25);
        else if (wordRe.test(tag)) best = Math.max(best, weight);
        else if (term.length >= 3 && prefixRe.test(tag)) best = Math.max(best, weight * 0.5);
      }
      continue;
    }
    const value = idx[field];
    if (wordRe.test(value)) best = Math.max(best, weight);
    else if (term.length >= 3 && prefixRe.test(value)) best = Math.max(best, weight * 0.5);
    else if (term.length >= 4 && value.includes(term)) best = Math.max(best, weight * 0.3);
  }
  return best;
}

/** Score one resource against a parsed query. Returns 0 when it does not match. */
export function scoreResource(resource, parsed) {
  const idx = indexResource(resource);
  const { terms, hints, text } = parsed;
  let score = 0;
  let matched = 0;

  for (const term of terms) {
    let s = termScore(idx, term);
    for (const syn of SYNONYMS[term] ?? []) s = Math.max(s, termScore(idx, normalize(syn)) * 0.9);
    if (s > 0) matched += 1;
    score += s;
  }

  if (terms.length) {
    const needed = terms.length <= 2 ? terms.length : Math.ceil(terms.length * 0.5);
    if (matched < needed) return 0;
    if (text && idx.title.includes(text)) score += 10; // exact title phrase
    score *= matched / terms.length;
  } else if (!hints.level && !hints.kind) {
    return 0;
  }

  if (hints.kind) {
    if (resource.kind === hints.kind) score += terms.length ? 3 : 5;
    else if (!terms.length) return 0;
  }
  if (hints.level) {
    if (resource.level === hints.level) score += 2;
    else if (!terms.length && !hints.kind) return 0;
  }
  return score;
}

/**
 * Search and filter the catalogue.
 * @param {object[]} resources
 * @param {{q?: string, categories?: string[], formats?: string[], access?: string[], kinds?: string[], author?: string, sort?: string}} opts
 */
export function searchCatalog(resources, opts = {}) {
  const { q = '', categories = [], formats = [], access = [], kinds = [], author = '', sort = 'relevance' } = opts;
  const parsed = parseQuery(q);
  const hasQuery = parsed.terms.length > 0 || parsed.hints.kind || parsed.hints.level;

  let results = resources
    .filter((r) => !categories.length || categories.includes(r.category))
    .filter((r) => !formats.length || (r.formats ?? []).some((f) => formats.includes(f)))
    .filter((r) => !access.length || access.includes(r.accessType))
    .filter((r) => !kinds.length || kinds.includes(r.kind))
    .filter((r) => !author || r.author === author)
    .map((r) => ({ resource: r, score: hasQuery ? scoreResource(r, parsed) : 1 }))
    .filter((x) => x.score > 0);

  const byTitle = (a, b) => a.resource.title.localeCompare(b.resource.title);
  const byNewest = (a, b) => (b.resource.added ?? '').localeCompare(a.resource.added ?? '') || byTitle(a, b);
  if (sort === 'title') results.sort(byTitle);
  else if (sort === 'newest') results.sort(byNewest);
  else results.sort((a, b) => b.score - a.score || byNewest(a, b));

  return results.map((x) => x.resource);
}

/** Resources related to `resource`: same category first, then shared tags. */
export function relatedResources(resources, resource, limit = 4) {
  const tags = new Set(resource.tags ?? []);
  return resources
    .filter((r) => r.id !== resource.id)
    .map((r) => ({
      r,
      s: (r.category === resource.category ? 3 : 0) + (r.tags ?? []).filter((t) => tags.has(t)).length,
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);
}
