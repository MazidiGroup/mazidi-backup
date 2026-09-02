import { serverClient } from '../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One-click opt-out. The token is the outreach row id that carried the link:
// random, stored, and tied to one message, so it cannot be guessed or forged.
// Recording it as an UNSUBSCRIBE reply lets the replies_halt_sequence trigger
// do the rest: cancel the sequence, mark the contact objected, suppress the
// address permanently, set the company to DO_NOT_CONTACT.
async function optOut(request) {
  const url = new URL(request.url);
  const o = (url.searchParams.get('o') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(o)) return { ok: false };
  const db = serverClient();
  const { data: row } = await db.from('outreach').select('outreach_id, company_id, contact_id').eq('outreach_id', o).single();
  if (!row) return { ok: false };
  const { data: ct } = await db.from('contacts').select('email, objected').eq('contact_id', row.contact_id).single();
  if (ct && !ct.objected) {
    await db.from('replies').insert({
      outreach_id: row.outreach_id, company_id: row.company_id, contact_id: row.contact_id,
      from_email: ct.email, received_at: new Date().toISOString(), subject: 'Unsubscribe link',
      full_message: '(one-click unsubscribe link used)', classification: 'UNSUBSCRIBE', classifier_confidence: 1,
      summary: 'Recipient used the unsubscribe link', human_action_required: false
    });
    await db.from('activity_log').insert({ actor: 'SYSTEM:unsubscribe', action: 'OPT_OUT', entity_type: 'contacts', entity_id: row.contact_id, company_id: row.company_id, detail: { via: 'link', outreach_id: row.outreach_id }, outcome: 'suppressed permanently' });
  }
  return { ok: true };
}

export async function GET(request) {
  const r = await optOut(request);
  return Response.redirect(new URL(r.ok ? '/unsubscribed' : '/unsubscribed?unknown=1', request.url), 303);
}

// RFC 8058 one-click (mail clients POST here without showing a page).
export async function POST(request) {
  await optOut(request);
  return new Response(null, { status: 200 });
}
