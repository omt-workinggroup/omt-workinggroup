import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContactHandler, validateMessage } from '../server/contact.mjs';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const post = (body) => new Request('http://localhost/api/contact', { method: 'POST', body: JSON.stringify(body) });
const good = { kind: 'contact', name: 'Ada', email: 'ada@example.com', topic: 'General question', message: 'Hello' };

test('validation', () => {
  assert.equal(validateMessage(good), null);
  assert.ok(validateMessage({ ...good, email: 'nope' }));
  assert.ok(validateMessage({ ...good, kind: 'spam' }));
  assert.ok(validateMessage({ ...good, message: 'x'.repeat(4001) }));
  assert.ok(validateMessage({ ...good, kind: 'copyright', resource: 'resource.html?id=x' }), 'copyright needs the confirmation');
  assert.equal(validateMessage({ ...good, kind: 'copyright', resource: 'resource.html?id=x', goodFaith: true }), null);
});

test('stores a valid message in Supabase with only the expected columns', async () => {
  let call;
  const handler = createContactHandler({ env, fetchImpl: async (url, init) => { call = { url, init }; return new Response(null, { status: 201 }); } });
  const res = await handler(post({ ...good, extra: 'ignored' }), { ip: 'c1' });
  assert.equal(res.status, 200);
  assert.equal(call.url, 'https://example.supabase.co/rest/v1/site_messages');
  assert.deepEqual(Object.keys(JSON.parse(call.init.body)).sort(), ['email', 'kind', 'message', 'name', 'resource', 'topic']);
});

test('not configured, honeypot and rate limit', async () => {
  assert.equal((await createContactHandler({ env: {} })(post(good))).status, 503);
  let called = false;
  const handler = createContactHandler({ env, fetchImpl: async () => { called = true; return new Response(null, { status: 201 }); } });
  assert.equal((await handler(post({ ...good, company: 'bot' }), { ip: 'c2' })).status, 200);
  assert.equal(called, false, 'honeypot submissions are dropped');
  let last;
  for (let i = 0; i < 6; i++) last = await handler(post(good), { ip: 'c3' });
  assert.equal(last.status, 429);
});
