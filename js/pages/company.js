// Company homepage: mobile menu, footer year and the contact form (posts to /api/contact like the library's form).
document.getElementById('year').textContent = String(new Date().getFullYear());

const menu = document.getElementById('menu');
const nav = document.getElementById('nav');
const setMenu = (open) => {
  nav.classList.toggle('is-open', open);
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};
menu.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenu(false); });

const form = document.getElementById('contact-form');
const status = form.querySelector('.form__status');
const button = form.querySelector('button[type="submit"]');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const payload = { ...Object.fromEntries(new FormData(form)), kind: 'contact' };
  button.disabled = true;
  status.textContent = 'Sending…';
  try {
    const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json().catch(() => null);
    if (res.ok && result?.ok) {
      form.reset();
      status.textContent = 'Thank you, your message was sent. We will reply by email.';
    } else {
      status.textContent = result?.error?.message ?? 'Your message couldn\'t be sent. Please try again in a moment.';
    }
  } catch {
    status.textContent = navigator.onLine ? 'Your message couldn\'t be sent. Please try again in a moment.' : 'You appear to be offline. Please try again when you\'re connected.';
  } finally {
    button.disabled = false;
  }
});
