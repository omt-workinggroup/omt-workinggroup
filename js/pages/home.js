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
    ? 'e.g. “a gentle first book on Python”'
    : 'subnetting, 5G core, Kubernetes, SQL…';
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

// ---------- Themed shelves (carousels) ----------
const LEVEL = { beginner: 0, intermediate: 1, advanced: 2 };
const byLevel = (a, b) => (LEVEL[a.level] ?? 1) - (LEVEL[b.level] ?? 1);
const freeFirst = (a, b) => Number(a.accessType === 'paid') - Number(b.accessType === 'paid');
const SHELVES = [
  { key: 'free', lead: 'ostep', no: '01', kicker: 'Free to read now', title: 'Open one tonight', blurb: 'Complete books you can read in full, free and legally, from the people who wrote them.', href: 'library.html?access=open', desktopOnly: true,
    pick: (all) => all.filter((r) => r.kind === 'book' && r.accessType === 'open' && r.cover) },
  { key: 'canva', lead: 'non-designers-design-book', no: '02', kicker: 'Canva tips', title: 'Design like you meant it', blurb: "Canva's own free lessons, then the classic books designers keep within reach: layout, type, colour and logos.", href: 'library.html?category=design',
    pick: (all) => all.filter((r) => r.category === 'design').sort(freeFirst) },
  { key: 'linux', lead: 'tlcl', no: '03', kicker: 'Linux overview', title: 'Learn the machine that runs the internet', blurb: 'From your first ls to kernel internals, in the order we would read them.', href: 'library.html?category=linux',
    pick: (all) => all.filter((r) => r.category === 'linux').sort((a, b) => byLevel(a, b) || freeFirst(a, b)) },
  { key: 'security', lead: 'cuckoos-egg', no: '04', kicker: 'Cybersecurity ebooks', title: 'Think like an attacker. Build like a defender.', blurb: 'True stories that read like thrillers, then the hands-on books security teams actually use.', href: 'library.html?category=security',
    pick: (all) => all.filter((r) => r.category === 'security' && r.kind === 'book').sort(byLevel) },
  { key: 'success', lead: 'atomic-habits', no: '05', kicker: 'Books on success', title: 'The long game', blurb: 'Habits, mindset and money, from the free 19th-century classics to the books everyone is still quoting.', href: 'library.html?category=success',
    pick: (all) => all.filter((r) => r.category === 'success').sort(freeFirst) },
];

function shelfBookHTML(r) {
  const access = { open: 'Free', official: 'Free', preview: 'Preview', paid: 'Buy or borrow', info: 'Info' }[r.accessType] ?? '';
  const cover = r.cover
    ? `<img src="${e(r.cover)}" alt="" decoding="async" width="360" height="520">`
    : `<span class="book__poster" style="--c:${CATEGORIES[r.category]?.color ?? '#334155'}"><small>${e(r.sourceName ?? '')}</small><b>${e(r.title)}</b><i>${e(r.author)}</i></span>`;
  return `<a class="book" href="${resourceUrl(r)}" role="listitem">
      <span class="book__cover">${cover}<span class="book__tag book__tag--${e(r.accessType)}">${access}</span></span>
      <span class="book__title">${e(r.title)}</span>
      <span class="book__by">${e(r.author)}</span>
    </a>`;
}

/** The shelf's spotlight: a wide card with the cover, a short description and a clear way in. */
function leadHTML(r) {
  const access = { open: 'Free to read', official: 'Free from the publisher', preview: 'Free preview', paid: 'Buy or borrow', info: 'Info' }[r.accessType] ?? '';
  const cover = r.cover ? `<img src="${e(r.cover)}" alt="" decoding="async" width="360" height="520">`
    : `<span class="book__poster" style="--c:${CATEGORIES[r.category]?.color ?? '#334155'}"><small>${e(r.sourceName ?? '')}</small><b>${e(r.title)}</b><i>${e(r.author)}</i></span>`;
  return `<a class="lead" href="${resourceUrl(r)}" role="listitem">
      <span class="book__cover lead__cover">${cover}</span>
      <span class="lead__body">
        <span class="lead__pick">Our pick</span>
        <span class="lead__title">${e(r.title)}</span>
        <span class="lead__by">${e(r.author)}${/^\d{4}$/.test(r.year ?? '') ? ` · ${e(r.year)}` : ''}</span>
        <span class="lead__desc">${e(r.description ?? '')}</span>
        <span class="lead__foot"><span class="book__tag book__tag--${e(r.accessType)}">${access}</span><span class="lead__go">Open the book →</span></span>
      </span>
    </a>`;
}

