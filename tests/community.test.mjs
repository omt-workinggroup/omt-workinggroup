import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityHandler } from '../server/community.mjs';

const env = { SUPABASE_URL: 'https://db.example', SUPABASE_PUBLISHABLE_KEY: 'pk' };
const post = (body, token) => new Request('https://x/api/community', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) });
function fake(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : undefined });
    const path = new URL(url).pathname + new URL(url).search;
    const [status, data] = routes[path] ?? [404, { message: 'missing' }];
    return new Response(JSON.stringify(data), { status });
  };
  return { fetchImpl, calls };
}

test('unknown actions and bad JSON are refused', async () => {
  const h = createCommunityHandler({ env, fetchImpl: fake({}).fetchImpl });
  assert.equal((await h(post({ action: 'drop_tables' }), { ip: 'a' })).status, 400);
  assert.equal((await h(new Request('https://x', { method: 'POST', body: '{' }), { ip: 'a' })).status, 400);
  assert.equal((await h(new Request('https://x', { method: 'GET' }), { ip: 'a' })).status, 405);
});

test('user actions need a token and forward it to the database', async () => {
  const { fetchImpl, calls } = fake({ '/rest/v1/rpc/c_like': [200, { liked: true, likes: 1 }] });
  const h = createCommunityHandler({ env, fetchImpl });
  assert.equal((await h(post({ action: 'like', id: 5 }), { ip: 'b' })).status, 401);
  const res = await h(post({ action: 'like', id: 5 }, 'user-jwt'), { ip: 'b' });
  assert.equal(res.status, 200);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer user-jwt');
  assert.deepEqual(calls[0].body, { p_post: 5 });
});

test('database errors become friendly messages', async () => {
  const { fetchImpl } = fake({ '/rest/v1/rpc/c_post_create': [400, { code: 'P0001', message: 'blocked_words' }] });
  const h = createCommunityHandler({ env, fetchImpl });
  const res = await h(post({ action: 'post_create', post: { kind: 'post' } }, 't'), { ip: 'c' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error.message, /friendly/);
});

test('public reads work without a token', async () => {
  const { fetchImpl, calls } = fake({ '/rest/v1/rpc/c_feed': [200, []] });
  const h = createCommunityHandler({ env, fetchImpl });
  const res = await h(post({ action: 'feed', query: { kind: 'question' } }), { ip: 'd' });
  assert.equal(res.status, 200);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer pk');
  assert.deepEqual(calls[0].body, { p: { kind: 'question' } });
});

test('sign-up checks age, consent and username before calling Supabase', async () => {
  const { fetchImpl, calls } = fake({});
  const h = createCommunityHandler({ env, fetchImpl });
  const good = { action: 'signup', email: 'a@b.co', password: 'longenough', handle: 'ada_l', over13: true, consent: true };
  assert.equal((await h(post({ ...good, over13: false }), { ip: 'e' })).status, 400);
  assert.equal((await h(post({ ...good, consent: false }), { ip: 'e' })).status, 400);
  assert.equal((await h(post({ ...good, handle: 'no spaces' }), { ip: 'e' })).status, 400);
  assert.equal((await h(post({ ...good, password: 'short' }), { ip: 'e' })).status, 400);
  assert.equal(calls.length, 0);
});

test('sign-up with email confirmation asks the student to confirm', async () => {
  const { fetchImpl } = fake({ '/auth/v1/signup': [200, { id: 'u1', email: 'a@b.co' }] });
  const h = createCommunityHandler({ env, fetchImpl });
  const res = await h(post({ action: 'signup', email: 'a@b.co', password: 'longenough', handle: 'ada_l', over13: true, consent: true }), { ip: 'f' });
  assert.deepEqual((await res.json()).data, { confirm: true });
});

test('sign-up without confirmation creates the profile straight away', async () => {
  const { fetchImpl, calls } = fake({
    '/auth/v1/signup': [200, { access_token: 'jwt', refresh_token: 'r', expires_in: 3600 }],
    '/rest/v1/rpc/c_profile_init': [200, { handle: 'ada_l', role: 'student' }],
  });
  const h = createCommunityHandler({ env, fetchImpl });
  const res = await h(post({ action: 'signup', email: 'a@b.co', password: 'longenough', handle: 'ada_l', over13: true, consent: true }), { ip: 'g' });
  const data = (await res.json()).data;
  assert.equal(data.me.handle, 'ada_l');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer jwt');
});

test('wrong password gives a generic message', async () => {
  const { fetchImpl } = fake({ '/auth/v1/token?grant_type=password': [400, { error_description: 'Invalid login credentials' }] });
  const h = createCommunityHandler({ env, fetchImpl });
  const res = await h(post({ action: 'login', email: 'a@b.co', password: 'longenough' }), { ip: 'h' });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'bad_login');
});
