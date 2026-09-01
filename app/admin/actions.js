'use server';
import { revalidatePath } from 'next/cache';
import { serverClient } from '../../lib/supabase';
import { isSignedIn } from '../../lib/adminAuth';
import { confirmWebsite, extractSignals } from '../../lib/research';

const ACTOR = 'HUMAN:Aimal Mazidi';

async function guard() {
  if (!(await isSignedIn())) throw new Error('Not signed in');
  return serverClient();
}

async function log(db, action, company, detail, outcome) {
  await db.from('activity_log').insert({
    actor: ACTOR, action, entity_type: 'companies', entity_id: company.company_id,
    company_id: company.company_id, detail, outcome
  });
}

async function company(db, id) {
  const { data, error } = await db.from('companies').select('*').eq('company_id', id).single();
  if (error || !data) throw new Error('Company not found');
  return data;
}

/** Record a website the owner has found, only if the page proves it is theirs. */
export async function setWebsite(prev, formData) {
  const db = await guard();
  const id = formData.get('company_id');
  const url = String(formData.get('url') || '').trim();
  const c = await company(db, id);
  if (!url) return { error: 'Enter a web address.' };

  const r = await confirmWebsite({ url, legalName: c.legal_name, postcode: c.postcode });
  if (!r.ok) {
    await log(db, 'WEBSITE_REJECTED', c, { url, why: r.why }, 'not recorded');
    return { error: r.why };
  }
  const signals = extractSignals({ text: r.text, html: r.html, domain: r.domain });
  const { error } = await db.from('companies').update({
    website: r.url, domain: r.domain,
    research_summary: `Website confirmed by owner via ${r.confirmedVia}. ${signals.namedPeopleCount ?? 0} people named. Role addresses: ${(signals.roleEmails ?? []).join(', ') || 'none found'}.`,
    notes: (c.notes || '').replace(/NEEDS_REVIEW: no website confirmed\s*/g, '').trim() || null,
    date_verified: new Date().toISOString()
  }).eq('company_id', id);
  if (error) return { error: error.message };
  await log(db, 'WEBSITE_CONFIRMED', c, { url: r.url, domain: r.domain, via: r.confirmedVia, role_emails: signals.roleEmails ?? [] }, 'recorded');
  revalidatePath(`/admin/companies/${id}`); revalidatePath('/admin/companies'); revalidatePath('/admin');
  return { ok: `Recorded ${r.domain} (matched by ${r.confirmedVia}).` };
}

const ALLOWED = new Set(['QUALIFIED', 'RESEARCHED', 'LOST', 'DO_NOT_CONTACT']);

/** Owner's pipeline decision on a company. */
export async function setStatus(prev, formData) {
  const db = await guard();
  const id = formData.get('company_id');
  const status = String(formData.get('status') || '');
  const reason = String(formData.get('reason') || '').trim().slice(0, 500);
  if (!ALLOWED.has(status)) return { error: 'That status cannot be set from here.' };
  const c = await company(db, id);
  if (status === 'QUALIFIED' && !c.website) return { error: 'A company cannot be qualified without a confirmed website.' };

  const { error } = await db.from('companies').update({ pipeline_status: status }).eq('company_id', id);
  if (error) return { error: error.message };

  // Do-not-contact is a permanent objection at company level: suppress the domain too.
  if (status === 'DO_NOT_CONTACT' && c.domain) {
    await db.from('suppression').insert({
      email: null, email_domain: c.domain, company_name: c.legal_name,
      reason: reason || 'Owner marked do not contact', source: 'dashboard', permanent: true
    });
  }
  await log(db, 'STATUS_SET_BY_OWNER', c, { from: c.pipeline_status, to: status, reason }, status);
  revalidatePath(`/admin/companies/${id}`); revalidatePath('/admin/companies'); revalidatePath('/admin');
  return { ok: `Status set to ${status.replace(/_/g, ' ').toLowerCase()}.` };
}

export async function addNote(prev, formData) {
  const db = await guard();
  const id = formData.get('company_id');
  const note = String(formData.get('note') || '').trim().slice(0, 2000);
  if (!note) return { error: 'Write something first.' };
  const c = await company(db, id);
  const stamp = new Date().toISOString().slice(0, 10);
  const notes = [c.notes, `[${stamp}] ${note}`].filter(Boolean).join('\n');
  const { error } = await db.from('companies').update({ notes }).eq('company_id', id);
  if (error) return { error: error.message };
  await log(db, 'NOTE_ADDED', c, { note }, 'saved');
  revalidatePath(`/admin/companies/${id}`);
  return { ok: 'Note saved.' };
}
