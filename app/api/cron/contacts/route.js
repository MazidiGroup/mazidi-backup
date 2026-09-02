import { serverClient } from '../../../../lib/supabase';
import { discoverContact } from '../../../../lib/contacts';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Same bearer rule as discovery. Kept identical on purpose.
function authorised(request) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const header = (request.headers.get('authorization') || '').trim();
  const supplied = header.replace(/^Bearer\s+/i, '').trim();
  if (!secret) return { ok: false, reason: 'CRON_SECRET is not set on this deployment' };
  if (!supplied) return { ok: false, reason: 'No bearer token was sent' };
  return supplied === secret ? { ok: true } : { ok: false, reason: 'Bearer token did not match CRON_SECRET' };
}

export async function GET(request) {
  const auth = authorised(request);
  if (!auth.ok) return Response.json({ error: 'Unauthorised', reason: auth.reason }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10) || 10, 30);
  const db = serverClient();
  const { data: cfg } = await db.from('app_config').select('key,value').in('key', ['DISCOVERY_ENABLED']);
  const enabled = String((cfg ?? []).find(r => r.key === 'DISCOVERY_ENABLED')?.value ?? 'false').toLowerCase() === 'true';
  const dryRun = url.searchParams.get('dry') === '1' || !enabled;

  const report = { dryRun, examined: 0, contactsCreated: 0, needsReview: 0, errors: [], companies: [] };

  // Qualified companies with a website and no contact yet.
  const { data: qualified } = await db.from('companies')
    .select('company_id, legal_name, company_number, website, domain, notes')
    .eq('pipeline_status', 'QUALIFIED').not('website', 'is', null)
    .order('lead_score', { ascending: false }).limit(60);
  const ids = (qualified ?? []).map(c => c.company_id);
  const { data: have } = ids.length ? await db.from('contacts').select('company_id').in('company_id', ids) : { data: [] };
  const done = new Set((have ?? []).map(r => r.company_id));
  const todo = (qualified ?? []).filter(c => !done.has(c.company_id)).slice(0, limit);

  for (const c of todo) {
    report.examined++;
    try {
      const r = await discoverContact(c);
      const entry = { name: c.legal_name, result: r.why, officers: r.officersFound, addresses: r.addressesFound, pages: r.pagesRead };
      if (r.contact) {
        entry.contact = { ...r.contact, notes: undefined };
        if (!dryRun) {
          const { error } = await db.from('contacts').insert({ ...r.contact, company_id: c.company_id, verification_status: 'UNVERIFIED' });
          if (error) { report.errors.push(`${c.legal_name}: ${error.message}`); continue; }
          await db.from('activity_log').insert({
            actor: 'SYSTEM:contact-discovery', action: 'CONTACT_DISCOVERED', entity_type: 'contacts', company_id: c.company_id,
            detail: { email: r.contact.email, email_type: r.contact.email_type, source_url: r.contact.source_url, name_source: 'companies_house_officers' },
            outcome: r.why
          });
        }
        report.contactsCreated++;
      } else {
        report.needsReview++;
        if (!dryRun) {
          const note = `NEEDS_REVIEW: no contact address — ${r.why}`;
          if (!(c.notes || '').includes(note)) {
            await db.from('companies').update({ notes: [c.notes, note].filter(Boolean).join('\n') }).eq('company_id', c.company_id);
          }
          await db.from('activity_log').insert({
            actor: 'SYSTEM:contact-discovery', action: 'CONTACT_NOT_FOUND', entity_type: 'companies', company_id: c.company_id,
            detail: { officers: r.officersFound, addresses: r.addressesFound, pages_read: r.pagesRead }, outcome: r.why
          });
        }
      }
      report.companies.push(entry);
    } catch (e) {
      report.errors.push(`${c.legal_name}: ${e.message}`);
    }
  }
  report.outreachTriggered = false;
  return Response.json(report);
}
