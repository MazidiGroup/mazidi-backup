import { serverClient } from '../../../../lib/supabase';
import { verifyEmail } from '../../../../lib/verify';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function authorised(request) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const supplied = (request.headers.get('authorization') || '').trim().replace(/^Bearer\s+/i, '').trim();
  if (!secret) return { ok: false, reason: 'CRON_SECRET is not set on this deployment' };
  if (!supplied) return { ok: false, reason: 'No bearer token was sent' };
  return supplied === secret ? { ok: true } : { ok: false, reason: 'Bearer token did not match CRON_SECRET' };
}

export async function GET(request) {
  const auth = authorised(request);
  if (!auth.ok) return Response.json({ error: 'Unauthorised', reason: auth.reason }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 50);
  const dryRun = url.searchParams.get('dry') === '1';
  const db = serverClient();
  const report = {
    dryRun, provider: (process.env.EMAIL_VERIFY_API_KEY || '').trim() ? 'reoon' : 'off (EMAIL_VERIFY_API_KEY not set)',
    examined: 0, valid: 0, catchAll: 0, invalid: 0, unknown: 0, errors: [], contacts: []
  };
  if (report.provider.startsWith('off')) return Response.json(report);

  // Unverified contacts, plus UNKNOWN ones not re-tried in the last 7 days.
  const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const { data: rows } = await db.from('contacts')
    .select('contact_id, company_id, email, email_type, verification_status, last_verified, objected')
    .eq('objected', false)
    .or(`verification_status.eq.UNVERIFIED,and(verification_status.eq.UNKNOWN,last_verified.lt.${cutoff})`)
    .order('date_added', { ascending: true }).limit(limit);

  for (const c of rows ?? []) {
    report.examined++;
    const r = await verifyEmail(c.email);
    if (!r.checked || r.error) { report.errors.push(`${c.email}: ${r.error ?? 'not checked'}`); continue; }
    const entry = { email: c.email, type: c.email_type, result: r.result, why: r.why };
    report.contacts.push(entry);
    report[{ VALID: 'valid', CATCH_ALL: 'catchAll', INVALID: 'invalid', UNKNOWN: 'unknown' }[r.result]]++;
    if (dryRun) continue;
    const now = new Date().toISOString();
    const patch = { verification_status: r.result, last_verified: now };
    if (r.result === 'VALID' || r.result === 'CATCH_ALL') patch.verified_at = now;
    if (r.result === 'INVALID') patch.hard_bounced = true; // never attempt an address that does not exist
    const { error } = await db.from('contacts').update(patch).eq('contact_id', c.contact_id);
    if (error) { report.errors.push(`${c.email}: ${error.message}`); continue; }
    await db.from('activity_log').insert({
      actor: 'SYSTEM:email-verification', action: 'EMAIL_VERIFIED', entity_type: 'contacts',
      entity_id: c.contact_id, company_id: c.company_id,
      detail: { email: c.email, provider: 'reoon', result: r.result, raw: r.raw }, outcome: r.why
    });
  }
  report.outreachTriggered = false;
  return Response.json(report);
}
