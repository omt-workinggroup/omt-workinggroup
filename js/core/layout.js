// Shared header, mobile menu, header search and footer. Every page calls initLayout().
import { icons } from './icons.js';
import { toast } from './util.js';
import { getFavorites, onFavoritesChange } from './favorites.js';
import { bindFavoriteButtons } from './render.js';

const NAV = [
  { href: 'index.html', label: 'Home', page: 'home' },
  { href: 'library.html', label: 'Explore Library', page: 'library' },
  { href: 'office.html', label: 'Microsoft Office', page: 'office' },
  { href: 'presentations.html', label: 'Presentations', page: 'presentations' },
  { href: 'assistant.html', label: 'AI Assistant', page: 'assistant' },
  { href: 'about.html', label: 'About', page: 'about' },
];

const MARK = '<img class="brand__mark" src="assets/logo-mark.svg" alt="" width="50" height="39">';
const LOGO = `${MARK}<span class="brand__word"><span>Operations Maintenance</span><span>and Training Working Group</span></span>`;
const LOGO_FULL = `${MARK}<span class="brand__word"><span>Operations</span><span>Maintenance</span><span>and Training</span><span>Working Group</span></span>`;

function navList(current) {
  return `<ul>${NAV.map((n) => `<li><a href="${n.href}"${n.page === current ? ' aria-current="page"' : ''}>${n.label}</a></li>`).join('')}</ul>`;
}

function headerHTML(current) {
  return `<div class="container site-header__inner">
    <a class="brand" href="index.html" aria-label="OMT WORKING GROUP home">${LOGO}</a>
    <nav class="nav" aria-label="Main">${navList(current)}</nav>
    <div class="header-actions">
      <button type="button" class="icon-btn" id="search-toggle" aria-expanded="false" aria-controls="header-search" aria-label="Search the library">${icons.search}</button>
      <a class="icon-btn" href="favorites.html" aria-label="Favorites" id="fav-link">${icons.heart}<span class="fav-count" id="fav-count" hidden></span></a>
      <a class="btn btn--ai btn--sm header-ai" href="assistant.html">${icons.sparkle}Ask AI</a>
      <button type="button" class="icon-btn menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="drawer" aria-label="Open menu">${icons.menu}</button>
    </div>
  </div>
  <div class="header-search" id="header-search" hidden>
    <div class="container">
      <form class="search" action="library.html" method="get" role="search">
        <label class="sr-only" for="header-q">Search the library</label>
        <div class="search__field">${icons.search}<input class="input" id="header-q" name="q" type="search" placeholder="Search books, topics, Word, Excel…" autocomplete="off" maxlength="200"></div>
        <button class="btn btn--primary" type="submit">Search</button>
      </form>
    </div>
  </div>`;
}

function drawerHTML(current) {
  return `<div class="drawer__backdrop" data-close></div>
  <div class="drawer__panel" role="dialog" aria-modal="true" aria-label="Menu">
    <div class="drawer__top"><a class="brand" href="index.html">${LOGO}</a>
      <button type="button" class="icon-btn" data-close aria-label="Close menu">${icons.close}</button></div>
    <nav aria-label="Mobile">${navList(current)}<ul><li><a href="favorites.html">Favorites</a></li></ul></nav>
    <a class="btn btn--ai btn--block" href="assistant.html">${icons.sparkle}Ask OMT AI</a>
  </div>`;
}

function footerHTML() {
  const year = new Date().getFullYear();
  return `<div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand brand--full" href="index.html" aria-label="OMT WORKING GROUP home">${LOGO_FULL}</a>
        <p>OMT (Operations Maintenance and Training) Working Group: a free tech library for developers, network and telecom engineers, sysadmins and every IT lover. Books, courses, standards, Office skills and an AI assistant.</p>
      </div>
      <div><h2>Explore</h2><ul>
        <li><a href="library.html">Explore Library</a></li>
        <li><a href="office.html">Microsoft Office</a></li>
        <li><a href="presentations.html">Presentations</a></li>
        <li><a href="assistant.html">AI Assistant</a></li>
        <li><a href="favorites.html">Your favorites</a></li></ul></div>
      <div><h2>About</h2><ul>
        <li><a href="about.html">About OMT WORKING GROUP</a></li>
        <li><a href="about.html#contact">Contact</a></li>
        <li><a href="about.html#copyright">Report a copyright issue</a></li></ul></div>
      <div><h2>Legal</h2><ul>
        <li><a href="privacy.html">Privacy Policy</a></li>
        <li><a href="terms.html">Terms of Use</a></li>
        <li><a href="terms.html#attribution">Resource attribution</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <p>© ${year} OMT WORKING GROUP. We are not the authors: every book and resource belongs to its author and publisher, and OMT links to their official sources.</p>
      <p>Microsoft, Word, Excel, PowerPoint, Access and Outlook are trademarks of Microsoft Corporation. OMT WORKING GROUP is an independent platform, not affiliated with Microsoft.</p>
    </div>
  </div>`;
}

