import { initLayout } from '../core/layout.js';
import { appIconHTML } from '../core/appicons.js';
import { loadCatalog } from '../core/catalog.js';
import { CATEGORIES, TECH } from '../core/taxonomy.js';
import { icons } from '../core/icons.js';
import { renderCards, skeletons, stateHTML, cardHTML, posterHTML, accessBadge, resourceUrl } from '../core/render.js';
import { getRecent, timeAgo } from '../core/recent.js';
import { watchCovers } from '../core/covers.js';
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
  ...TECH.map((slug) => ({ ...CATEGORIES[slug], slug, href: `library.html?category=${slug}` })),
  { label: 'Free Tech Books', href: 'library.html?kind=book', short: 'BK', color: '#0f2a4a', icon: 'book', description: 'Open textbooks and free online editions.' },
  { label: 'Standards & Specs', href: 'library.html?kind=standard', short: 'STD', color: '#4338ca', icon: 'flag', description: '3GPP, ITU-T, NIST and OWASP references.' },
  { label: 'Microsoft Office', href: 'office.html', short: 'MS', color: '#2b579a', slug: 'word', office: true, description: 'Word, Excel, PowerPoint, Access and Outlook.' },
  ...['business', 'study-skills'].map((slug) => ({ ...CATEGORIES[slug], slug, href: `library.html?category=${slug}` })),
];
document.getElementById('home-categories').innerHTML = HOME_CATEGORIES.map((c) => `
  <a class="cat-card" href="${c.href}">
    ${c.office ? appIconHTML(c.slug, 42, 'cat-card__app') : `<span class="cat-card__icon" style="background:${c.color}" aria-hidden="true">${c.icon ? icons[c.icon] : e(c.short)}</span>`}
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
  renderMobile(all);
  watchCovers(document.getElementById('main'), all);
} catch (err) {
  document.getElementById('m-rail').innerHTML = stateHTML({ title: 'Resources unavailable', text: err.message, error: true });
  featured.innerHTML = stateHTML({ title: 'Resources unavailable', text: err.message, error: true, action: '<button type="button" class="btn btn--secondary" id="retry">Try again</button>' });
  recent.innerHTML = '';
  document.getElementById('retry')?.addEventListener('click', () => location.reload());
}

// ---------- Mobile app-style home ----------
function renderMobile(all) {
  const hour = new Date().getHours();
  document.getElementById('m-greeting').textContent = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'} 👋`;
  document.querySelector('.m-search__btn').innerHTML = icons.sparkle;
  document.querySelector('.m-ai__icon').innerHTML = icons.sparkle;

  // Featured banner carousel
  const banner = document.getElementById('m-banner');
  const dots = document.getElementById('m-dots');
  const picks = ['cn-systems-approach', 'private-5g', 'omt-subnetting', 'google-sre', 'pro-git', 'tlcl']
    .map((id) => all.find((r) => r.id === id)).filter(Boolean);
  banner.innerHTML = picks.map((r, i) => `
    <a class="m-banner__slide" href="${resourceUrl(r)}" aria-roledescription="slide" aria-label="${e(r.title)}, ${i + 1} of ${picks.length}">
      <span class="m-banner__text">
        <span class="m-pill">${icons.sparkle.replace('<svg', '<svg width="13" height="13"')} Featured</span>
        <strong>${e(r.title)}</strong>
        <span class="m-banner__by">${e(r.author)}${/^\d{4}$/.test(r.year) ? ` (${e(r.year)})` : ''}</span>
        <span class="m-banner__more">Read more ${icons.chevron.replace('<svg', '<svg width="14" height="14"')}</span>
      </span>
      <span class="m-banner__cover cover"${r.kind === 'book' ? ` data-book="${e(r.id)}"` : ''} style="--cover-bg:${CATEGORIES[r.category]?.color}">${posterHTML(r)}</span>
    </a>`).join('');
  dots.innerHTML = picks.map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('');
  banner.addEventListener('scroll', () => {
    const i = Math.round(banner.scrollLeft / banner.clientWidth);
    [...dots.children].forEach((d, j) => d.classList.toggle('on', i === j));
  }, { passive: true });

  // Topic tabs + rail
  const byCat = (...cats) => () => all.filter((r) => cats.includes(r.category));
  const TABS = [
    ['All', () => all.filter((r) => r.featured).concat(all.filter((r) => !r.featured && CATEGORIES[r.category]?.tech)), 'library.html'],
    ['Dev', byCat('computer-science'), 'library.html?category=computer-science'],
    ['Networking', byCat('networking'), 'library.html?category=networking'],
    ['Telecom & 5G', byCat('telecom'), 'library.html?category=telecom'],
    ['Cloud', byCat('cloud'), 'library.html?category=cloud'],
    ['Security', byCat('security'), 'library.html?category=security'],
    ['Data & AI', byCat('data-ai'), 'library.html?category=data-ai'],
    ['Linux', byCat('linux'), 'library.html?category=linux'],
    ['Office', () => all.filter((r) => CATEGORIES[r.category]?.office || r.category === 'presentations'), 'office.html'],
    ['Books', () => all.filter((r) => r.kind === 'book'), 'library.html?kind=book'],
  ];
  const tabs = document.getElementById('m-tabs');
  const rail = document.getElementById('m-rail');
  tabs.innerHTML = TABS.map(([label], i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-tab="${i}">${label}</button>`).join('');
  const showTab = (i) => {
    const [label, pick, href] = TABS[i];
    const list = pick().slice(0, 10);
    rail.innerHTML = list.map(cardHTML).join('') + `<a class="m-more" href="${href}">See all ${e(label === 'All' ? 'resources' : label)} ${icons.chevron}</a>`;
    rail.scrollLeft = 0;
    tabs.querySelectorAll('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(Number(t.dataset.tab) === i)));
  };
  tabs.addEventListener('click', (ev) => { const t = ev.target.closest('[data-tab]'); if (t) showTab(Number(t.dataset.tab)); });
  showTab(0);

  // Continue exploring: real recently viewed items, or a starter list.
  const recent = getRecent().map((x) => ({ r: all.find((a) => a.id === x.id), t: x.t })).filter((x) => x.r).slice(0, 3);
  const rows = recent.length ? recent : ['omt-subnetting', 'omt-linux-commands', 'omt-mobile-generations'].map((id) => ({ r: all.find((a) => a.id === id) })).filter((x) => x.r);
  if (!recent.length) document.getElementById('m-continue-h').textContent = 'Start here';
  document.getElementById('m-continue').innerHTML = rows.map(({ r, t }) => `
    <a class="m-row" href="${resourceUrl(r)}">
      <span class="m-row__cover cover"${r.kind === 'book' ? ` data-book="${e(r.id)}"` : ''} style="--cover-bg:${CATEGORIES[r.category]?.color}">${posterHTML(r)}</span>
      <span class="m-row__body">
        <span class="m-row__tag">${t ? `${icons.clock.replace('<svg', '<svg width="12" height="12"')} Viewed ${timeAgo(t)}` : 'Start here'}</span>
        <strong>${e(r.title)}</strong>
        <span class="m-row__by">${e(r.author)}</span>
        ${accessBadge(r.accessType)}
      </span>
      <span class="m-row__go">${icons.chevron}</span>
    </a>`).join('');

  // Learning tracks (icon tiles)
  document.getElementById('m-tracks').innerHTML = TECH.map((slug) => {
    const c = CATEGORIES[slug];
    return `<a href="library.html?category=${slug}" style="--app:${c.color}"><b>${icons[c.icon]}</b><span>${e(c.label.split(' & ')[0])}</span></a>`;
  }).join('') + `<a href="library.html?kind=standard" style="--app:#4338ca"><b>${icons.flag}</b><span>Standards</span></a>`;

  // Free templates rail
  document.getElementById('m-templates').innerHTML = all.filter((r) => r.accessType === 'omt' && r.downloadUrl).map(cardHTML).join('');
}
