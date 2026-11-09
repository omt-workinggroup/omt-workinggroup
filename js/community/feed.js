// Lounge, Ask the Community and Project Showcase: one feed with sorting, category filter, search,
// "load more" paging and a composer. The page's <body data-kind> picks the post type.
import { initCommunity, api, esc, $, postCard, empty, loading, toast, session, requireSignIn, LABELS, POST_CATEGORIES, PROJECT_CATEGORIES } from './core.js';

const kind = document.body.dataset.kind; // post | question | project
const PAGE = 12;
const params = new URLSearchParams(location.search);
const state = { sort: params.get('sort') ?? (kind === 'question' ? 'latest' : 'latest'), category: params.get('category') ?? '', q: params.get('q') ?? '', offset: 0 };
const list = $('#feed');
const more = $('#more');

async function load(reset = true) {
  if (reset) { state.offset = 0; list.innerHTML = loading(); }
  more.disabled = true;
  try {
    const rows = await api('feed', { query: { kind, sort: state.sort, category: state.category, q: state.q, limit: PAGE, offset: state.offset } });
    const html = rows.map(postCard).join('');
    if (reset) list.innerHTML = html || empty(state.q || state.category ? 'Nothing matches' : 'Nothing here yet', state.q || state.category ? 'Try another search or category.' : 'Be the first to post.');
    else list.insertAdjacentHTML('beforeend', html);
    state.offset += rows.length;
    more.hidden = rows.length < PAGE;
  } catch (err) {
    list.innerHTML = empty('Could not load', err.message);
    more.hidden = true;
  } finally {
    more.disabled = false;
  }
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.category) p.set('category', state.category);
  if (state.sort !== 'latest') p.set('sort', state.sort);
  history.replaceState(null, '', `${location.pathname}${p.size ? `?${p}` : ''}`);
}

function setupControls() {
  const cats = kind === 'project' ? PROJECT_CATEGORIES : POST_CATEGORIES;
  const sel = $('#category');
  sel.innerHTML = `<option value="">All categories</option>${cats.map((c) => `<option value="${c}">${esc(LABELS[c])}</option>`).join('')}`;
  sel.value = state.category;
  sel.addEventListener('change', () => { state.category = sel.value; syncUrl(); load(); });
  $('#q').value = state.q;
  $('#search').addEventListener('submit', (e) => { e.preventDefault(); state.q = $('#q').value.trim(); syncUrl(); load(); });
  for (const b of document.querySelectorAll('[data-sort]')) {
    b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort));
    b.addEventListener('click', () => {
      state.sort = b.dataset.sort;
      document.querySelectorAll('[data-sort]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      syncUrl(); load();
    });
  }
  more.addEventListener('click', () => load(false));
}

function setupComposer() {
  const form = $('#compose-form');
  const box = $('#compose');
  if (!session()) {
    box.innerHTML = `<div class="signin-note"><p>Sign in to ${kind === 'question' ? 'ask a question' : kind === 'project' ? 'share a project' : 'post'}. It's free for students aged 13 and over.</p><a class="btn btn--primary" href="account.html?next=${encodeURIComponent(location.pathname.slice(1))}">Sign in or join</a></div>`;
    return;
  }
  const cats = kind === 'project' ? PROJECT_CATEGORIES : POST_CATEGORIES;
  form.elements.category.innerHTML = `<option value="">Choose a category</option>${cats.map((c) => `<option value="${c}">${esc(LABELS[c])}</option>`).join('')}`;
  if (kind === 'question') form.elements.category.value = 'help';
  const status = $('#compose-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity() || !requireSignIn()) return;
    const f = new FormData(form);
    const split = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const post = { kind, category: f.get('category'), title: f.get('title'), body: f.get('body'), tags: split(f.get('tags')) };
    if (kind === 'project') Object.assign(post, { stack: split(f.get('stack')), demo_url: f.get('demo_url'), repo_url: f.get('repo_url'), beginner: f.get('beginner') === 'on' });
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Posting…';
    try {
      const r = await api('post_create', { post });
      form.reset();
      status.textContent = '';
      if (r.status === 'published') { toast('Posted.', 'ok'); location.href = `post.html?id=${r.id}`; }
      else { toast('Thanks! A moderator will review it shortly. You can see it in My Space.', 'ok'); status.textContent = 'Sent for review. It appears here once a moderator approves it.'; }
    } catch (err) {
      status.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}

await initCommunity();
setupControls();
setupComposer();
load();
