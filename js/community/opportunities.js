// Opportunities hub: verified listings with filters. Expired deadlines are marked automatically.
import { initCommunity, api, esc, $, empty, loading, fmtDate } from './core.js';
import * as fallback from './fallback.js';

const CATS = { scholarship: 'Scholarship', internship: 'Internship', competition: 'Competition', hackathon: 'Hackathon', certification: 'Free certification', training: 'Training programme', volunteering: 'Volunteering', ambassador: 'Ambassador programme', mentorship: 'Mentorship', workshop: 'Workshop' };
const list = $('#opps');

function card(o) {
  const days = o.deadline ? Math.ceil((Date.parse(o.deadline) - Date.now()) / 86400000) : null;
  const deadline = o.expired ? '<span class="pill pill--bad">Expired</span>'
    : o.deadline ? `<span class="pill${days <= 14 ? ' pill--wait' : ''}">Deadline ${fmtDate(o.deadline)}${days <= 14 ? ` · ${days} ${days === 1 ? 'day' : 'days'} left` : ''}</span>`
    : '<span class="pill">Rolling · no fixed deadline</span>';
  return `<article class="ocard${o.expired ? ' ocard--expired' : ''}" id="o${o.id}">
    <p class="dcard__kind">${esc(CATS[o.category] ?? o.category)}</p>
    <h3>${esc(o.title)}</h3>
    <p class="ocard__org">${esc(o.organisation)}${o.location ? ` · ${esc(o.location)}` : ''}</p>
    <p>${esc(o.description)}</p>
    ${o.eligibility ? `<p class="ocard__elig"><b>Eligibility:</b> ${esc(o.eligibility)}</p>` : ''}
    <p class="pcard__foot">${deadline}${o.verified ? '<span class="pill pill--ok">Verified by OMT</span>' : ''}${o.last_checked ? `<span class="muted small">Last checked ${fmtDate(o.last_checked)}</span>` : ''}</p>
    ${o.expired ? '' : `<a class="btn btn--primary" href="${esc(o.apply_url)}" rel="noopener" target="_blank">Apply on the official site</a>`}
  </article>`;
}

async function load() {
  list.innerHTML = loading();
  const f = new FormData($('#filters'));
  const query = { category: f.get('category'), region: f.get('region'), audience: f.get('audience'), field: f.get('field'), include_expired: f.get('expired') === 'on' };
  try {
    const rows = await api('opportunities', { query }).catch((err) => { if (err.code === 'not_ready') return fallback.opportunities(query); throw err; });
    list.innerHTML = rows.length ? rows.map(card).join('') : empty('No matching opportunities', 'Try fewer filters. New verified listings are added regularly.');
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  } catch (err) { list.innerHTML = empty('Could not load', err.message); }
}

await initCommunity();
$('#f-category').innerHTML = `<option value="">All types</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}`;
$('#filters').addEventListener('change', load);
load();
