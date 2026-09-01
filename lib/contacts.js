// Contact discovery: who at a qualified company do we write to, and at
// which address? Names come from the Companies House register; addresses
// come only from the company's own website. Nothing is guessed.

import { fetchPage, strip } from './research';
import { activeOfficers } from './companiesHouse';

const ROLE_LOCALPARTS = ['info','office','admin','enquiries','enquiry','hello','contact','accounts','reception','mail','support','partners','team'];
const PAGES = ['', '/contact', '/contact-us', '/about', '/about-us', '/team', '/our-team', '/meet-the-team', '/people', '/our-people'];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function onDomain(email, domain) {
  const d = email.split('@')[1];
  return d === domain || d.endsWith('.' + domain);
}

/** Every address on the company's own domain, with the page it was seen on. */
export async function collectAddresses(website, domain) {
  let origin;
  try { origin = new URL(website).origin; } catch { return { found: [], pagesRead: 0 }; }
  const found = new Map();
  let pagesRead = 0;
  for (const path of PAGES) {
    const page = await fetchPage(origin + path, 7000);
    if (!page) continue;
    pagesRead++;
    // Look in the raw HTML (mailto: links) and the visible text.
    const seen = new Set([...(page.html.match(EMAIL_RE) || []), ...(strip(page.html).match(EMAIL_RE) || [])]
      .map(e => e.toLowerCase().replace(/^mailto:/, ''))
      .filter(e => onDomain(e, domain))
      .filter(e => !/\.(png|jpg|jpeg|gif|svg|webp|js|css)$/.test(e)));
    for (const e of seen) if (!found.has(e)) found.set(e, page.finalUrl);
    if (found.size >= 12) break;
  }
  return { found: [...found].map(([email, sourceUrl]) => ({ email, sourceUrl })), pagesRead };
}

const local = e => e.split('@')[0];
const isRole = e => ROLE_LOCALPARTS.includes(local(e).replace(/[^a-z]/g, ''));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/** Does this address plausibly belong to this officer? Surname must appear. */
function belongsTo(email, person) {
  const l = norm(local(email));
  const sn = norm(person.surname), fn = norm(person.firstName);
  if (!sn || sn.length < 3) return false;
  if (l.includes(sn)) return true;
  if (fn && l === fn) return true;          // "aimal@" on a small firm
  if (fn && l === fn[0] + sn) return true;  // "amazidi@"
  return false;
}

/**
 * Decide the contact for a company. Returns { contact, why } or { contact: null, why }.
 * Preference order, per the LIA: a role address addressed to a named director,
 * then a director's own published address, then nothing.
 */
export async function discoverContact(company) {
  const officers = await activeOfficers(company.company_number);
  const { found, pagesRead } = await collectAddresses(company.website, company.domain);

  const roles = found.filter(a => isRole(a.email));
  const lead = officers[0] ?? null;

  const base = lead ? {
    first_name: lead.firstName, surname: lead.surname, job_title: lead.role,
    // A name is personal data even on a role address.
    lawful_basis: 'LEGITIMATE_INTERESTS', lia_reference: 'LIA-2026-01'
  } : {
    first_name: null, surname: null, job_title: null,
    lawful_basis: 'NOT_APPLICABLE_CORPORATE_ONLY', lia_reference: null
  };

  if (roles.length) {
    // Prefer the most generic inbox: info@ over accounts@.
    const pick = roles.sort((a, b) => ROLE_LOCALPARTS.indexOf(local(a.email)) - ROLE_LOCALPARTS.indexOf(local(b.email)))[0];
    return {
      contact: { ...base, email: pick.email, email_type: 'ROLE', source_url: pick.sourceUrl,
                 notes: lead ? `Name from Companies House officers (${lead.sourceUrl}). Address from ${pick.sourceUrl}.` : `Address from ${pick.sourceUrl}. No natural-person officer on the register.` },
      why: `role address ${pick.email}${lead ? `, addressed to ${lead.firstName} ${lead.surname} (${lead.role})` : ''}`,
      officersFound: officers.length, addressesFound: found.length, pagesRead
    };
  }

  for (const person of officers) {
    const own = found.find(a => !isRole(a.email) && belongsTo(a.email, person));
    if (own) {
      return {
        contact: { first_name: person.firstName, surname: person.surname, job_title: person.role,
                   email: own.email, email_type: 'NAMED', source_url: own.sourceUrl,
                   lawful_basis: 'LEGITIMATE_INTERESTS', lia_reference: 'LIA-2026-01',
                   notes: `Name from Companies House officers (${person.sourceUrl}). Address published at ${own.sourceUrl}.` },
        why: `published address for ${person.firstName} ${person.surname} (${person.role})`,
        officersFound: officers.length, addressesFound: found.length, pagesRead
      };
    }
  }

  return {
    contact: null,
    why: found.length
      ? `site publishes ${found.length} address(es) but none is a role inbox or matches an officer`
      : pagesRead ? 'no email address published on the site' : 'site could not be read',
    officersFound: officers.length, addressesFound: found.length, pagesRead
  };
}
