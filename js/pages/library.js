import { initLayout } from '../core/layout.js';
import { watchCovers } from '../core/covers.js';
import { loadCatalog, searchExternalBooks, suggestBook } from '../core/catalog.js';
import { resourceIdFor } from '../core/external.js';
import { searchCatalog } from '../core/search.js';
import { ACCESS, CATEGORIES, KINDS } from '../core/taxonomy.js';
import { cardHTML, skeletons, stateHTML } from '../core/render.js';
import { searchOpenLibrary } from '../core/openlibrary.js';
import { icons } from '../core/icons.js';
import { SITE } from '../core/config.js';
import { $, debounce, escapeHtml as e, storage } from '../core/util.js';

initLayout();

const els = {
  form: $('#lib-search'), q: $('#lib-q'), results: $('#results'), count: $('#result-count'),
  sort: $('#sort'), author: $('#f-author'), active: $('#active-filters'), more: $('#load-more'),
  clear: $('#clear-filters'), filters: $('#filters'), beyond: $('#beyond'), olBtn: $('#ol-search'),
  olResults: $('#ol-results'), askAi: $('#ask-ai-link'),
};

const FACETS = {
  category: { el: '#f-category', key: 'categories', field: (r) => [r.category], label: (v) => CATEGORIES[v]?.label ?? v },
  kind: { el: '#f-kind', key: 'kinds', field: (r) => [r.kind], label: (v) => KINDS[v] ?? v },
  access: { el: '#f-access', key: 'access', field: (r) => [r.accessType], label: (v) => ACCESS[v]?.label ?? v },
  format: { el: '#f-format', key: 'formats', field: (r) => r.formats ?? [], label: (v) => v },
};

