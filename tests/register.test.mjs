import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegisterHandler, validateRegistration, registrationEmail } from '../server/register.mjs';
import { createContactHandler } from '../server/contact.mjs';
import { createMailer, DEFAULT_NOTIFY_TO } from '../server/mailer.mjs';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const post = (body) => new Request('http://localhost/api/register', { method: 'POST', body: JSON.stringify(body) });
const good = {
  source: 'main', name: 'Ada Lovelace', email: 'ada@example.com', phone: '+234 801 234 5678', location: 'Lagos, Nigeria',
  organisation: 'Analytical Engines', role: 'Student', interests: ['Telecommunications', 'Training programmes'], message: 'Hello', consent: true,
};
const stored = async () => new Response(null, { status: 201 });
const fakeMailer = (ok = true) => { const sent = []; return { configured: true, sent, send: async (m) => { sent.push(m); return ok; } }; };

test('validation', () => {
  assert.equal(validateRegistration(good), null);
  assert.ok(validateRegistration({ ...good, email: 'nope' }));
  assert.ok(validateRegistration({ ...good, phone: 'call me' }));
  assert.ok(validateRegistration({ ...good, role: 'Wizard' }));
  assert.ok(validateRegistration({ ...good, interests: [] }));
  assert.ok(validateRegistration({ ...good, interests: ['Hacking'] }));
  assert.ok(validateRegistration({ ...good, consent: false }), 'needs consent');
  assert.ok(validateRegistration({ ...good, source: 'elsewhere' }));
  assert.ok(validateRegistration({ ...good, message: 'x'.repeat(2001) }));
});

test('stores the registration and emails the owner, replying to the registrant', async () => {
  let call;
  const mailer = fakeMailer();
  const handler = createRegisterHandler({ env, mailer, fetchImpl: async (url, init) => { call = { url, init }; return stored(); } });
  const res = await handler(post({ ...good, extra: 'ignored' }), { ip: 'r1' });
  assert.equal(res.status, 200);
  assert.equal(call.url, 'https://example.supabase.co/rest/v1/registrations');
  assert.deepEqual(Object.keys(JSON.parse(call.init.body)).sort(), ['email', 'interests', 'location', 'message', 'name', 'organisation', 'phone', 'role', 'source']);
  assert.equal(mailer.sent.length, 1);
  assert.match(mailer.sent[0].subject, /Ada Lovelace/);
  assert.deepEqual(mailer.sent[0].replyTo, { name: 'Ada Lovelace', address: 'ada@example.com' });
  assert.match(mailer.sent[0].text, /Telecommunications, Training programmes/);
});

test('either the database or the email is enough; both failing is an error', async () => {
  const down = async () => new Response(null, { status: 500 });
  assert.equal((await createRegisterHandler({ env, mailer: fakeMailer(true), fetchImpl: down })(post(good), { ip: 'r2' })).status, 200);
  assert.equal((await createRegisterHandler({ env, mailer: fakeMailer(false), fetchImpl: stored })(post(good), { ip: 'r3' })).status, 200);
  assert.equal((await createRegisterHandler({ env, mailer: fakeMailer(false), fetchImpl: down })(post(good), { ip: 'r4' })).status, 502);
  assert.equal((await createRegisterHandler({ env: {}, mailer: createMailer({ env: {} }) })(post(good))).status, 503);
});

test('honeypot, bad input and rate limit', async () => {
  const mailer = fakeMailer();
  const handler = createRegisterHandler({ env, mailer, fetchImpl: stored });
  assert.equal((await handler(post({ ...good, company: 'bot' }), { ip: 'r5' })).status, 200);
  assert.equal(mailer.sent.length, 0, 'bots are not emailed');
  assert.equal((await handler(post({ ...good, email: 'x' }), { ip: 'r5' })).status, 400);
  for (let i = 0; i < 5; i += 1) assert.equal((await handler(post(good), { ip: 'r6' })).status, 200);
  assert.equal((await handler(post(good), { ip: 'r6' })).status, 429);
});

test('email text escapes nothing it should not, and HTML escapes markup', () => {
  const mail = registrationEmail({ ...good, name: '<b>Eve</b>', interests: good.interests, message: null });
  assert.match(mail.text, /<b>Eve<\/b>/);
  assert.doesNotMatch(mail.html, /<b>Eve/);
  assert.doesNotMatch(mail.text, /Message:/, 'empty fields are left out');
});

test('mailer sends through SMTP to the owner by default, and is off without a password', async () => {
  assert.equal(createMailer({ env: {} }).configured, false);
  let options; let message;
  const mailer = createMailer({
    env: { SMTP_USER: 'no-reply@omt-workinggroup.com', SMTP_PASS: 'secret' },
    createTransport: (o) => { options = o; return { sendMail: async (m) => { message = m; } }; },
  });
  assert.equal(await mailer.send({ subject: 'Hi', text: 'x', html: 'x' }), true);
  assert.equal(options.host, 'premium228.web-hosting.com');
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.equal(message.to, DEFAULT_NOTIFY_TO);
  assert.equal(message.from.address, 'no-reply@omt-workinggroup.com');
});

test('contact form emails the owner too', async () => {
  const mailer = fakeMailer();
  const handler = createContactHandler({ env, mailer, fetchImpl: stored });
  const res = await handler(new Request('http://localhost/api/contact', { method: 'POST', body: JSON.stringify({ kind: 'contact', name: 'Ada', email: 'ada@example.com', topic: 'Training', message: 'Hello' }) }), { ip: 'c9' });
  assert.equal(res.status, 200);
  assert.equal(mailer.sent.length, 1);
  assert.match(mailer.sent[0].subject, /Training/);
});
