// Community core: the student's session, calls to /api/community, and the small UI pieces every community
// page shares (post cards, toasts, the sign-in prompt, the header account link).
import { initShell } from '../core/shell.js';

const SESSION = 'omt.session';
const ME = 'omt.me';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export const session = () => read(SESSION);
export const cachedMe = () => (session() ? read(ME) : null);
export function saveSession(s, me) { write(SESSION, s); if (me !== undefined) write(ME, me); }
export function clearSession() { write(SESSION, null); write(ME, null); }

async function post(body, token) {
  const res = await fetch('/api/community', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { res, data };
}

let refreshing = null;
async function freshToken() {
  const s = session();
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  refreshing ??= post({ action: 'refresh', refresh_token: s.refresh_token }).then(({ res, data }) => {
    refreshing = null;
    if (res.ok && data?.ok) { write(SESSION, data.data); return data.data.access_token; }
    clearSession();
    return null;
  });
  return refreshing;
}

export class ApiError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

/** Calls a community action. Throws ApiError with a message that can be shown to the student. */
export async function api(action, payload = {}) {
  const token = await freshToken();
  let { res, data } = await post({ action, ...payload }, token);
  if (res.status === 401 && data?.error?.code === 'expired' && session()) {
    clearSession();
    ({ res, data } = await post({ action, ...payload }));
  }
  if (!res.ok || !data?.ok) {
    if (!data) throw new ApiError('offline', navigator.onLine ? 'The community is not reachable right now. Please try again.' : 'You appear to be offline.', res.status);
    throw new ApiError(data.error?.code, data.error?.message ?? 'Something went wrong.', res.status);
  }
  return data.data;
}

export async function loadMe() {
  if (!session()) return null;
  try {
    const me = await api('me');
    write(ME, me);
    return me;
  } catch (err) {
    if (err.status === 401) clearSession();
    return cachedMe();
  }
}

// ---------- Small UI helpers ----------
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);

export function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function toast(message, kind = 'info') {
  let host = $('#toasts');
  if (!host) { host = Object.assign(document.createElement('div'), { id: 'toasts', className: 'toasts' }); host.setAttribute('role', 'status'); document.body.append(host); }
  const t = Object.assign(document.createElement('p'), { className: `toast toast--${kind}`, textContent: message });
  host.append(t);
  setTimeout(() => t.remove(), 4200);
}

export const LABELS = {
  general: 'General', programming: 'Programming', cybersecurity: 'Cybersecurity', networking: 'Networking', ai: 'AI', design: 'Design and creativity',
  'student-life': 'Student life', career: 'Career', help: 'Questions and help', projects: 'Project talk',
  website: 'Website', mobile: 'Mobile app', software: 'Software', robotics: 'Robotics', data: 'Data analysis', creative: 'Creative tech', hardware: 'Hardware',
};
export const POST_CATEGORIES = ['general', 'programming', 'cybersecurity', 'networking', 'ai', 'design', 'student-life', 'career', 'help', 'projects'];
export const PROJECT_CATEGORIES = ['website', 'mobile', 'design', 'software', 'robotics', 'data', 'ai', 'creative', 'hardware'];

const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONS = {
  like: icon('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  comment: icon('<path d="M4 5h16v11H9l-5 4z"/>'),
  bookmark: icon('<path d="M6 3h12v18l-6-4-6 4z"/>'),
  check: icon('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  flag: icon('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  link: icon('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  code: icon('<path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>'),
};

const initials = (name) => esc(String(name ?? '?').replace(/_/g, ' ').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
export const avatar = (author) => `<span class="avatar" aria-hidden="true">${initials(author?.name || author?.handle)}</span>`;
export function authorLink(author) {
  const name = esc(author?.name || author?.handle || 'Student');
  const badge = author && ['moderator', 'admin', 'super_admin'].includes(author.role) ? ' <span class="pill pill--staff">OMT team</span>' : author?.role === 'contributor' ? ' <span class="pill">Contributor</span>' : '';
  return author?.public ? `<a href="my-space.html?u=${encodeURIComponent(author.handle)}">${name}</a>${badge}` : `<span>${name}</span>${badge}`;
}

export function postCard(p) {
  const href = `post.html?id=${p.id}`;
  const kind = p.kind === 'question' ? (p.accepted ? '<span class="pill pill--ok">Answered</span>' : p.comments ? '' : '<span class="pill pill--wait">Needs an answer</span>') : '';
  const status = p.status && p.status !== 'published' ? `<span class="pill pill--wait">${p.status === 'pending' ? 'Waiting for review' : esc(p.status)}</span>` : '';
  const stack = p.stack?.length ? `<p class="stack">${p.stack.map((s) => `<span>${esc(s)}</span>`).join('')}</p>` : '';
  return `<article class="pcard${p.kind === 'project' ? ' pcard--project' : ''}">
    ${p.kind === 'project' ? `<a class="pcard__cover pcard__cover--${esc(p.category)}" href="${href}" tabindex="-1" aria-hidden="true">${ICONS.code}<span>${esc(LABELS[p.category] ?? p.category)}</span></a>` : ''}
    <div class="pcard__body">
      <p class="pcard__meta">${avatar(p.author)}<span>${authorLink(p.author)} · <time datetime="${esc(p.created_at)}">${ago(p.created_at)}</time></span></p>
      <h3><a href="${href}">${esc(p.title)}</a></h3>
      <p class="pcard__excerpt">${esc(p.excerpt)}${p.excerpt?.length >= 240 ? '…' : ''}</p>
      ${stack}
      <p class="pcard__foot"><span class="pill">${esc(LABELS[p.category] ?? p.category)}</span>${p.featured ? '<span class="pill pill--ok">Featured</span>' : ''}${p.beginner ? '<span class="pill">Beginner-friendly</span>' : ''}${kind}${status}
        <span class="pcard__stats"><span title="Likes">${ICONS.like}${p.likes}</span><span title="${p.kind === 'question' ? 'Answers' : 'Comments'}">${ICONS.comment}${p.comments}</span></span></p>
    </div>
  </article>`;
}

export const empty = (title, text, action = '') => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
export const loading = () => '<div class="skeleton" aria-hidden="true"><span></span><span></span><span></span></div><p class="sr-only">Loading…</p>';

/** Asks a signed-out student to sign in; returns true when signed in. */
export function requireSignIn(message = 'Sign in to take part.') {
  if (session()) return true;
  toast(message);
  location.href = `account.html?next=${encodeURIComponent(location.pathname.replace(/^\//, '') + location.search)}`;
  return false;
}

export function fmtDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString('en-GB', opts);
}

/** Every community page: menu, theme, header account link, sub-navigation. */
export async function initCommunity() {
  initShell();
  const link = $('#account-link');
  const paint = (me) => {
    if (!link) return;
    link.textContent = me ? (me.name || me.handle) : 'Sign in';
    link.href = me ? 'my-space.html' : 'account.html';
    const mod = $('#mod-link');
    if (mod) mod.hidden = !me?.staff;
  };
  paint(cachedMe());
  const me = await loadMe();
  paint(me);
  return me;
}