// ---------- State <-> URL ----------
function readState() {
  const p = new URLSearchParams(location.search);
  const list = (k) => (p.get(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    q: (p.get('q') ?? '').slice(0, 200),
    category: list('category'), kind: list('kind'), access: list('access'), format: list('format'),
    author: p.get('author') ?? '',
    sort: ['relevance', 'title', 'newest'].includes(p.get('sort')) ? p.get('sort') : 'relevance',
    page: 1,
  };
}

function writeState(push = false) {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  for (const k of Object.keys(FACETS)) if (state[k].length) p.set(k, state[k].join(','));
  if (state.author) p.set('author', state.author);
  if (state.sort !== 'relevance') p.set('sort', state.sort);
  const url = `${location.pathname}${p.toString() ? `?${p}` : ''}`;
  history[push ? 'pushState' : 'replaceState'](null, '', url);
}

let state = readState();
let catalog = [];

const toOptions = (s, except) => ({
  q: s.q,
  categories: except === 'category' ? [] : s.category,
  kinds: except === 'kind' ? [] : s.kind,
  access: except === 'access' ? [] : s.access,
  formats: except === 'format' ? [] : s.format,
  author: except === 'author' ? '' : s.author,
  sort: s.sort,
});

// ---------- Filters ----------
function renderFacets() {
  for (const [name, facet] of Object.entries(FACETS)) {
    const pool = searchCatalog(catalog, toOptions(state, name));
    const counts = new Map();
    for (const r of catalog) for (const v of facet.field(r)) if (!counts.has(v)) counts.set(v, 0);
    for (const r of pool) for (const v of facet.field(r)) counts.set(v, counts.get(v) + 1);
    const order = name === 'category' ? Object.keys(CATEGORIES) : name === 'kind' ? Object.keys(KINDS) : name === 'access' ? Object.keys(ACCESS) : [...counts.keys()].sort();
    $(facet.el).innerHTML = order.filter((v) => counts.has(v)).map((v) => {
      const id = `f-${name}-${v.replace(/\W+/g, '-')}`;
      const checked = state[name].includes(v) ? ' checked' : '';
      return `<label class="check" for="${id}"><input type="checkbox" id="${id}" data-facet="${name}" value="${e(v)}"${checked}>${e(facet.label(v))}<span class="count"${counts.get(v) ? '' : ' data-zero'}>${counts.get(v)}</span></label>`;
    }).join('');
  }
  const authors = [...new Set(catalog.map((r) => r.author).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  els.author.innerHTML = '<option value="">All authors</option>' +
    authors.map((a) => `<option value="${e(a)}"${a === state.author ? ' selected' : ''}>${e(a)}</option>`).join('');
}

function renderActive() {
  const pills = [];
  if (state.q) pills.push(['q', state.q, `“${state.q}”`]);
  for (const [name, facet] of Object.entries(FACETS)) for (const v of state[name]) pills.push([name, v, facet.label(v)]);
  if (state.author) pills.push(['author', state.author, state.author]);
  els.active.innerHTML = pills.map(([k, v, label]) =>
    `<button type="button" class="chip" data-remove="${e(k)}" data-value="${e(v)}" aria-label="Remove filter ${e(label)}">${e(label)} ${icons.close.replace('<svg', '<svg width="14" height="14"')}</button>`).join('');
}

// ---------- Results ----------
function render() {
  const list = searchCatalog(catalog, toOptions(state));
  const shown = list.slice(0, SITE.pageSize * state.page);
  els.count.textContent = `${list.length} resource${list.length === 1 ? '' : 's'}${state.q ? ` for “${state.q}”` : ''}`;
  if (!list.length) {
    const suggestions = ['Excel', 'Python', 'CV', 'Presentation', 'Business', 'Study'];
    els.results.innerHTML = stateHTML({
      title: 'No matching resources',
      text: state.q ? 'Try fewer or different words, clear some filters, or search Open Library below.' : 'Try clearing some filters.',
      action: `<ul class="chips">${suggestions.map((s) => `<li><a class="chip" href="library.html?q=${encodeURIComponent(s)}">${s}</a></li>`).join('')}</ul>`,
    });
  } else {
    els.results.innerHTML = shown.map(cardHTML).join('');
  }
  els.more.hidden = shown.length >= list.length;
  els.beyond.hidden = !state.q;
  els.olResults.innerHTML = '';
  els.askAi.href = state.q ? `assistant.html?q=${encodeURIComponent(state.q)}` : 'assistant.html';
  renderActive();
  syncQuickTabs();
}

// ---------- Mobile quick tabs and filter sheet ----------
const QUICK = {
  all: { access: [], kind: [] },
  free: { access: ['omt', 'open', 'official'], kind: [] },
  new: { access: [], kind: [], sort: 'newest' },
  az: { access: [], kind: [], sort: 'title' },
  omt: { access: ['omt'], kind: [] },
  book: { access: [], kind: ['book'] },
  template: { access: [], kind: ['template'] },
  guide: { access: [], kind: ['guide'] },
  course: { access: [], kind: ['course'] },
};
const quickTabs = document.getElementById('quick-tabs');
function syncQuickTabs() {
  const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const active = Object.entries(QUICK).find(([, q]) => same(q.access, state.access) && same(q.kind, state.kind) && (q.sort ?? 'relevance') === state.sort)?.[0];
  quickTabs.querySelectorAll('[data-quick]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.quick === active)));
}
quickTabs.addEventListener('click', (event) => {
  const b = event.target.closest('[data-quick]');
  if (!b) return;
  const q = QUICK[b.dataset.quick];
  state.access = [...q.access];
  state.kind = [...q.kind];
  state.sort = q.sort ?? 'relevance';
  els.sort.value = state.sort;
  update();
  b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
});

const mobile = window.matchMedia('(max-width: 767px)');
const backdrop = document.getElementById('sheet-backdrop');
const openBtn = document.getElementById('open-filters');
openBtn.innerHTML = icons.sliders;
function setSheet(open) {
  els.filters.open = open;
  backdrop.hidden = !open;
  document.body.classList.toggle('sheet-open', open);
  if (open) els.filters.querySelector('input, select')?.focus();
  else openBtn.focus();
}
openBtn.addEventListener('click', () => setSheet(true));
backdrop.addEventListener('click', () => setSheet(false));
document.getElementById('close-filters').addEventListener('click', () => setSheet(false));
els.filters.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mobile.matches) setSheet(false); });
mobile.addEventListener('change', (m) => { if (!m.matches) { backdrop.hidden = true; document.body.classList.remove('sheet-open'); els.filters.open = true; } else { els.filters.open = false; } });

function update({ push = false, facets = true } = {}) {
  state.page = 1;
  writeState(push);
  if (facets) renderFacets();
  render();
}

// ---------- External books (Google Books, Open Library, Project Gutenberg) ----------
const SOURCE_NAMES = { googlebooks: 'Google Books', openlibrary: 'Open Library', gutenberg: 'Project Gutenberg' };
let olController;

async function externalResults(q, signal) {
  try {
    return { list: await searchExternalBooks(q, { signal }), canAdd: true };
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // No server functions (e.g. a plain static server): fall back to Open Library in the browser.
    const docs = await searchOpenLibrary(q, { limit: 8, signal });
    return {
      list: docs.map((d) => ({ extId: null, source: 'openlibrary', title: d.title, authors: d.author, year: d.year, url: d.url, access: d.access === 'public' ? 'open' : d.access === 'borrowable' ? 'official' : 'paid' })),
      canAdd: false,
    };
  }
}

function externalHTML(d, canAdd) {
  const a = ACCESS[d.access] ?? ACCESS.paid;
  const inLibrary = d.extId && catalog.some((r) => r.id === resourceIdFor(d.extId));
  const action = inLibrary
    ? `<a class="btn btn--secondary btn--sm" href="resource.html?id=${encodeURIComponent(resourceIdFor(d.extId))}">In the library</a>`
    : canAdd && d.extId ? `<button type="button" class="btn btn--secondary btn--sm" data-suggest="${e(d.extId)}">${icons.heart.replace('<svg', '<svg width="14" height="14"')} Add to OMT library</button>` : '';
  return `<div class="rec ext-rec">
    ${d.cover ? `<img class="ext-rec__cover" src="${e(d.cover)}" alt="" loading="lazy" width="46" height="66">` : ''}
    <div class="ext-rec__body">
      <div class="rec__top"><a href="${e(d.url)}" target="_blank" rel="noopener noreferrer">${e(d.title)}<span class="sr-only"> (opens ${e(SOURCE_NAMES[d.source])} in a new tab)</span></a><span class="badge badge--${a.badge}" title="${e(a.title)}">${e(a.label)}</span></div>
      <span class="rec__why">${e(d.authors || 'Unknown author')}${d.year ? ` · ${e(d.year)}` : ''} · ${e(SOURCE_NAMES[d.source])}</span>
      <div class="ext-rec__actions">${action}<span class="small muted" role="status"></span></div>
    </div>
  </div>`;
}

async function runOpenLibrary() {
  const q = state.q;
  if (!q) return;
  olController?.abort();
  olController = new AbortController();
  els.olBtn.disabled = true;
  els.olResults.innerHTML = '<p class="muted" role="status">Searching Google Books, Open Library and Project Gutenberg…</p>';
  try {
    const { list, canAdd } = await externalResults(q, olController.signal);
    if (q !== state.q) return;
    if (!list.length) {
      els.olResults.innerHTML = stateHTML({ title: 'No books found outside the library', text: 'Try the author\'s name or a shorter title, or ask OMT AI to suggest alternatives.' });
      return;
    }
    els.olResults.innerHTML = `<p class="small muted">Results from Google Books, Open Library and Project Gutenberg. "Free & open" books can be read in full; others can be previewed, borrowed or bought.${canAdd ? ' Add a book to suggest it for the OMT library.' : ''}</p>` + list.map((d) => externalHTML(d, canAdd)).join('');
  } catch (err) {
    if (err.name === 'AbortError' && q !== state.q) return;
    els.olResults.innerHTML = stateHTML({ title: 'Book search is unavailable right now', text: 'Check your connection and try again in a moment.', error: true });
  } finally {
    els.olBtn.disabled = false;
  }
}

els.olResults.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-suggest]');
  if (!btn) return;
  const status = btn.parentElement.querySelector('[role="status"]');
  btn.disabled = true;
  try {
    const result = await suggestBook(btn.dataset.suggest);
    btn.remove();
    status.textContent = result.message;
  } catch (err) {
    btn.disabled = false;
    status.textContent = err.message;
  }
});

