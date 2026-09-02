// Outreach engine: rendering, gating, sending. Every send passes through
// send_blockers() in the database and fails closed on any error.

import { business } from './config.js';

export const STEP_STATUS = { 1: 'CONTACTED', 2: 'FOLLOW_UP_1', 3: 'FOLLOW_UP_2', 4: 'FINAL_FOLLOW_UP' };

/** Business-day arithmetic (Mon–Fri). */
export function addBusinessDays(from, days) {
  const d = new Date(from);
  let n = 0;
  while (n < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return d;
}

export function londonHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false, weekday: 'short' }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour').value) % 24;
  const weekday = parts.find(p => p.type === 'weekday').value;
  return { hour, weekday, isWeekday: !['Sat', 'Sun'].includes(weekday) };
}

/** The one sentence of personalisation, or nothing. Never invented. */
export function personalisationClause(company) {
  const f = company.personalisation_fact || '';
  if (/more than one office/.test(f)) return ', and I saw from your website that you operate from more than one office';
  const m = f.match(/team page lists around (\d+) people/);
  if (m && Number(m[1]) >= 3) return `, and I saw from your website that you're a team of around ${m[1]}`;
  return '';
}

export function footer({ companyName, unsubscribeUrl }) {
  return [
    '',
    '--',
    `${business.ownerName} · ${business.companyName} · ${business.email} · ${business.phone}`,
    `${business.legalName}, trading as ${business.companyName}. Registered in England and Wales, company no. ${business.companyNumber}. Registered office: ${business.registeredAddress}.`,
    `You're receiving this because ${companyName} is a UK limited company we identified from the Companies House register. If you'd rather not hear from us, reply "stop" or use this link: ${unsubscribeUrl} — we'll stop immediately and won't contact you again.`
  ].join('\n');
}

export function render(template, { contact, company, unsubscribeUrl }) {
  const vars = {
    first_name: contact.first_name || 'there',
    company_name: displayName(company.legal_name),
    personalisation_clause: personalisationClause(company)
  };
  const fill = s => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ''));
  const subject = fill(template.subject);
  const body = fill(template.body) + '\n' + footer({ companyName: vars.company_name, unsubscribeUrl });
  return { subject, body, personalisationUsed: vars.personalisation_clause || null };
}

/** "MSS ACCOUNTANCY SERVICES LTD" -> "MSS Accountancy Services" */
export function displayName(legal) {
  return String(legal || '')
    .replace(/\s+(LIMITED|LTD\.?|LLP)\s*$/i, '')
    .split(/\s+/)
    .map(w => (w.length <= 3 && w === w.toUpperCase()) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Send through Resend's REST API. Returns { id } or throws. */
export async function sendViaResend({ to, subject, text, unsubscribeUrl, tags = [] }) {
  const key = (process.env.RESEND_API_KEY || '').trim();
  const from = (process.env.RESEND_FROM || '').trim();
  if (!key || !from) throw new Error('RESEND_API_KEY or RESEND_FROM is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [to], reply_to: business.email, subject, text,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      },
      tags: tags.map(t => ({ name: t.name, value: t.value }))
    })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${j.message || j.error || 'send failed'}`);
  return { id: j.id };
}
