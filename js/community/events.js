// Events and tech calendar: verified events as a list or a month calendar. Students can save events.
import { initCommunity, api, esc, $, empty, loading, toast, requireSignIn, fmtDate } from './core.js';

const CATS = { workshop: 'Workshop', webinar: 'Webinar', conference: 'Conference', coding: 'Coding session', competition: 'Competition', hackathon: 'Hackathon', programme: 'Programme', meetup: 'Meetup' };
let events = [];
let view = 'list';
let month = new Date(); month.setDate(1);

const time = (e) => new Date(e.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: e.timezone || 'UTC' });
function card(e) {
  return `<article class="ocard" id="e${e.id}">
    <p class="dcard__kind">${esc(CATS[e.category] ?? e.category)} · ${e.online ? 'Online' : esc(e.location ?? 'In person')}</p>
    <h3>${esc(e.title)}</h3>
    <p class="ocard__org">${time(e)} (${esc(e.timezone)}) · ${esc(e.organiser)}</p>
    <p>${esc(e.description)}</p>
    <p class="pcard__foot">${e.reg_deadline ? `<span class="pill">Register by ${fmtDate(e.reg_deadline)}</span>` : ''}${e.verified ? '<span class="pill pill--ok">Verified by OMT</span>' : ''}</p>
    <p class="hero__actions">${e.register_url ? `<a class="btn btn--primary" href="${esc(e.register_url)}" rel="noopener" target="_blank">Register</a>` : ''}
      <button class="btn btn--outline" data-save="${e.id}" aria-pressed="${!!e.saved}">${e.saved ? 'Saved' : 'Save event'}</button></p>
  </article>`;
}

function calendar() {
  const y = month.getFullYear(); const m = month.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(y, m + 1, 0).getDate();
  const byDay = {};
  for (const e of events) { const d = new Date(e.starts_at); if (d.getFullYear() === y && d.getMonth() === m) (byDay[d.getDate()] ??= []).push(e); }
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<li class="cal__pad" aria-hidden="true"></li>';
  for (let d = 1; d <= days; d++) cells += `<li class="${byDay[d] ? 'cal__has' : ''}"><span>${d}</span>${(byDay[d] ?? []).map((e) => `<a href="#e${e.id}" data-jump="${e.id}">${esc(e.title)}</a>`).join('')}</li>`;
  return `<div class="cal__head"><button class="act" data-month="-1" aria-label="Previous month">&larr;</button><h3>${month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3><button class="act" data-month="1" aria-label="Next month">&rarr;</button></div>
    <ol class="cal__grid"><li class="cal__dow">Mon</li><li class="cal__dow">Tue</li><li class="cal__dow">Wed</li><li class="cal__dow">Thu</li><li class="cal__dow">Fri</li><li class="cal__dow">Sat</li><li class="cal__dow">Sun</li>${cells}</ol>`;
}

function render() {
  $('#cal').hidden = view !== 'calendar';
  if (view === 'calendar') $('#cal').innerHTML = calendar();
  $('#events').innerHTML = events.length ? events.map(card).join('') : empty('No upcoming events yet', 'OMT only lists events we have checked. New ones are added as they are confirmed.');
}

async function load() {
  $('#events').innerHTML = loading();
  try { events = await api('events', { query: { category: $('#f-category').value } }); render(); }
  catch (err) { $('#events').innerHTML = empty('Could not load', err.message); }
}

await initCommunity();
$('#f-category').innerHTML = `<option value="">All events</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}`;
$('#f-category').addEventListener('change', load);
for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => { view = b.dataset.view; document.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); });
document.addEventListener('click', async (e) => {
  const m = e.target.closest('[data-month]');
  if (m) { month.setMonth(month.getMonth() + Number(m.dataset.month)); render(); return; }
  const s = e.target.closest('[data-save]');
  if (s && requireSignIn('Sign in to save events.')) {
    try { const r = await api('event_save', { id: Number(s.dataset.save) }); const ev = events.find((x) => x.id === Number(s.dataset.save)); ev.saved = r.saved; render(); toast(r.saved ? 'Saved to My Space.' : 'Removed.'); }
    catch (err) { toast(err.message, 'error'); }
  }
});
load();
