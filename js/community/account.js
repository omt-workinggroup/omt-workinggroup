// Sign in, create an account, or reset a password.
import { initCommunity, api, $, toast, saveSession, session } from './core.js';

const next = (() => { const n = new URLSearchParams(location.search).get('next') ?? ''; return /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?(#[\w-]*)?$/i.test(n) ? n : 'community.html'; })();

function tab(name) {
  for (const t of document.querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', String(t.dataset.tab === name));
  for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
}

async function finish(s, me) {
  saveSession(s, me ?? null);
  if (!me) {
    me = await api('me');
    if (!me) { // confirmed by email after sign-up: finish the profile with the username chosen at sign-up
      const handle = sessionStorage.getItem('omt.pending_handle') || prompt('Choose a username (3–24 letters, numbers or underscores):');
      me = await api('profile_init', { handle });
    } else if (me && !me.interests?.length) { /* first visit: nudge to My Space */ }
    saveSession(s, me);
  }
  toast(`Welcome, ${me.name || me.handle}!`, 'ok');
  location.href = me.interests?.length ? next : 'my-space.html#settings';
}

function bind(form, handler) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const status = form.querySelector('.form__status');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Please wait…';
    try { await handler(new FormData(form), status); }
    catch (err) { status.textContent = err.message; }
    finally { button.disabled = false; }
  });
}

await initCommunity();
if (session()) location.replace('my-space.html');
for (const t of document.querySelectorAll('[data-tab]')) t.addEventListener('click', () => tab(t.dataset.tab));
tab(location.hash === '#join' ? 'join' : 'signin');

bind($('#signin-form'), async (f) => {
  const s = await api('login', { email: f.get('email'), password: f.get('password') });
  await finish(s);
});
bind($('#join-form'), async (f, status) => {
  const handle = f.get('handle');
  const r = await api('signup', { email: f.get('email'), password: f.get('password'), handle, over13: f.get('over13') === 'on', consent: f.get('consent') === 'on' });
  if (r.confirm) {
    try { sessionStorage.setItem('omt.pending_handle', handle); } catch { /* ignore */ }
    status.textContent = 'Check your email and click the confirmation link, then sign in here.';
    tab('signin');
    $('#signin-form .form__status').textContent = 'Account created. Confirm your email, then sign in.';
    return;
  }
  await finish(r.session, r.me);
});
bind($('#reset-form'), async (f, status) => {
  await api('recover', { email: f.get('email') });
  status.textContent = 'If an account exists for that email, a reset link is on its way.';
});
