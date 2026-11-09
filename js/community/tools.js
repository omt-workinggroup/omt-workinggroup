// Tools directory: curated, with honest pricing labels. Search and filters run in the browser.
import { initCommunity, esc, $, empty } from './core.js';

let data = { categories: {}, tools: [] };
const list = $('#tools');

function card(t) {
  const host = new URL(t.url).hostname.replace(/^www\./, '');
  return `<article class="tcard">
    <p class="tcard__top"><span class="tcard__logo" aria-hidden="true">${esc(t.name[0])}</span><span class="pill${t.pricing === 'Free' ? ' pill--ok' : t.pricing === 'Paid' ? ' pill--bad' : ''}">${esc(t.pricing)}</span></p>
    <h3>${esc(t.name)}</h3>
    <p class="muted small">${esc(data.categories[t.category])} · ${esc(t.use)}</p>
    <p>${esc(t.description)}</p>
    <p class="tcard__note"><b>Beginner tip:</b> ${esc(t.note)}</p>
    <a class="more" href="${esc(t.url)}" rel="noopener" target="_blank">${esc(host)} <span aria-hidden="true">&rarr;</span></a>
  </article>`;
}

function render() {
  const q = $('#q').value.trim().toLowerCase();
  const cat = $('#f-category').value;
  const price = $('#f-price').value;
  const rows = data.tools.filter((t) => (!cat || t.category === cat) && (!price || t.pricing === price)
    && (!q || `${t.name} ${t.description} ${t.use}`.toLowerCase().includes(q)));
  $('#count').textContent = `${rows.length} ${rows.length === 1 ? 'tool' : 'tools'}`;
  list.innerHTML = rows.length ? rows.map(card).join('') : empty('No tools match', 'Try another search.');
}

await initCommunity();
data = await fetch('data/tools.json').then((r) => r.json());
$('#f-category').innerHTML = `<option value="">All categories</option>${Object.entries(data.categories).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}`;
$('#q').value = new URLSearchParams(location.search).get('q') ?? '';
for (const el of ['#q', '#f-category', '#f-price']) $(el).addEventListener('input', render);
$('#search').addEventListener('submit', (e) => e.preventDefault());
render();
