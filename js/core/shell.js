// Shared behaviour of the company and community pages: mobile menu, footer year, light/dark theme toggle,
// and the account link in the header.
export function initShell() {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const menu = document.getElementById('menu');
  const nav = document.getElementById('nav');
  if (menu && nav) {
    const setMenu = (open) => {
      nav.classList.toggle('is-open', open);
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.documentElement.classList.toggle('menu-open', open);
    };
    menu.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenu(false); });
  }

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    const sync = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    };
    toggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('omt.theme', next); } catch { /* private mode */ }
      sync();
    });
    sync();
  }
}
