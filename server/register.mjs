// Free registration: stored in the Supabase table public.registrations and emailed to the owner.
// Either one is enough for the visitor's registration to count; both failing is an error.
import { fail, json, createRateLimiter } from './http.mjs';
import { createMailer, formatRows } from './mailer.mjs';

export const ROLES = ['Student', 'Working professional', 'Company or organisation', 'Other'];
export const INTERESTS = ['Renewable energy', 'Power systems', 'Civil works', 'ICT', 'Telecommunications', 'Training programmes', 'Microsoft Office skills', 'Free library and books'];
export const SOURCES = ['main', 'resources', 'app', 'community'];
// The student community form (community.html) asks for school, level and subjects instead.
export const LEVELS = ['GCSE (Years 10–11)', 'A level, BTEC or T Level (Years 12–13)', 'University', 'Apprenticeship', 'Other'];
export const SUBJECTS = ['Computer Science', 'IT and digital skills', 'Networking', 'Cybersecurity', 'Engineering', 'Data and AI', 'Maths', 'Business', 'Study skills', 'Microsoft Office skills'];
const LIMITS = { name: 200, email: 200, phone: 40, location: 200, organisation: 200, role: 60, level: 80, message: 2000 };
const SOURCE_LABEL = { main: 'company homepage', resources: 'resources pages', app: 'mobile app', community: 'student community page' };

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

export function validateRegistration(body) {
  if (!body || typeof body !== 'object') return 'Please fill in the form.';
  for (const [field, max] of Object.entries(LIMITS)) {
    if (body[field] !== undefined && body[field] !== null && (typeof body[field] !== 'string' || body[field].length > max)) return `The ${field} field is too long.`;
  }
  if (!clean(body.name)) return 'Please enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(body.email))) return 'Please enter a valid email address.';
  if (!SOURCES.includes(body.source)) return 'Unknown form.';
  const student = body.source === 'community';
  const phone = clean(body.phone);
  if ((!student || phone) && !/^[+\d][\d\s()-]{5,}$/.test(phone)) return 'Please enter a phone or WhatsApp number.';
  if (student) {
    if (body.role !== 'Student') return 'The student community is for students.';
    if (!clean(body.organisation)) return 'Please enter your school, college or university.';
    if (!LEVELS.includes(body.level)) return 'Please choose your level of study.';
    if (body.over13 !== true) return 'You need to be 13 or older to join. Ask a parent or teacher to register for you.';
  } else if (!ROLES.includes(body.role)) return 'Please choose what best describes you.';
  const allowed = student ? SUBJECTS : INTERESTS;
  if (!Array.isArray(body.interests) || !body.interests.length || !body.interests.every((i) => allowed.includes(i))) return 'Please choose at least one area of interest.';
  if (body.consent !== true) return 'Please agree to be contacted about your registration.';
  return null;
}

export function registrationEmail(row) {
  const student = row.source === 'community';
  const title = student ? `New student community member: ${row.name}` : `New free registration: ${row.name}`;
  const { text, html } = formatRows(title, [
    ['Name', row.name],
    ['Email', row.email],
    ['Phone / WhatsApp', row.phone],
    ['Country / city', row.location],
    [student ? 'School, college or university' : 'Organisation or school', row.organisation],
    ['Level of study', row.level],
    ['I am a', row.role],
    [student ? 'Subjects' : 'Interested in', row.interests.join(', ')],
    ['Message', row.message],
    ['Registered on', SOURCE_LABEL[row.source]],
  ], 'Sent from the free registration form on web.omt-workinggroup.com. Reply to this email to answer the person directly.');
  const subject = student ? `New student community member: ${row.name} (${row.organisation})` : `New free registration: ${row.name} (${row.role})`;
  return { subject, text, html, replyTo: { name: row.name, address: row.email } };
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
      phone: clean(body.phone) || null,
      location: clean(body.location) || null,
      organisation: clean(body.organisation) || null,
      role: body.role,
      level: body.source === 'community' ? body.level : null,
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
