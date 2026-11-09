// OMT Student Community API: POST /api/community {action, ...}
//
// Sign-in uses Supabase Auth (email + password). Every other action calls one of the c_* database
// functions with the student's own access token, so the database checks who they are, their role,
// rate limits and moderation rules (supabase/migrations/20261109_community.sql). This module adds a
// second layer: an allowlist of actions, input checks, per-IP rate limits and friendly error messages.
import { fail, json, createRateLimiter } from './http.mjs';

const MESSAGES = {
  not_signed_in: 'Please sign in first.',
  suspended: 'This account is suspended. Contact OMT if you think this is a mistake.',
  forbidden: 'You do not have permission to do that.',
  bad_handle: 'Usernames are 3–24 letters, numbers or underscores.',
  handle_taken: 'That username is taken. Try another.',
  blocked_words: 'Please keep it friendly: your text contains words that are not allowed here.',
  too_many_links: 'Too many links in one post.',
  rate_limited: 'You are posting very fast. Take a short break and try again later.',
  bad_kind: 'Unknown post type.',
  bad_category: 'Please choose a category.',
  not_found: 'That item is no longer available.',
  not_allowed: 'That action is not allowed.',
  not_today: 'That challenge is not open today.',
  bad_choice: 'Please choose an answer.',
  bad_type: 'Unknown report type.',
  bad_id: 'Unknown item.',
  bad_action: 'Unknown action.',
  bad_role: 'Unknown role.',
};

