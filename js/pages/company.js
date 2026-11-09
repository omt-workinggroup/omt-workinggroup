// Company pages (home, about, services, training, contact, join): mobile menu, footer year,
// and the registration and contact forms on the pages that have them.
import { bindRegisterForm } from '../core/register-form.js';
import { initShell } from '../core/shell.js';

// Old links to sections of the one-page homepage now open the section's own page.
const MOVED = { '#about': 'about-us.html', '#omt': 'about-us.html', '#values': 'about-us.html', '#services': 'services.html', '#process': 'services.html', '#training': 'training.html', '#contact': 'contact.html', '#register': 'join.html' };
if (document.body.dataset.page === 'home' && MOVED[location.hash]) location.replace(MOVED[location.hash]);

const registerForm = document.getElementById('register-form');
if (registerForm) bindRegisterForm(registerForm);
initShell();

const form = document.getElementById('contact-form');
if (form) {
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
}
