// Free registration: stored in the Supabase table public.registrations and emailed to the owner.
// Either one is enough for the visitor's registration to count; both failing is an error.
import { fail, json, createRateLimiter } from './http.mjs';
import { createMailer, formatRows } from './mailer.mjs';

export const ROLES = ['Student', 'Working professional', 'Company or organisation', 'Other'];
export const INTERESTS = ['Renewable energy', 'Power systems', 'Civil works', 'ICT', 'Telecommunications', 'Training programmes', 'Microsoft Office skills', 'Free library and books'];
export const SOURCES = ['main', 'resources', 'app'];
const LIMITS = { name: 200, email: 200, phone: 40, location: 200, organisation: 200, role: 60, message: 2000 };
const SOURCE_LABEL = { main: 'company homepage', resources: 'resources pages', app: 'mobile app' };

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

export function validateRegistration(body) {
  if (!body || typeof body !== 'object') return 'Please fill in the form.';
  for (const [field, max] of Object.entries(LIMITS)) {
    if (body[field] !== undefined && body[field] !== null && (typeof body[field] !== 'string' || body[field].length > max)) return `The ${field} field is too long.`;
  }
  if (!clean(body.name)) return 'Please enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(body.email))) return 'Please enter a valid email address.';
  if (!clean(body.phone) || !/^[+\d][\d\s()-]{5,}$/.test(clean(body.phone))) return 'Please enter a phone or WhatsApp number.';
  if (!ROLES.includes(body.role)) return 'Please choose what best describes you.';
  if (!Array.isArray(body.interests) || !body.interests.length || !body.interests.every((i) => INTERESTS.includes(i))) return 'Please choose at least one area of interest.';
  if (body.consent !== true) return 'Please agree to be contacted about your registration.';
  if (!SOURCES.includes(body.source)) return 'Unknown form.';
  return null;
}

export function registrationEmail(row) {
  const { text, html } = formatRows(`New free registration: ${row.name}`, [
    ['Name', row.name],
    ['Email', row.email],
    ['Phone / WhatsApp', row.phone],
    ['Country / city', row.location],
    ['Organisation or school', row.organisation],
    ['I am a', row.role],
    ['Interested in', row.interests.join(', ')],
    ['Message', row.message],
    ['Registered on', SOURCE_LABEL[row.source]],
  ], 'Sent from the free registration form on web.omt-workinggroup.com. Reply to this email to answer the person directly.');
  return { subject: `New free registration: ${row.name} (${row.role})`, text, html, replyTo: { name: row.name, address: row.email } };
}

export function createRegisterHandler({ fetchImpl = fetch, env = process.env, mailer = createMailer({ env }) } = {}) {
  const rateLimited = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
  return async (req, context = {}) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', { Allow: 'POST' });
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_PUBLISHABLE_KEY;
    if ((!url || !key) && !mailer.configured) return fail(503, 'not_configured', 'Registration is not open right now. Please try again later.');

    const raw = await req.text();
    if (raw.length > 8000) return fail(413, 'too_large', 'Your registration is too long.');
    let body;
    try { body = JSON.parse(raw); } catch { return fail(400, 'invalid_json', 'The form could not be read.'); }

    // Honeypot: real visitors never fill this hidden field. Pretend success to bots.
    if (body?.company) return json(200, { ok: true });
    const problem = validateRegistration(body);
    if (problem) return fail(400, 'invalid_request', problem);
    if (rateLimited(context.ip || 'unknown')) return fail(429, 'rate_limited', 'You have registered several times already. Please try again later.');

    const row = {
      source: body.source,
      name: clean(body.name),
      email: clean(body.email),
      phone: clean(body.phone),
      location: clean(body.location) || null,
      organisation: clean(body.organisation) || null,
      role: body.role,
      interests: [...new Set(body.interests)],
      message: clean(body.message) || null,
    };

    const store = url && key
      ? fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/registrations`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(8000),
      }).then((res) => { if (!res.ok) console.error('Supabase insert failed', res.status); return res.ok; }, () => false)
      : Promise.resolve(false);
    const [stored, emailed] = await Promise.all([store, mailer.send(registrationEmail(row))]);

    if (!stored && !emailed) return fail(502, 'store_failed', 'Your registration couldn\'t be sent. Please try again in a moment.');
    return json(200, { ok: true });
  };
}
