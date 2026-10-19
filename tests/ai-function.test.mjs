import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, validateBody } from '../server/ai.mjs';

delete process.env.ANTHROPIC_API_KEY;
const offlineFetch = async () => { throw new Error('offline'); };
const post = (body, raw) => new Request('http://localhost/api/ai', { method: 'POST', body: raw ?? JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
// A stand-in for client.beta.messages.stream: respond(params) returns { text, stop_reason }.
const fakeClient = (respond) => ({
  beta: {
    messages: {
      stream(params) {
        let result;
        const get = () => (result ??= respond(params));
        return {
          async *[Symbol.asyncIterator]() {
            const { text = '' } = get();
            for (const piece of text.match(/[\s\S]{1,7}/g) ?? []) yield { type: 'content_block_delta', delta: { type: 'text_delta', text: piece } };
          },
          async finalMessage() { return { stop_reason: get().stop_reason ?? 'end_turn' }; },
        };
      },
    },
  },
});
const meta = (recommended, followups = []) => `<<meta ${JSON.stringify({ recommended, followups })}>>`;

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
  assert.ok(validateBody({ messages: [{ role: 'user', content: 'x'.repeat(24001) }] }));
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
      return { text: `Try **Think Python**.\n${meta(['think-python-3e', 'made-up-id'], ['Is it free?'])}` };
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
  assert.equal(data.reply, 'Try **Think Python**.');
  assert.deepEqual(data.followups, ['Is it free?']);
});

test('refusals return a safe message', async () => {
  const handler = createHandler({ fetchImpl: offlineFetch, client: fakeClient(() => ({ stop_reason: 'refusal', text: 'partial' })) });
  const data = await (await handler(post({ messages: [{ role: 'user', content: 'x' }] }), { ip: 'refusal-test' })).json();
  assert.equal(data.ok, true);
  assert.deepEqual(data.resources, []);
});

test('rate limiting kicks in', async () => {
  const handler = createHandler({ fetchImpl: offlineFetch, client: fakeClient(() => ({ text: 'ok' })) });
  let last;
  for (let i = 0; i < 41; i++) last = await handler(post({ messages: [{ role: 'user', content: 'hi' }] }), { ip: 'rl-test' });
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
    client: fakeClient(() => ({ text: `Try Moby Dick.\n${meta(['ext-1'])}` })),
  });
  const data = await (await handler(post({ messages: [{ role: 'user', content: 'a classic whale novel' }] }), { ip: 'ext-test' })).json();
  assert.equal(data.resources[0].addedToLibrary, true);
  assert.equal(data.resources[0].url, 'resource.html?id=ext-pg-2701');
  assert.equal(supa[0][0].added_by, 'ai');
});

test('streaming: sends the answer as deltas, hides the metadata line, then a done event', async () => {
  const handler = createHandler({ fetchImpl: offlineFetch, client: fakeClient(() => ({ text: `**Linux** is great.\n${meta(['tlcl'], ['Where do I start?', 'Is it free?'])}` })) });
  const res = await handler(post({ stream: true, messages: [{ role: 'user', content: 'The Linux Command Line by William Shotts' }] }), { ip: 'stream-test' });
  assert.match(res.headers.get('content-type'), /ndjson/);
  const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  const shown = events.filter((e) => e.type === 'delta').map((e) => e.text).join('');
  assert.equal(shown.trim(), '**Linux** is great.');
  assert.doesNotMatch(shown, /<</);
  const done = events.at(-1);
  assert.equal(done.type, 'done');
  assert.deepEqual(done.resources.map((r) => r.id), ['tlcl']);
  assert.equal(done.followups.length, 2);
  assert.ok(done.links.includes('resource.html?id=tlcl'));
});

test('streaming: provider errors arrive as an error event', async () => {
  const handler = createHandler({ fetchImpl: offlineFetch, client: fakeClient(() => { throw new Error('boom'); }) });
  const res = await handler(post({ stream: true, messages: [{ role: 'user', content: 'x' }] }), { ip: 'stream-err' });
  const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(events.at(-1).type, 'error');
});

test('attachments: only on the newest user message, images and PDFs as base64, sent as content blocks', async () => {
  const img = { kind: 'image', mediaType: 'image/jpeg', data: 'aGVsbG8=', name: 'a.jpg' };
  assert.equal(validateBody({ messages: [{ role: 'user', content: 'what is this?', attachments: [img] }] }), null);
  assert.ok(validateBody({ messages: [{ role: 'user', content: 'x', attachments: [img] }, { role: 'assistant', content: 'y' }, { role: 'user', content: 'z' }] }));
  assert.ok(validateBody({ messages: [{ role: 'user', content: 'x', attachments: [{ ...img, mediaType: 'image/svg+xml' }] }] }));
  assert.ok(validateBody({ messages: [{ role: 'user', content: 'x', attachments: [{ ...img, data: 'not base64!' }] }] }));
  let sent;
  const handler = createHandler({ fetchImpl: offlineFetch, client: fakeClient((params) => { sent = params; return { text: 'A cat.' }; }) });
  const pdf = { kind: 'pdf', mediaType: 'application/pdf', data: 'JVBERi0=', name: 'notes.pdf' };
  const data = await (await handler(post({ messages: [{ role: 'user', content: 'what is this?', attachments: [img, pdf] }] }), { ip: 'att-test' })).json();
  assert.equal(data.reply, 'A cat.');
  const content = sent.messages.at(-1).content;
  assert.deepEqual(content.map((b) => b.type), ['image', 'document', 'text']);
  assert.equal(content[0].source.media_type, 'image/jpeg');
  assert.equal(content[1].title, 'notes.pdf');
  assert.match(content[2].text, /what is this\?/);
});
