// Sends website notifications (registrations, contact messages) to the owner's mailbox through the
// domain's own mail server (cPanel SMTP), so no outside email service is involved.
// Settings, all in Vercel environment variables:
//   SMTP_USER   mailbox the site sends from, e.g. no-reply@omt-workinggroup.com
//   SMTP_PASS   that mailbox's password
//   SMTP_HOST   default premium228.web-hosting.com (the domain's Namecheap server)
//   SMTP_PORT   default 465 (SSL)
//   NOTIFY_TO   where notifications go, default mission.adeoye@omt-workinggroup.com
import nodemailer from 'nodemailer';

export const DEFAULT_NOTIFY_TO = 'mission.adeoye@omt-workinggroup.com';

export function createMailer({ env = process.env, createTransport = nodemailer.createTransport } = {}) {
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const to = env.NOTIFY_TO || DEFAULT_NOTIFY_TO;
  if (!user || !pass) return { configured: false, to, send: async () => false };

  const port = Number(env.SMTP_PORT || 465);
  const transport = createTransport({
    host: env.SMTP_HOST || 'premium228.web-hosting.com',
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 8000,
    socketTimeout: 8000,
  });

  return {
    configured: true,
    to,
    /** Send one email to the owner. Resolves true when the server accepted it. */
    async send({ subject, text, html, replyTo }) {
      try {
        await transport.sendMail({ from: { name: 'OMT Website', address: user }, to, replyTo, subject, text, html });
        return true;
      } catch (err) {
        console.error('Notification email failed', err?.code || err?.message);
        return false;
      }
    },
  };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain-text and HTML bodies for a list of [label, value] rows. Empty values are left out. */
export function formatRows(title, rows, footer) {
  const kept = rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  const text = `${title}\n\n${kept.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${footer}\n`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#16202f">
<h2 style="margin:0 0 14px;font-size:19px;color:#0d0b47">${esc(title)}</h2>
<table style="border-collapse:collapse">${kept.map(([k, v]) => `<tr><th style="text-align:left;vertical-align:top;padding:6px 16px 6px 0;color:#566173;font-weight:600">${esc(k)}</th><td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>
<p style="margin-top:18px;color:#566173;font-size:13px">${esc(footer)}</p></div>`;
  return { text, html };
}
