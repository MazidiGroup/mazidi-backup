// Lead scoring. Every rule that fires is recorded with its points, so the
// question "why did we email this company?" has a stored answer.

const TIER_A = new Set([
  '69201','69202','69203',            // accountancy, bookkeeping, tax
  '71111','71112',                    // architectural
  '71122','71129',                    // engineering consultancy
  '78109','78200',                    // recruitment
  '74100',                            // specialised design
  '68320'                             // property management
]);

const TIER_B = new Set([
  '68310','68209','41201','73110','73200','71200','68201'
]);

const DISQUALIFYING_SIC = new Set([
  '62020','62090','63110','62012','61900',  // IT / hosting - likely an MSP or cloud-native
  '64191','65110','86101'                   // banks, insurers, hospitals - too regulated for validation
]);

const MONTH = 30.44 * 86400 * 1000;
const monthsSince = (iso, now) => iso ? (now - new Date(iso).getTime()) / MONTH : null;

/**
 * Hard exclusions. A company with any of these is not a lead and is never
 * written to the CRM, whatever else it scores. Returned as a list so the
 * discovery report can say why.
 *
 * Liveness: the owner's rule is that a company with no filing in the last
 * 12 months is not treated as trading. The confirmation statement is annual
 * and mandatory, so "last confirmation made up to" older than 12 months
 * (plus the 14-day filing window) means nobody is keeping the company alive.
 * Companies too young to have filed one are exempt here and handled by a
 * deduction in the score instead.
 */
export function exclusions(c, now = Date.now()) {
  const out = [];
  const sic = c.sicCodes ?? [];
  if (sic.some(s => DISQUALIFYING_SIC.has(s)))        out.push('disqualifying_sic');
  if (c.companyStatus && c.companyStatus !== 'active') out.push('not_active');
  if (c.employeeBand === 'dormant')                    out.push('dormant_company');
  if (c.employeeBand === '50+')                        out.push('too_large');
  if (!['CORPORATE_LIMITED','CORPORATE_LLP','CORPORATE_OTHER'].includes(c.subscriberStatus))
                                                       out.push('not_a_corporate_subscriber');
  if (c.accountsOverdue)                               out.push('accounts_overdue');
  if (c.confirmationOverdue)                           out.push('confirmation_statement_overdue');
  const age = monthsSince(c.incorporationDate, now);
  const lastConf = monthsSince(c.lastConfirmationMadeUpTo, now);
  const stale = c.staleFilingMonths ?? 12;
  if (lastConf !== null && lastConf > stale + 0.5)     out.push('no_filing_in_12_months');
  if (lastConf === null && age !== null && age > stale + 1) out.push('no_filing_in_12_months');
  if (c.placesBusinessStatus === 'CLOSED_PERMANENTLY') out.push('google_says_closed');
  return out;
}

