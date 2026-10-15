import { initLayout } from '../core/layout.js';

initLayout();

// Pre-select a topic when linked from elsewhere, e.g. about.html?topic=broken#contact
const topic = new URLSearchParams(location.search).get('topic');
if (topic === 'broken') document.getElementById('c-topic').value = 'Broken link';

// Forms post JSON to /api/contact, which stores them in Supabase.
document.querySelectorAll('form[data-kind]').forEach((form) => {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    const payload = { ...data, kind: form.dataset.kind, goodFaith: data.goodFaith === 'on' };
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
});
