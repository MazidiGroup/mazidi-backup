import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverClient } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Resend delivery events, signed with the Svix scheme. Without
// RESEND_WEBHOOK_SECRET every request is rejected, so nothing can forge a
// delivery or bounce.
function verify(request, body) {
  const secret = (process.env.RESEND_WEBHOOK_SECRET || '').trim();
  if (!secret) return false;
  const id = request.headers.get('svix-id'), ts = request.headers.get('svix-timestamp'), sigs = request.headers.get('svix-signature') || '';
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return sigs.split(' ').some(s => {
    const [, sig] = s.split(',');
    if (!sig) return false;
    const a = Buffer.from(sig), b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(request) {
  const body = await request.text();
  if (!verify(request, body)) return new Response('invalid signature', { status: 401 });
  let evt; try { evt = JSON.parse(body); } catch { return new Response('bad json', { status: 400 }); }

  const id = evt?.data?.email_id;
  if (!id) return Response.json({ ok: true, ignored: 'no email id' });
  const db = serverClient();
  const { data: row } = await db.from('outreach').select('outreach_id, company_id, contact_id').eq('provider_message_id', id).single();
  if (!row) return Response.json({ ok: true, ignored: 'unknown message' });

  const type = String(evt.type || '');
  if (type === 'email.delivered') {
    await db.from('outreach').update({ delivery_status: 'DELIVERED' }).eq('outreach_id', row.outreach_id);
  } else if (type === 'email.bounced') {
    const bounce = evt.data?.bounce ?? {};
    const hard = String(bounce.type || '').toLowerCase() !== 'transient';
    await db.from('outreach').update({ delivery_status: 'BOUNCED', bounce_type: bounce.type ?? 'unknown', bounce_detail: bounce.message ?? null }).eq('outreach_id', row.outreach_id);
    if (hard) {
      await db.from('contacts').update({ hard_bounced: true }).eq('contact_id', row.contact_id);
      const { data: ct } = await db.from('contacts').select('email').eq('contact_id', row.contact_id).single();
      const { data: co } = await db.from('companies').select('legal_name').eq('company_id', row.company_id).single();
      if (ct) await db.from('suppression').insert({ email: ct.email, company_name: co?.legal_name ?? null, reason: `Hard bounce: ${bounce.message ?? bounce.type ?? 'unknown'}`, source: 'resend_webhook', permanent: true });
    }
    await db.from('activity_log').insert({ actor: 'SYSTEM:resend-webhook', action: hard ? 'HARD_BOUNCE' : 'SOFT_BOUNCE', entity_type: 'outreach', entity_id: row.outreach_id, company_id: row.company_id, detail: bounce, outcome: hard ? 'contact suppressed' : 'recorded' });
  } else if (type === 'email.complained') {
    const { data: ct } = await db.from('contacts').select('email').eq('contact_id', row.contact_id).single();
    if (ct) await db.from('replies').insert({ outreach_id: row.outreach_id, company_id: row.company_id, contact_id: row.contact_id, from_email: ct.email, received_at: new Date().toISOString(), subject: 'Spam complaint', full_message: '(complaint reported by mailbox provider)', classification: 'UNSUBSCRIBE', classifier_confidence: 1, summary: 'Spam complaint', human_action_required: false });
    await db.from('activity_log').insert({ actor: 'SYSTEM:resend-webhook', action: 'SPAM_COMPLAINT', entity_type: 'outreach', entity_id: row.outreach_id, company_id: row.company_id, detail: {}, outcome: 'suppressed permanently' });
  }
  return Response.json({ ok: true });
}
