// Contact and copyright-report submissions, stored in the Supabase table public.site_messages
// and emailed to the owner. Either one is enough; both failing is an error.
import { fail, json, createRateLimiter } from './http.mjs';
import { createMailer, formatRows } from './mailer.mjs';

const LIMITS = { name: 200, email: 200, topic: 100, resource: 500, message: 4000 };
const KINDS = ['contact', 'copyright'];

export function validateMessage(body) {
  if (!body || typeof body !== 'object') return 'Please fill in the form.';
  if (!KINDS.includes(body.kind)) return 'Unknown form.';
  for (const field of ['name', 'email', 'message']) {
    if (typeof body[field] !== 'string' || !body[field].trim()) return 'Please fill in every required field.';
  }
  for (const [field, max] of Object.entries(LIMITS)) {
    if (body[field] !== undefined && body[field] !== null && (typeof body[field] !== 'string' || body[field].length > max)) return `The ${field} field is too long.`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return 'Please enter a valid email address.';
  if (body.kind === 'copyright' && (!body.resource?.trim() || body.goodFaith !== true)) return 'Please name the resource and confirm the statement.';
  return null;
}

export function contactEmail(row) {
  const what = row.kind === 'copyright' ? 'Copyright report' : 'Website message';
  const { text, html } = formatRows(`${what} from ${row.name}`, [
    ['Name', row.name],
    ['Email', row.email],
    ['Topic', row.topic],
    ['Resource', row.resource],
    ['Message', row.message],
  ], 'Sent from the contact form on web.omt-workinggroup.com. Reply to this email to answer the person directly.');
  return { subject: `${what}: ${row.topic || 'General'} (${row.name})`, text, html, replyTo: { name: row.name, address: row.email } };
}

export function createContactHandler({ fetchImpl = fetch, env = process.env, mailer = createMailer({ env }) } = {}) {
  const rateLimited = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
  return async (req, context = {}) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', { Allow: 'POST' });
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_PUBLISHABLE_KEY;
    if ((!url || !key) && !mailer.configured) return fail(503, 'not_configured', 'Messages can\'t be sent right now. Please try again later.');

    const raw = await req.text();
    if (raw.length > 12_000) return fail(413, 'too_large', 'Your message is too long.');
    let body;
    try { body = JSON.parse(raw); } catch { return fail(400, 'invalid_json', 'The form could not be read.'); }

    // Honeypot: real visitors never fill this hidden field. Pretend success to bots.
    if (body.company) return json(200, { ok: true });
    const problem = validateMessage(body);
    if (problem) return fail(400, 'invalid_request', problem);
    if (rateLimited(context.ip || 'unknown')) return fail(429, 'rate_limited', 'You have sent several messages already. Please try again later.');

    const row = {
      kind: body.kind,
      name: body.name.trim(),
      email: body.email.trim(),
      topic: body.topic?.trim() || null,
      resource: body.resource?.trim() || null,
      message: body.message.trim(),
    };
    const store = url && key
      ? fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/site_messages`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(8000),
      }).then((res) => { if (!res.ok) console.error('Supabase insert failed', res.status); return res.ok; }, () => false)
      : Promise.resolve(false);
    const [stored, emailed] = await Promise.all([store, mailer.send(contactEmail(row))]);
    if (!stored && !emailed) return fail(502, 'store_failed', 'Your message couldn\'t be sent. Please try again in a moment.');
    return json(200, { ok: true });
  };
}