function renderShelves(all) {
  const host = document.getElementById('home-shelves');
  host.innerHTML = SHELVES.map((s) => {
    const picked = s.pick(all);
    const lead = picked.find((r) => r.id === s.lead) ?? picked[0];
    const list = [lead, ...picked.filter((r) => r !== lead)].slice(0, 50);
    if (!lead) return '';
    return `<section class="shelf-sec shelf-sec--${s.key}${s.desktopOnly ? ' d-only' : ''}" aria-labelledby="shelf-${s.key}">
      <div class="container">
        <div class="shelf-sec__head">
          <div class="shelf-sec__text">
            <p class="kicker"><span class="shelf-sec__no">No. ${s.no}</span> ${e(s.kicker)} <span class="shelf-sec__count">${picked.length} titles</span></p>
            <h2 id="shelf-${s.key}">${e(s.title)}</h2>
            <p>${e(s.blurb)}</p>
          </div>
          <div class="shelf-sec__nav">
            <button type="button" class="shelf-btn" data-dir="-1" aria-label="Scroll ${e(s.kicker)} back" disabled>${icons.chevron}</button>
            <button type="button" class="shelf-btn" data-dir="1" aria-label="Scroll ${e(s.kicker)} forward">${icons.chevron}</button>
            <a class="shelf-sec__all" href="${s.href}">See all →</a>
          </div>
        </div>
        <div class="shelf-rail" role="list" tabindex="0" aria-label="${e(s.kicker)}">${leadHTML(lead)}${list.slice(1).map(shelfBookHTML).join('')}</div>
      </div>
    </section>`;
  }).join('');

  host.querySelectorAll('.shelf-sec').forEach((sec) => {
    const rail = sec.querySelector('.shelf-rail');
    const [prev, next] = sec.querySelectorAll('.shelf-btn');
    const update = () => {
      prev.disabled = rail.scrollLeft < 8;
      next.disabled = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 8;
    };
    sec.querySelector('.shelf-sec__nav').addEventListener('click', (ev) => {
      const btn = ev.target.closest('.shelf-btn');
      if (btn) rail.scrollBy({ left: Number(btn.dataset.dir) * rail.clientWidth * 0.85, behavior: 'auto' });
    });
    rail.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(rail);
    update();
  });
}

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
    sources: new Set(all.map((r) => r.sourceName).filter(Boolean)).size,
  };
  for (const [key, value] of Object.entries(stats)) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = String(value);
  }
  renderCards(featured, all.filter((r) => r.featured).slice(0, 8));
  renderCards(recent, [...all].sort((a, b) => (b.added ?? '').localeCompare(a.added ?? '')).slice(0, 4));
  renderMobile(all);
  renderShelves(all);
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
  document.getElementById('m-greeting').textContent = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.querySelector('.m-search__btn').innerHTML = icons.sparkle;
  document.querySelector('.m-ai__icon').innerHTML = icons.sparkle;

  // Featured banner carousel
  const banner = document.getElementById('m-banner');
  const dots = document.getElementById('m-dots');
  const picks = ['cn-systems-approach', 'private-5g', 'google-sre', 'pro-git', 'tlcl', 'd2l']
    .map((id) => all.find((r) => r.id === id)).filter(Boolean);
  banner.innerHTML = picks.map((r, i) => `
    <a class="m-banner__slide" href="${resourceUrl(r)}" aria-roledescription="slide" aria-label="${e(r.title)}, ${i + 1} of ${picks.length}">
      <span class="m-banner__text">
        <span class="m-pill">Staff pick</span>
        <strong>${e(r.title)}</strong>
        <span class="m-banner__by">${e(r.author)}${/^\d{4}$/.test(r.year) ? ` (${e(r.year)})` : ''}</span>
        <span class="m-banner__more">Open the book ${icons.chevron.replace('<svg', '<svg width="14" height="14"')}</span>
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
  const rows = recent.length ? recent : ['net-intro', 'tlcl', 'missing-semester'].map((id) => ({ r: all.find((a) => a.id === id) })).filter((x) => x.r);
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

  // Free-to-read rail
  document.getElementById('m-templates').innerHTML = all.filter((r) => r.accessType === 'open' && r.kind === 'book').slice(0, 10).map(cardHTML).join('');
}
