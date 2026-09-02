import { serverClient } from '../../../../lib/supabase';
import { STEP_STATUS, addBusinessDays, londonHour, render, sendViaResend } from '../../../../lib/outreach';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const SITE = 'https://backup.mazidigroup.com';

function authorised(request) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const supplied = (request.headers.get('authorization') || '').trim().replace(/^Bearer\s+/i, '').trim();
  if (!secret) return { ok: false, reason: 'CRON_SECRET is not set on this deployment' };
  if (!supplied) return { ok: false, reason: 'No bearer token was sent' };
  return supplied === secret ? { ok: true } : { ok: false, reason: 'Bearer token did not match CRON_SECRET' };
}

async function config(db) {
  const { data } = await db.from('app_config').select('key,value');
  return Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
}

export async function GET(request) {
  const auth = authorised(request);
  if (!auth.ok) return Response.json({ error: 'Unauthorised', reason: auth.reason }, { status: 401 });

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dry') === '1';
  const force = url.searchParams.get('force_window') === '1' && dryRun; // preview outside hours, dry only
  const db = serverClient();
  const cfg = await config(db);
  const now = new Date();

  const report = { dryRun, sent: 0, skipped: {}, halted: null, candidates: [], errors: [] };
  const skip = why => { report.skipped[why] = (report.skipped[why] ?? 0) + 1; };

  // ---- Global gates, cheapest first --------------------------------------
  const enabled = String(cfg.OUTREACH_ENABLED ?? 'false').toLowerCase() === 'true';
  if (!enabled && !dryRun) { report.halted = 'OUTREACH_ENABLED is false'; return Response.json(report); }

  const { hour, isWeekday } = londonHour(now);
  const [winStart, winEnd] = String(cfg.SEND_WINDOW_LONDON ?? '9-17').split('-').map(Number);
  if (!force && (!isWeekday || hour < winStart || hour >= winEnd)) {
    report.halted = `outside send window (London ${hour}:00, window ${winStart}-${winEnd} weekdays)`;
    return Response.json(report);
  }

  const dailyCap = Number(cfg.DAILY_SEND_CAP ?? 10);
  const startOfDay = new Date(now); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: sentToday } = await db.from('outreach').select('*', { count: 'exact', head: true })
    .gte('sent_at', startOfDay.toISOString()).in('delivery_status', ['SENT', 'DELIVERED']);
  const hoursLeft = Math.max(1, winEnd - hour);
  const perRun = Math.max(1, Math.ceil((dailyCap - (sentToday ?? 0)) / hoursLeft));
  const budget = Math.min(perRun, dailyCap - (sentToday ?? 0));
  report.budget = { dailyCap, sentToday: sentToday ?? 0, thisRun: budget };
  if (budget <= 0) { report.halted = 'daily cap reached'; return Response.json(report); }

  // Bounce circuit breaker over the last 14 days.
  const since = new Date(now.getTime() - 14 * 86400 * 1000).toISOString();
  const { data: recent } = await db.from('outreach').select('delivery_status').gte('created_at', since);
  const total = (recent ?? []).filter(r => ['SENT', 'DELIVERED', 'BOUNCED'].includes(r.delivery_status)).length;
  const bounced = (recent ?? []).filter(r => r.delivery_status === 'BOUNCED').length;
  const circuitPct = Number(cfg.BOUNCE_RATE_CIRCUIT_PCT ?? 4);
  if (total >= 10 && (bounced / total) * 100 >= circuitPct) {
    report.halted = `bounce circuit breaker: ${bounced}/${total} bounced in 14 days (limit ${circuitPct}%)`;
    if (!dryRun) await db.from('activity_log').insert({ actor: 'SYSTEM:outreach', action: 'OUTREACH_HALTED', entity_type: 'outreach', outcome: report.halted, detail: { bounced, total } });
    return Response.json(report);
  }

  // ---- Campaign and templates --------------------------------------------
  const { data: campaign } = await db.from('campaigns').select('campaign_id, name').eq('active', true).limit(1).single();
  if (!campaign) { report.halted = 'no active campaign'; return Response.json(report); }
  const { data: templates } = await db.from('email_templates').select('*').eq('campaign_id', campaign.campaign_id).eq('active', true);
  const byStep = Object.fromEntries((templates ?? []).map(t => [t.sequence_step, t]));
  if (![1, 2, 3, 4].every(s => byStep[s])) { report.halted = 'sequence templates incomplete'; return Response.json(report); }
  const offsets = String(cfg.SEQUENCE_DAYS ?? '0,4,11,25').split(',').map(Number);

  // ---- Candidates ---------------------------------------------------------
  // Contacts at qualified-or-in-sequence companies, with what has been sent so far.
  const { data: contacts } = await db.from('contacts')
    .select('contact_id, company_id, email, first_name, email_type, verification_status, objected, hard_bounced, companies!inner(company_id, legal_name, pipeline_status, personalisation_fact, personalisation_source_url, is_customer)')
    .in('companies.pipeline_status', ['QUALIFIED', 'CONTACTED', 'FOLLOW_UP_1', 'FOLLOW_UP_2'])
    .eq('objected', false).eq('hard_bounced', false)
    .in('verification_status', ['VALID', 'CATCH_ALL']);

  const ids = (contacts ?? []).map(c => c.contact_id);
  const { data: history } = ids.length
    ? await db.from('outreach').select('contact_id, sequence_step, sent_at, delivery_status, replied').in('contact_id', ids)
    : { data: [] };

  const due = [];
  for (const c of contacts ?? []) {
    const sent = (history ?? []).filter(h => h.contact_id === c.contact_id && ['SENT', 'DELIVERED'].includes(h.delivery_status))
      .sort((a, b) => a.sequence_step - b.sequence_step);
    if (sent.some(h => h.replied)) { skip('replied'); continue; }
    const nextStep = sent.length + 1;
    if (nextStep > 4) { skip('sequence complete'); continue; }
    if (nextStep === 1) { due.push({ c, step: 1 }); continue; }
    const first = new Date(sent[0].sent_at);
    const dueAt = addBusinessDays(first, offsets[nextStep - 1]);
    if (now >= dueAt) due.push({ c, step: nextStep }); else skip('follow-up not yet due');
  }
  // Follow-ups before new first contacts, oldest first.
  due.sort((a, b) => b.step - a.step);

  // ---- Send ---------------------------------------------------------------
  for (const { c, step } of due) {
    if (report.sent >= budget) { skip('budget for this run used'); continue; }

    // The database gate. Fail closed: any error is a block.
    let blockers;
    try {
      const { data, error } = await db.rpc('send_blockers', { p_contact_id: c.contact_id });
      if (error) throw error;
      blockers = (data ?? []).map(r => r.blocker);
    } catch (e) { report.errors.push(`${c.email}: send_blockers failed: ${e.message}`); skip('gate error'); continue; }
    // In a dry run the kill switch is expected to be on; report everything else.
    const effective = dryRun ? blockers.filter(b => b !== 'OUTREACH_DISABLED') : blockers;
    if (effective.length) { skip(effective.join('+')); report.candidates.push({ email: c.email, step, blocked: effective }); continue; }

    const company = c.companies;
    const template = byStep[step];
    // The unsubscribe token is the outreach row's own id: random, stored, and
    // tied to this exact message. Create the row first so the id exists.
    const outreachId = crypto.randomUUID();
    const unsubscribeUrl = `${SITE}/api/unsubscribe?o=${outreachId}`;
    const msg = render(template, { contact: c, company, unsubscribeUrl });
    const checks = { blockers_checked: blockers, gate: 'send_blockers()', template_version: template.version,
                     daily_cap: dailyCap, sent_today_before: sentToday ?? 0, window: `${winStart}-${winEnd} London`,
                     lia: c.email_type === 'NAMED' || c.first_name ? 'LIA-2026-01' : 'corporate-only', checked_at: now.toISOString() };

    report.candidates.push({ email: c.email, company: company.legal_name, step, subject: msg.subject,
                             preview: dryRun ? msg.body : undefined, blocked: [] });
    if (dryRun) { report.sent++; continue; }

    try {
      const { error: insErr } = await db.from('outreach').insert({
        outreach_id: outreachId, company_id: company.company_id, contact_id: c.contact_id,
        campaign_id: campaign.campaign_id, template_id: template.template_id, sequence_step: step,
        subject: msg.subject, body: msg.body, personalisation_used: msg.personalisationUsed,
        compliance_checks_passed: checks, delivery_status: 'QUEUED', scheduled_at: now.toISOString(),
        next_action: step < 4 ? 'FOLLOW_UP' : 'CLOSE_IF_NO_REPLY',
        next_action_due: addBusinessDays(step === 1 ? now : new Date((history ?? []).find(h => h.contact_id === c.contact_id && h.sequence_step === 1)?.sent_at ?? now), step < 4 ? offsets[step] : 14).toISOString().slice(0, 10)
      });
      if (insErr) throw insErr; // unique index outreach_no_duplicate_step guards double sends

      const { id } = await sendViaResend({ to: c.email, subject: msg.subject, text: msg.body, unsubscribeUrl,
        tags: [{ name: 'campaign', value: 'c1' }, { name: 'step', value: String(step) }] });

      await db.from('outreach').update({ delivery_status: 'SENT', sent_at: new Date().toISOString(), provider_message_id: id }).eq('outreach_id', outreachId);
      await db.from('companies').update({ pipeline_status: STEP_STATUS[step] }).eq('company_id', company.company_id);
      await db.from('activity_log').insert({
        actor: 'SYSTEM:outreach', action: 'EMAIL_SENT', entity_type: 'outreach', entity_id: outreachId, company_id: company.company_id,
        detail: { to: c.email, step, template_version: template.version, provider_message_id: id, checks }, outcome: STEP_STATUS[step]
      });
      report.sent++;
    } catch (e) {
      report.errors.push(`${c.email} step ${step}: ${e.message}`);
      await db.from('outreach').update({ delivery_status: 'FAILED', bounce_detail: e.message }).eq('outreach_id', outreachId);
      await db.from('activity_log').insert({ actor: 'SYSTEM:outreach', action: 'EMAIL_FAILED', entity_type: 'outreach', entity_id: outreachId, company_id: company.company_id, detail: { to: c.email, step, error: e.message }, outcome: 'FAILED' });
    }
  }

  // Close out sequences that finished with no reply.
  if (!dryRun) {
    const { data: finals } = await db.from('outreach').select('company_id, sent_at').eq('sequence_step', 4).in('delivery_status', ['SENT', 'DELIVERED']).eq('replied', false);
    for (const f of finals ?? []) {
      if (now >= addBusinessDays(new Date(f.sent_at), 14)) {
        await db.from('companies').update({ pipeline_status: 'NO_RESPONSE' }).eq('company_id', f.company_id).eq('pipeline_status', 'FINAL_FOLLOW_UP');
      }
    }
  }
  report.outreachTriggered = report.sent > 0 && !dryRun;
  return Response.json(report);
}
