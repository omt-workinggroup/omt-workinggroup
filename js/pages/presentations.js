import { initLayout } from '../core/layout.js';
import { loadCatalog } from '../core/catalog.js';
import { cardHTML, skeletons, stateHTML } from '../core/render.js';

initLayout();

const results = document.getElementById('pres-results');
const filter = document.getElementById('pres-filter');
results.innerHTML = skeletons(4);

const isPresentation = (r) => r.category === 'presentations' || r.category === 'powerpoint'
  || (r.tags ?? []).some((t) => ['presentation', 'pitch deck', 'slides'].includes(t));

let items = [];
function render(kind) {
  const list = kind ? items.filter((r) => r.kind === kind) : items;
  results.innerHTML = list.length
    ? list.map(cardHTML).join('')
    : stateHTML({ title: 'Nothing here yet', text: 'Try another filter or ask OMT AI for presentation help.' });
}

filter.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-kind]');
  if (!chip) return;
  filter.querySelectorAll('[data-kind]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
  render(chip.dataset.kind);
});

try {
  const ORDER = { template: 0, guide: 1, tutorial: 2 };
  items = (await loadCatalog()).filter(isPresentation).sort((a, b) => (ORDER[a.kind] ?? 3) - (ORDER[b.kind] ?? 3));
  render('');
} catch (err) {
  results.innerHTML = stateHTML({ title: 'Resources couldn\'t load', text: err.message, error: true });
}
