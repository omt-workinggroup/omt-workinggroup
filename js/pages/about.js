import { initLayout } from '../core/layout.js';

initLayout();

// Submissions are handled by Netlify Forms on the deployed site (see README).
const sent = new URLSearchParams(location.search).get('sent');
if (sent) {
  const status = document.querySelector(`.form-status[data-form="${CSS.escape(sent)}"]`);
  if (status) status.textContent = 'Thank you, your message was sent. We will reply by email.';
}

// A local copy has no form handler, so say so instead of posting into the void.
const isLocal = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
document.querySelectorAll('form[data-netlify]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!isLocal) return;
    event.preventDefault();
    form.querySelector('.form-status').textContent =
      'This is a local copy, so nothing was sent. Forms work once the site is deployed on Netlify.';
  });
});
