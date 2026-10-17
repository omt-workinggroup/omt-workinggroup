import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, validateBody } from '../server/ai.mjs';

delete process.env.ANTHROPIC_API_KEY;
const offlineFetch = async () => { throw new Error('offline'); };
const post = (body, raw) => new Request('http://localhost/api/ai', { method: 'POST', body: raw ?? JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const fakeClient = (respond) => ({ beta: { messages: { create: async (params) => respond(params) } } });

test('GET reports whether the AI is configured', async () => {
  const res = await createHandler({ fetchImpl: offlineFetch })(new Request('http://localhost/api/ai'));
  assert.deepEqual(await res.json(), { configured: false });
});

test('POST without credentials returns not_configured (frontend switches to demo mode)', async () => {
  const res = await createHandler({ fetchImpl: offlineFetch })(post({ messages: [{ role: 'user', content: 'hi' }] }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'not_configured');
});

test('request validation', () => {
  assert.ok(validateBody({}));
  assert.ok(validateBody({ messages: [] }));
  assert.ok(validateBody({ messages: [{ role: 'system', content: 'x' }] }));
  assert.ok(validateBody({ messages: [{ role: 'user', content: 'x'.repeat(2001) }] }));
  assert.ok(validateBody({ messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }] }));
  assert.ok(validateBody({ messages: [{ role: 'user', content: 'x' }], resourceId: '../etc' }));
  assert.equal(validateBody({ messages: [{ role: 'user', content: 'x' }], resourceId: 'atomic-habits' }), null);
});

test('invalid JSON is rejected', async () => {
  const handler = createHandler({ client: fakeClient(() => { throw new Error('should not be called'); }), fetchImpl: offlineFetch });
  const res = await handler(post(null, '{nope'), { ip: 'json-test' });
  assert.equal(res.status, 400);
});

test('live reply: sends catalogue context, maps recommended ids to real resources only', async () => {
  let sent;
  const handler = createHandler({
    fetchImpl: offlineFetch,
    client: fakeClient((params) => {
      sent = params;
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ reply: 'Try **Think Python**.', recommended: ['think-python-3e', 'made-up-id'] }) }] };
    }),
  });
  const res = await handler(post({ messages: [{ role: 'user', content: 'beginner python book' }] }), { ip: 'live-test' });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.mode, 'live');
  assert.deepEqual(data.resources.map((r) => r.id), ['think-python-3e']);
  assert.match(sent.messages.at(-1).content, /<search_results>/);
  assert.match(sent.messages.at(-1).content, /think-python-3e/);
  assert.equal(sent.fallbacks, 'default');
});

test('refusals return a safe message', async () => {
  const handler = createHandler({ fetchImpl: offlineFetch, client: fakeClient(() => ({ stop_reason: 'refusal', content: [] })) });
  const data = await (await handler(post({ messages: [{ role: 'user', content: 'x' }] }), { ip: 'refusal-test' })).json();
  assert.equal(data.ok, true);
  assert.deepEqual(data.resources, []);
});

test('rate limiting kicks in', async () => {
  const handler = createHandler({ fetchImpl: offlineFetch, client: fakeClient(() => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"reply":"ok","recommended":[]}' }] })) });
  let last;
  for (let i = 0; i < 21; i++) last = await handler(post({ messages: [{ role: 'user', content: 'hi' }] }), { ip: 'rl-test' });
  assert.equal(last.status, 429);
});

test('external books the AI recommends are added to the library and linked there', async () => {
  const supa = [];
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.includes('supabase.co')) { supa.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); }
    if (u.includes('gutendex.com')) return new Response(JSON.stringify({ results: [{ id: 2701, title: 'Moby Dick', authors: [{ name: 'Melville, Herman' }], formats: {} }] }));
    return new Response(JSON.stringify({}), { status: 200 });
  };
  const handler = createHandler({
    fetchImpl,
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'k' },
    client: fakeClient(() => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ reply: 'Try Moby Dick.', recommended: ['ext-1'] }) }] })),
  });
  const data = await (await handler(post({ messages: [{ role: 'user', content: 'a classic whale novel' }] }), { ip: 'ext-test' })).json();
  assert.equal(data.resources[0].addedToLibrary, true);
  assert.equal(data.resources[0].url, 'resource.html?id=ext-pg-2701');
  assert.equal(supa[0][0].added_by, 'ai');
});
