import { initLayout } from '../core/layout.js';
import { loadCatalog } from '../core/catalog.js';
import { CATEGORIES } from '../core/taxonomy.js';
import { icons } from '../core/icons.js';
import { renderCards, skeletons, stateHTML } from '../core/render.js';
import { escapeHtml as e } from '../core/util.js';

initLayout();

// --- Hero search: normal search, or hand the question to OMT AI ---
const form = document.getElementById('home-search');
const input = document.getElementById('home-q');
const aiToggle = document.getElementById('home-ai');
aiToggle.addEventListener('change', () => {
  input.placeholder = aiToggle.checked
    ? 'Describe what you need, e.g. “a beginner book on Python”'
    : 'Search books, topics, presentations, Word, Excel…';
});
form.addEventListener('submit', (event) => {
  const q = input.value.trim();
  if (!q) { event.preventDefault(); input.focus(); return; }
  if (aiToggle.checked) {
    event.preventDefault();
    location.href = `assistant.html?q=${encodeURIComponent(q)}`;
  }
});

// --- Category cards ---
const HOME_CATEGORIES = [
  { label: 'Books and eBooks', href: 'library.html?kind=book', short: 'BK', color: '#0f2a4a', icon: 'book', description: 'Free textbooks, classics and recommended reads.' },
  ...['word', 'excel', 'powerpoint', 'access', 'outlook', 'presentations', 'study-skills', 'computer-science', 'business', 'productivity', 'general']
    .map((slug) => ({ ...CATEGORIES[slug], href: `library.html?category=${slug}` })),
];
document.getElementById('home-categories').innerHTML = HOME_CATEGORIES.map((c) => `
  <a class="cat-card" href="${c.href}">
    <span class="cat-card__icon" style="background:${c.color}" aria-hidden="true">${c.icon ? icons[c.icon] : e(c.short)}</span>
    <span><h3>${e(c.label)}</h3><p>${e(c.description)}</p></span>
  </a>`).join('');

// --- Featured and recently added ---
const featured = document.getElementById('home-featured');
const recent = document.getElementById('home-recent');
featured.innerHTML = skeletons(4);
recent.innerHTML = skeletons(4);
try {
  const all = await loadCatalog();
  // Real counts from the catalogue, never hard-coded marketing numbers.
  const stats = {
    total: all.length,
    free: all.filter((r) => r.accessType !== 'paid' && r.accessType !== 'info').length,
    guides: all.filter((r) => r.accessType === 'omt' && r.kind === 'guide').length,
    templates: all.filter((r) => r.accessType === 'omt' && r.downloadUrl).length,
  };
  for (const [key, value] of Object.entries(stats)) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = String(value);
  }
  renderCards(featured, all.filter((r) => r.featured).slice(0, 8));
  renderCards(recent, [...all].sort((a, b) => (b.added ?? '').localeCompare(a.added ?? '')).slice(0, 4));
} catch (err) {
  featured.innerHTML = stateHTML({ title: 'Resources unavailable', text: err.message, error: true, action: '<button type="button" class="btn btn--secondary" id="retry">Try again</button>' });
  recent.innerHTML = '';
  document.getElementById('retry')?.addEventListener('click', () => location.reload());
}
