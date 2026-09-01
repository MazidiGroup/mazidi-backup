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

const ROLE_LOCALPARTS = new Set(['info','office','admin','enquiries','enquiry','hello','contact','accounts','reception','mail','support','partners','team']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Owner adds a contact by hand. The source URL is mandatory: a contact with
 * no evidence of where it came from is exactly what the rules forbid.
 */
export async function addContact(prev, formData) {
  const db = await guard();
  const id = formData.get('company_id');
  const c = await company(db, id);
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const source = String(formData.get('source_url') || '').trim();
  const first = String(formData.get('first_name') || '').trim().slice(0, 80) || null;
  const last = String(formData.get('surname') || '').trim().slice(0, 80) || null;
  const title = String(formData.get('job_title') || '').trim().slice(0, 80) || null;

  if (!EMAIL_RE.test(email)) return { error: 'That email address does not look valid.' };
  let src;
  try { src = new URL(source); if (!/^https?:$/.test(src.protocol)) throw 0; } catch { return { error: 'Enter the full web address where you found this contact (starting https://).' }; }
  if (c.domain && !email.endsWith('@' + c.domain) && !email.endsWith('.' + c.domain)) {
    return { error: `The address must be on the company's own domain (${c.domain}).` };
  }
  const named = Boolean(first || last);
  const local = email.split('@')[0].replace(/[^a-z]/g, '');
  const row = {
    company_id: c.company_id, first_name: first, surname: last, job_title: title, email,
    email_type: ROLE_LOCALPARTS.has(local) ? 'ROLE' : 'NAMED',
    source_url: src.href, verification_status: 'UNVERIFIED',
    lawful_basis: named ? 'LEGITIMATE_INTERESTS' : 'NOT_APPLICABLE_CORPORATE_ONLY',
    lia_reference: named ? 'LIA-2026-01' : null,
    notes: `Added by owner from ${src.href}.`
  };
  const { error } = await db.from('contacts').insert(row);
  if (error) return { error: error.message };
  await db.from('companies').update({ notes: (c.notes || '').replace(/NEEDS_REVIEW: no contact address[^\n]*\n?/g, '').trim() || null }).eq('company_id', id);
  await log(db, 'CONTACT_ADDED_BY_OWNER', c, { email, email_type: row.email_type, source_url: src.href, named }, 'recorded');
  revalidatePath(`/admin/companies/${id}`); revalidatePath('/admin/companies'); revalidatePath('/admin');
  return { ok: `Contact ${email} recorded (${row.email_type.toLowerCase()} address, unverified).` };
}
