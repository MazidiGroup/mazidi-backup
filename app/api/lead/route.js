import { serverClient } from '../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Very small in-memory limiter. Survives a warm instance only, which is
// enough to blunt casual abuse; the honeypot does most of the work.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter(t => now - t < win);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 5;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(v, max) {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
}

export async function POST(request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (rateLimited(ip)) {
    return Response.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Honeypot: a filled hidden field means a bot. Accept silently so it
  // does not learn, but write nothing.
  if (clean(body.website_url, 200)) {
    return Response.json({ ok: true });
  }

  const name    = clean(body.name, 120);
  const email   = clean(body.email, 200);
  const company = clean(body.company_name, 160);
  const phone   = clean(body.phone, 40);
  const message = clean(body.message, 4000);
  const source  = clean(body.page_source, 60) || 'unknown';

  let pcCount = parseInt(body.pc_count, 10);
  if (!Number.isFinite(pcCount) || pcCount < 1 || pcCount > 500) pcCount = null;

  if (!name)  return Response.json({ error: 'Please enter your name.' }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  try {
    const db = serverClient();

    const { data: lead, error } = await db
      .from('website_leads')
      .insert({
        name, email, company_name: company, phone,
        pc_count: pcCount, message, page_source: source
      })
      .select('lead_id')
      .single();

    if (error) throw error;

    await db.from('activity_log').insert({
      actor: 'SYSTEM:website',
      action: 'INBOUND_WEBSITE_LEAD',
      entity_type: 'website_leads',
      entity_id: lead.lead_id,
      detail: { source, pc_count: pcCount, has_phone: Boolean(phone) },
      outcome: 'AWAITING_OWNER_RESPONSE'
    });

    // An inbound enquiry is an active conversation: it must never be
    // swept into an automated outreach sequence.
    await notifyOwner({ name, email, company, phone, pcCount, message, source });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('lead capture failed', err);
    return Response.json(
      { error: 'We could not save that. Please email us directly.' },
      { status: 500 }
    );
  }
}

async function notifyOwner(lead) {
  const key = process.env.RESEND_API_KEY;
  const to  = process.env.OWNER_ALERT_EMAIL;
  const from = process.env.RESEND_FROM;
  if (!key || !to || !from) return; // alerting is optional; the lead is already stored

  const text = [
    'NEW WEBSITE ENQUIRY — HUMAN ACTION REQUIRED',
    '',
    `Name:      ${lead.name}`,
    `Company:   ${lead.company || '(not given)'}`,
    `Email:     ${lead.email}`,
    `Phone:     ${lead.phone || '(not given)'}`,
    `Computers: ${lead.pcCount ?? '(not given)'}`,
    `Page:      ${lead.source}`,
    '',
    'Message:',
    lead.message || '(none)'
  ].join('\n');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to], reply_to: lead.email,
        subject: `New enquiry: ${lead.company || lead.name}`,
        text
      })
    });
  } catch (err) {
    console.error('owner alert failed (lead was still saved)', err);
  }
}