export function scoreCompany(c, now = Date.now()) {
  const b = {};
  const add = (k, pts) => { if (pts) b[k] = pts; };

  const sic = c.sicCodes ?? [];
  if (sic.some(s => TIER_A.has(s)))      add('target_sector_tier_a', 20);
  else if (sic.some(s => TIER_B.has(s))) add('target_sector_tier_b', 12);

  // Size band from accounts category. Micro-entity is the sweet spot.
  if (c.employeeBand === '1-10')       add('employee_band_fits', 15);
  else if (c.employeeBand === '10-50') add('employee_band_maybe', 7);

  if (c.hasOfficeSignal)   add('local_physical_office', 10);
  // Distance is close to disqualifying, not a mild preference. The product
  // requires an on-site installation, so a firm we cannot drive to is not a
  // lead however good it looks on every other axis.
  const radius = c.serviceRadiusMiles ?? 30;
  if (c.distanceMiles !== null && c.distanceMiles !== undefined) {
    if (c.distanceMiles <= radius)          add('within_service_radius', 10);
    else if (c.distanceMiles <= radius + 15) add('just_outside_radius', 3);
  }
  if (['CORPORATE_LIMITED','CORPORATE_LLP'].includes(c.subscriberStatus)) add('active_ltd_or_llp', 10);
  else if (c.subscriberStatus === 'CORPORATE_OTHER')                      add('active_corporate_other', 6);

  if (sic.some(s => TIER_A.has(s)))     add('handles_important_files', 10);
  if (c.roleEmails?.length)             add('business_contact_address', 10);
  if (c.websiteConfirmed)               add('established_website', 5);
  if ((c.namedPeopleCount ?? 0) >= 3)   add('multiple_workstations_implied', 5);
  if (c.mentionsInternalIT === false)   add('no_internal_it_visible', 5);

  // Deductions
  if (c.employeeBand === '50+')         add('too_large', -30);
  if (c.employeeBand === 'dormant')     add('dormant_company', -60);
  if (c.companyStatus && c.companyStatus !== 'active') add('not_active', -60);
  if (!['CORPORATE_LIMITED','CORPORATE_LLP','CORPORATE_OTHER'].includes(c.subscriberStatus))
                                        add('not_a_corporate_subscriber', -60);
  if (c.looksLikeITProvider)            add('appears_to_be_an_it_provider', -40);
  if (c.looksLikeCloudNative)           add('cloud_native_or_datacentre', -30);
  // Liveness. These are soft: the hard cases are in exclusions().
  const age = monthsSince(c.incorporationDate, now);
  if (age !== null && age < 12)         add('incorporated_under_12_months', -20);
  else if (age !== null && age >= 36)   add('trading_three_years_or_more', 5);
  if (c.placesChecked) {
    if (c.placesFound) {
      add('google_business_listing', 10);
      if ((c.placesRatingCount ?? 0) >= 3) add('has_google_reviews', 5);
      if (c.placesBusinessStatus === 'CLOSED_TEMPORARILY') add('google_says_temporarily_closed', -25);
    } else {
      add('no_google_business_listing', -15);
    }
  }
  if (c.mentionsInternalIT)             add('has_internal_it_staff', -10);
  if (c.distanceMiles !== null && c.distanceMiles !== undefined && c.distanceMiles > radius + 15)
                                        add('outside_service_area', -70);

  const score = Math.max(-100, Math.min(100, Object.values(b).reduce((a, x) => a + x, 0)));
  const excluded = exclusions(c, now);
  return { score, breakdown: b, reason: explain(b, excluded), excluded };
}

// Every rule that fired, so the text always sums to the score.
function explain(b, excluded = []) {
  const pos = Object.entries(b).filter(([, v]) => v > 0).sort((a, c) => c[1] - a[1]);
  const neg = Object.entries(b).filter(([, v]) => v < 0);
  const fmt = ([k, v]) => `${k.replace(/_/g, ' ')} (${v > 0 ? '+' : ''}${v})`;
  const parts = [];
  if (excluded.length) parts.push('Excluded: ' + excluded.map(k => k.replace(/_/g, ' ')).join(', '));
  if (pos.length) parts.push('For: ' + pos.map(fmt).join(', '));
  if (neg.length) parts.push('Against: ' + neg.map(fmt).join(', '));
  return parts.join('. ') || 'No scoring signals found.';
}

/**
 * One personalisation fact, or none. Never invented, always sourced.
 */
export function personalisation(c) {
  if (c.multipleOffices && c.websiteUrl)
    return { fact: 'operates from more than one office', url: c.websiteUrl };
  if ((c.namedPeopleCount ?? 0) >= 3 && c.hasTeamPage && c.websiteUrl)
    return { fact: `team page lists around ${c.namedPeopleCount} people`, url: c.websiteUrl };
  if (c.city && c.sector)
    return { fact: `${c.sector} practice based in ${c.city}`, url: c.sourceUrl ?? null };
  return { fact: null, url: null };
}

export function sectorFromSic(sic = []) {
  if (sic.some(s => ['69201','69202','69203'].includes(s))) return 'accountancy';
  if (sic.some(s => ['71111','71112'].includes(s)))         return 'architecture';
  if (sic.some(s => ['71122','71129'].includes(s)))         return 'engineering consultancy';
  if (sic.some(s => ['78109','78200'].includes(s)))         return 'recruitment';
  if (sic.some(s => s === '74100'))                          return 'design';
  if (sic.some(s => s === '68320'))                          return 'property management';
  if (sic.some(s => s === '68310'))                          return 'estate agency';
  return null;
}
