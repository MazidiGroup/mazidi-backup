// Read-side queries for the owner dashboard. Server only.
import { serverClient } from './supabase';

export async function overview() {
  const db = serverClient();
  const [companies, queue, activity, cfg, leads] = await Promise.all([
    db.from('companies').select('pipeline_status, website, is_customer'),
    db.from('replies').select('reply_id, received_at, from_email, subject, classification, summary, company_id')
      .eq('human_action_required', true).is('human_actioned_at', null).order('received_at', { ascending: false }).limit(20),
    db.from('activity_log').select('occurred_at, actor, action, outcome, company_id').order('occurred_at', { ascending: false }).limit(25),
    db.from('app_config').select('key, value').in('key', ['OUTREACH_ENABLED', 'DISCOVERY_ENABLED', 'LEAD_SCORE_THRESHOLD', 'DAILY_SEND_CAP']),
    db.from('website_leads').select('lead_id, name, company_name, email, submitted_at, processed').eq('processed', false).order('submitted_at', { ascending: false }).limit(10)
  ]);
  const rows = companies.data ?? [];
  const by = {};
  for (const r of rows) by[r.pipeline_status] = (by[r.pipeline_status] ?? 0) + 1;
  return {
    total: rows.length,
    byStatus: by,
    needsReview: rows.filter(r => !r.website && !['DO_NOT_CONTACT', 'LOST'].includes(r.pipeline_status)).length,
    qualified: by.QUALIFIED ?? 0,
    customers: rows.filter(r => r.is_customer).length,
    queue: queue.data ?? [],
    activity: activity.data ?? [],
    config: Object.fromEntries((cfg.data ?? []).map(r => [r.key, r.value])),
    leads: leads.data ?? []
  };
}

export async function companies(view = 'all') {
  const db = serverClient();
  let q = db.from('companies')
    .select('company_id, legal_name, pipeline_status, lead_score, domain, website, distance_miles, city, date_discovered, notes, research_summary')
    .order('lead_score', { ascending: false }).order('date_discovered', { ascending: false }).limit(200);
  if (view === 'qualified') q = q.eq('pipeline_status', 'QUALIFIED');
  if (view === 'review')    q = q.is('website', null).not('pipeline_status', 'in', '("DO_NOT_CONTACT","LOST")');
  const { data } = await q;
  return data ?? [];
}

export async function companyDetail(id) {
  const db = serverClient();
  const [c, contacts, log] = await Promise.all([
    db.from('companies').select('*').eq('company_id', id).single(),
    db.from('contacts').select('contact_id, first_name, surname, job_title, email, email_type, verification_status, objected, source_url').eq('company_id', id),
    db.from('activity_log').select('occurred_at, actor, action, outcome, detail').eq('company_id', id).order('occurred_at', { ascending: false }).limit(30)
  ]);
  // Discovery logs by company_number in detail, before a company_id exists.
  let discovery = [];
  if (c.data) {
    const { data } = await db.from('activity_log').select('occurred_at, actor, action, outcome, detail')
      .eq('action', 'COMPANY_DISCOVERED_AND_SCORED').contains('detail', { company_number: c.data.company_number }).limit(3);
    discovery = data ?? [];
  }
  return { company: c.data, contacts: contacts.data ?? [], log: [...(log.data ?? []), ...discovery] };
}