function tabbarHTML(current) {
  const tab = (href, page, icon, label) => `<a class="tabbar__item" href="${href}"${page === current ? ' aria-current="page"' : ''}>${icons[icon]}<span>${label}</span></a>`;
  return `${tab('index.html', 'home', 'home', 'Home')}
    ${tab('library.html', 'library', 'compass', 'Explore')}
    <a class="tabbar__fab" href="assistant.html"${current === 'assistant' ? ' aria-current="page"' : ''}><span class="tabbar__fab-btn">${icons.sparkle}</span><span>Ask AI</span></a>
    ${tab('office.html', 'office', 'briefcase', 'Office')}
    <a class="tabbar__item" href="favorites.html"${current === 'favorites' ? ' aria-current="page"' : ''}>${icons.heart}<span>Saved</span><b class="tabbar__count" id="tab-fav-count" hidden></b></a>`;
}

function updateFavCount() {
  const el = document.getElementById('fav-count');
  if (!el) return;
  const n = getFavorites().length;
  el.textContent = n > 99 ? '99+' : String(n);
  el.hidden = n === 0;
  const tabCount = document.getElementById('tab-fav-count');
  if (tabCount) { tabCount.textContent = el.textContent; tabCount.hidden = n === 0; }
  document.getElementById('fav-link')?.setAttribute('aria-label', n ? `Favorites (${n} saved)` : 'Favorites');
}

function setupDrawer() {
  const drawer = document.getElementById('drawer');
  const toggle = document.getElementById('menu-toggle');
  let lastFocus = null;
  const open = () => {
    lastFocus = document.activeElement;
    drawer.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    drawer.querySelector('[data-close].icon-btn')?.focus();
  };
  const close = () => {
    drawer.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    (lastFocus ?? toggle).focus();
  };
  toggle.addEventListener('click', open);
  drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key !== 'Tab') return;
    const focusable = [...drawer.querySelectorAll('a, button')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  window.matchMedia('(min-width: 1200px)').addEventListener('change', (m) => { if (m.matches && !drawer.hidden) close(); });
}

function setupHeaderSearch() {
  const toggle = document.getElementById('search-toggle');
  const panel = document.getElementById('header-search');
  const input = document.getElementById('header-q');
  const set = (open) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
  };
  toggle.addEventListener('click', () => set(panel.hidden));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); toggle.focus(); } });
  panel.querySelector('form').addEventListener('submit', (e) => {
    if (!input.value.trim()) { e.preventDefault(); input.focus(); }
  });
}

// Images with data-fallback (Microsoft's CDN icons) switch to the local copy if they fail to load.
document.addEventListener('error', (event) => {
  const img = event.target;
  if (img instanceof HTMLImageElement && img.dataset.fallback && !img.dataset.fellBack) {
    img.dataset.fellBack = '1';
    img.src = img.dataset.fallback;
  }
}, true);

/** Fetch a page as soon as the visitor points at or touches its link, so the click opens it instantly. */
function setupPrefetch() {
  const done = new Set([location.pathname]);
  const prefetch = (event) => {
    const a = event.target.closest?.('a[href]');
    if (!a || a.target === '_blank' || a.origin !== location.origin || done.has(a.pathname)) return;
    if (!/(\.html|\/)$/.test(a.pathname)) return;
    done.add(a.pathname);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = a.pathname;
    document.head.append(link);
  };
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('touchstart', prefetch, { passive: true });
  document.addEventListener('focusin', prefetch);
}

export function initLayout() {
  // Static images may have failed before this script ran.
  document.querySelectorAll('img[data-fallback]').forEach((img) => {
    if (img.complete && img.naturalWidth === 0 && !img.dataset.fellBack) { img.dataset.fellBack = '1'; img.src = img.dataset.fallback; }
  });
  const page = document.body.dataset.page ?? '';
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) header.innerHTML = headerHTML(page);
  if (footer) footer.innerHTML = footerHTML();

  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.id = 'drawer';
  drawer.hidden = true;
  drawer.innerHTML = drawerHTML(page);
  document.body.append(drawer);

  const tabbar = document.createElement('nav');
  tabbar.className = 'tabbar';
  tabbar.setAttribute('aria-label', 'Quick navigation');
  tabbar.innerHTML = tabbarHTML(page);
  document.body.append(tabbar);
  document.body.classList.add('has-tabbar');

  setupDrawer();
  setupHeaderSearch();
  setupPrefetch();
  updateFavCount();
  onFavoritesChange(updateFavCount);
  bindFavoriteButtons();

  // Show a clear message when the device goes offline.
  window.addEventListener('offline', () => toast('You are offline. Some features may not work.'));
  window.addEventListener('online', () => toast('You are back online.'));
}