// ---------- View toggle ----------
const viewButtons = document.querySelectorAll('[data-view]');
viewButtons[0].innerHTML = icons.grid;
viewButtons[1].innerHTML = icons.list;
function setView(view) {
  els.results.classList.toggle('grid--list', view === 'list');
  viewButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  storage.set('omt:view', view);
}
viewButtons.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
setView(storage.get('omt:view', 'grid') === 'list' ? 'list' : 'grid');

// Collapse filters by default on small screens.
if (window.matchMedia('(max-width: 959px)').matches) els.filters.open = false;
// (on phones the filters open as a bottom sheet from the filter button)

// ---------- Events ----------
els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  state.q = els.q.value.trim().slice(0, 200);
  update({ push: true });
});
els.q.addEventListener('input', debounce(() => {
  const value = els.q.value.trim().slice(0, 200);
  if (value === state.q) return;
  state.q = value;
  update();
}, 300));
els.filters.addEventListener('change', (event) => {
  const box = event.target.closest('[data-facet]');
  if (box) {
    const name = box.dataset.facet;
    state[name] = box.checked ? [...state[name], box.value] : state[name].filter((v) => v !== box.value);
    update();
  } else if (event.target === els.author) {
    state.author = els.author.value;
    update();
  }
});
els.sort.addEventListener('change', () => { state.sort = els.sort.value; update({ facets: false }); });
els.clear.addEventListener('click', () => {
  state = { ...state, category: [], kind: [], access: [], format: [], author: '' };
  update();
});
els.active.addEventListener('click', (event) => {
  const pill = event.target.closest('[data-remove]');
  if (!pill) return;
  const { remove, value } = pill.dataset;
  if (remove === 'q') { state.q = ''; els.q.value = ''; }
  else if (remove === 'author') state.author = '';
  else state[remove] = state[remove].filter((v) => v !== value);
  update();
});
els.more.querySelector('button').addEventListener('click', () => {
  state.page += 1;
  const before = els.results.children.length;
  render();
  els.results.children[before]?.querySelector('a')?.focus();
});
els.olBtn.addEventListener('click', runOpenLibrary);
window.addEventListener('popstate', () => {
  state = readState();
  els.q.value = state.q;
  els.sort.value = state.sort;
  renderFacets();
  render();
});

// ---------- Start ----------
els.q.value = state.q;
els.sort.value = state.sort;
els.results.innerHTML = skeletons(6);
try {
  catalog = await loadCatalog();
  watchCovers(document.getElementById('main'), catalog);
  renderFacets();
  render();
} catch (err) {
  els.count.textContent = '';
  els.results.innerHTML = stateHTML({
    title: 'The library couldn\'t load', text: err.message, error: true,
    action: '<button type="button" class="btn btn--secondary" id="retry">Try again</button>',
  });
  document.getElementById('retry')?.addEventListener('click', () => location.reload());
}