// action -> [database function, who may call it, how to build its arguments]
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const ACTIONS = {
  home: ['c_home', 'any', () => ({})],
  feed: ['c_feed', 'any', (b) => ({ p: obj(b.query) })],
  post: ['c_post', 'any', (b) => ({ p_id: int(b.id) })],
  opportunities: ['c_opportunities', 'any', (b) => ({ p: obj(b.query) })],
  events: ['c_events', 'any', (b) => ({ p: obj(b.query) })],
  challenges: ['c_challenges', 'any', () => ({})],
  leaderboard: ['c_leaderboard', 'any', () => ({})],
  profile: ['c_public_profile', 'any', (b) => ({ p_handle: str(b.handle, 24) })],
  me: ['c_me', 'user', () => ({})],
  profile_init: ['c_profile_init', 'user', (b) => ({ p_handle: str(b.handle, 24) })],
  profile_save: ['c_profile_save', 'user', (b) => ({ p: obj(b.profile) })],
  my_space: ['c_my_space', 'user', () => ({})],
  post_create: ['c_post_create', 'user', (b) => ({ p: obj(b.post) })],
  post_delete: ['c_post_delete', 'user', (b) => ({ p_id: int(b.id) })],
  comment_create: ['c_comment_create', 'user', (b) => ({ p_post: int(b.post), p_body: str(b.body, 3000) })],
  comment_delete: ['c_comment_delete', 'user', (b) => ({ p_id: int(b.id) })],
  like: ['c_like', 'user', (b) => ({ p_post: int(b.id) })],
  vote: ['c_vote', 'user', (b) => ({ p_comment: int(b.id) })],
  bookmark: ['c_bookmark', 'user', (b) => ({ p_post: int(b.id) })],
  accept: ['c_accept', 'user', (b) => ({ p_post: int(b.post), p_comment: int(b.comment) })],
  report: ['c_report', 'user', (b) => ({ p_type: str(b.type, 10), p_id: str(String(b.id ?? ''), 64), p_reason: str(b.reason, 500) })],
  block: ['c_block', 'user', (b) => ({ p_handle: str(b.handle, 24) })],
  event_save: ['c_event_save', 'user', (b) => ({ p_event: int(b.id) })],
  challenge_submit: ['c_challenge_submit', 'user', (b) => ({ p_id: str(b.id, 10), p_choice: Number.isInteger(b.choice) ? b.choice : -1 })],
  mod_queue: ['c_mod_queue', 'user', () => ({})],
  mod_decide: ['c_mod_decide', 'user', (b) => ({ p: obj(b.decision) })],
  mod_report_close: ['c_mod_report_close', 'user', (b) => ({ p_id: int(b.id) })],
  mod_users: ['c_mod_users', 'user', (b) => ({ p_q: str(b.q, 40) })],
  mod_user: ['c_mod_user', 'user', (b) => ({ p_handle: str(b.handle, 24), p_action: str(b.op, 30) })],
  mod_audit: ['c_mod_audit', 'user', () => ({})],
  admin_listings: ['c_admin_listings', 'user', () => ({})],
  admin_opportunity_save: ['c_admin_opportunity_save', 'user', (b) => ({ p: obj(b.item) })],
  admin_event_save: ['c_admin_event_save', 'user', (b) => ({ p: obj(b.item) })],
};
const AUTH_ACTIONS = new Set(['signup', 'login', 'refresh', 'logout', 'recover', 'auth_settings']);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function createCommunityHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const general = createRateLimiter({ windowMs: 60 * 1000, max: 120 });
  const writes = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 60 });
  const auth = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 15 });

  const base = () => {
    const url = env.SUPABASE_URL?.replace(/\/$/, '');
    const key = env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw Object.assign(new Error('not configured'), { status: 503 });
    return { url, key };
  };

  async function supa(path, { body, token, method = 'POST' } = {}) {
    const { url, key } = base();
    const res = await fetchImpl(`${url}${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: res.status, ok: res.ok, data };
  }

  const session = (d) => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at ?? Math.floor(Date.now() / 1000) + (d.expires_in ?? 3600) });

  async function authAction(action, b) {
    if (action === 'auth_settings') {
      const r = await supa('/auth/v1/settings', { method: 'GET' });
      return json(200, { ok: true, data: { autoconfirm: !!r.data?.mailer_autoconfirm } });
    }
    if (action === 'refresh') {
      const r = await supa('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: str(b.refresh_token, 500) } });
      return r.ok ? json(200, { ok: true, data: session(r.data) }) : fail(401, 'expired', 'Please sign in again.');
    }
    if (action === 'logout') {
      if (b.token) await supa('/auth/v1/logout', { token: str(b.token, 4000) }).catch(() => {});
      return json(200, { ok: true });
    }
    const email = str(b.email, 254).trim().toLowerCase();
    if (!EMAIL.test(email)) return fail(400, 'invalid_email', 'Please enter a valid email address.');
    if (action === 'recover') {
      await supa('/auth/v1/recover', { body: { email } });
      return json(200, { ok: true, data: { sent: true } }); // same answer whether or not the account exists
    }
    const password = str(b.password, 128);
    if (password.length < 8) return fail(400, 'weak_password', 'Use at least 8 characters for your password.');
    if (action === 'login') {
      const r = await supa('/auth/v1/token?grant_type=password', { body: { email, password } });
      if (!r.ok) {
        const unconfirmed = /confirm/i.test(JSON.stringify(r.data ?? ''));
        return fail(401, unconfirmed ? 'unconfirmed' : 'bad_login', unconfirmed ? 'Please confirm your email first: check your inbox for the link.' : 'Email or password is not right.');
      }
      return json(200, { ok: true, data: session(r.data) });
    }
    // signup
    const handle = str(b.handle, 24);
    if (!/^[A-Za-z0-9_]{3,24}$/.test(handle)) return fail(400, 'bad_handle', MESSAGES.bad_handle);
    if (b.over13 !== true) return fail(400, 'age', 'You need to be 13 or older to create an account.');
    if (b.consent !== true) return fail(400, 'consent', 'Please accept the community rules and privacy policy.');
    const r = await supa('/auth/v1/signup', { body: { email, password, data: { handle } } });
    if (!r.ok) {
      const msg = JSON.stringify(r.data ?? '');
      if (/registered|exists/i.test(msg)) return fail(409, 'exists', 'An account with this email already exists. Try signing in.');
      if (/password/i.test(msg)) return fail(400, 'weak_password', 'Please choose a stronger password.');
      return fail(502, 'signup_failed', 'Sign-up is not available right now. Please try again later.');
    }
    const s = r.data?.access_token ? session(r.data) : null;
    if (s) {
      const init = await supa('/rest/v1/rpc/c_profile_init', { token: s.access_token, body: { p_handle: handle } });
      if (!init.ok) {
        const code = init.data?.message;
        return fail(400, code ?? 'profile_failed', MESSAGES[code] ?? 'Your account was created, but the profile could not be saved. Sign in to finish.', undefined);
      }
      return json(200, { ok: true, data: { session: s, me: init.data } });
    }
    return json(200, { ok: true, data: { confirm: true } }); // email confirmation is on: the student confirms, then signs in
  }

  return async (req, context = {}) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', { Allow: 'POST' });
    const ip = context.ip || 'unknown';
    if (general(ip)) return fail(429, 'rate_limited', 'Too many requests. Please slow down.');
    let b;
    try { b = JSON.parse(await req.text()); } catch { return fail(400, 'invalid_json', 'Bad request.'); }
    const action = typeof b?.action === 'string' ? b.action : '';
    try {
      if (AUTH_ACTIONS.has(action)) {
        if (['signup', 'login', 'recover'].includes(action) && auth(ip)) return fail(429, 'rate_limited', 'Too many attempts. Please wait 15 minutes.');
        return await authAction(action, b);
      }
      const def = ACTIONS[action];
      if (!def) return fail(400, 'unknown_action', 'Unknown action.');
      const [fn, who, args] = def;
      const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').slice(0, 4000);
      if (who === 'user' && !token) return fail(401, 'not_signed_in', MESSAGES.not_signed_in);
      if (who === 'user' && !['me', 'my_space', 'mod_queue', 'mod_users', 'mod_audit', 'admin_listings'].includes(action) && writes(ip)) {
        return fail(429, 'rate_limited', MESSAGES.rate_limited);
      }
      const r = await supa(`/rest/v1/rpc/${fn}`, { token: token || undefined, body: args(b) });
      if (r.status === 401) return fail(401, 'expired', 'Your session has expired. Please sign in again.');
      if (!r.ok) {
        const code = r.data?.message;
        if (MESSAGES[code]) return fail(code === 'forbidden' ? 403 : code === 'not_signed_in' ? 401 : 400, code, MESSAGES[code]);
        console.error('community action failed', action, r.status, r.data?.code, r.data?.message);
        return fail(r.status === 404 ? 503 : 400, 'failed', r.status === 404 ? 'The community is being set up. Please try again soon.' : 'That did not work. Please check your input and try again.');
      }
      const publicRead = who === 'any' && !token && ['home', 'feed', 'opportunities', 'events', 'post'].includes(action);
      return json(200, { ok: true, data: r.data }, publicRead ? { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } : {});
    } catch (err) {
      if (err.status === 503) return fail(503, 'not_configured', 'The community is not available right now.');
      console.error('community error', action, err.message);
      return fail(502, 'unavailable', 'The community is not reachable right now. Please try again.');
    }
  };
}
