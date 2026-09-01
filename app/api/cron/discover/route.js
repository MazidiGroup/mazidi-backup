import { serverClient } from '../../../../lib/supabase';
import { searchCompanies, companyProfile, employeeBand, subscriberStatus } from '../../../../lib/companiesHouse';
import { lookup, milesBetween } from '../../../../lib/postcode';
import { findWebsite, extractSignals } from '../../../../lib/research';
import { placesLookup } from '../../../../lib/places';
import { scoreCompany, personalisation, sectorFromSic } from '../../../../lib/scoring';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Campaign one: local accountancy and bookkeeping practices.
const CAMPAIGN_SIC = ['69201', '69202', '69203'];

/**
 * Cron authorisation.
 *
 * Both sides are trimmed: a trailing newline pasted into the environment
 * variable field is invisible and would otherwise fail silently forever.
 * The failure reason is returned so a 401 is diagnosable, but it never
 * echoes the secret or any part of it.
 */
function authorised(request) {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return { ok: false, reason: 'CRON_SECRET is not set on this deployment' };
  }

  const header = (request.headers.get('authorization') || '').trim();
  if (!header) {
    return { ok: false, reason: 'No Authorization header was sent' };
  }
  if (!/^Bearer\s/i.test(header)) {
    return { ok: false, reason: 'Authorization header must be of the form: Bearer <CRON_SECRET>' };
  }

  const supplied = header.replace(/^Bearer\s+/i, '').trim();
  if (supplied === secret) return { ok: true };

  return {
    ok: false,
    reason: 'Bearer token did not match CRON_SECRET',
    hint: supplied.length === secret.length
      ? 'Lengths match, so the characters differ — check for a copy/paste slip.'
      : `Length mismatch: sent ${supplied.length} characters, expected ${secret.length}. ` +
        'A trailing newline or a truncated paste is the usual cause.'
  };
}

async function config(db, keys) {
  const { data } = await db.from('app_config').select('key,value').in('key', keys);
  return Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
}

export async function GET(request) {
  const auth = authorised(request);
  if (!auth.ok) {
    return Response.json(
      { error: 'Unauthorised', reason: auth.reason, ...(auth.hint ? { hint: auth.hint } : {}) },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '15', 10) || 15, 40);

  const db = serverClient();
  const cfg = await config(db, ['SERVICE_POSTCODE', 'SERVICE_RADIUS_MILES', 'LEAD_SCORE_THRESHOLD',
                                'DISCOVERY_ENABLED', 'STALE_FILING_MONTHS']);
  const radius    = Number(cfg.SERVICE_RADIUS_MILES ?? 30);
  const threshold = Number(cfg.LEAD_SCORE_THRESHOLD ?? 65);
  const staleMonths = Number(cfg.STALE_FILING_MONTHS ?? 12);
  const home      = await lookup(cfg.SERVICE_POSTCODE || 'W12 0QJ');

  // Writing to the CRM needs BOTH: no dry=1 on the request AND the
  // DISCOVERY_ENABLED switch in app_config. The scheduled cron therefore
  // stays a dry run until the owner has reviewed the output and flipped it.
  const discoveryEnabled = String(cfg.DISCOVERY_ENABLED ?? 'false').toLowerCase() === 'true';
  const dryRun = url.searchParams.get('dry') === '1' || !discoveryEnabled;
  const placesEnabled = Boolean((process.env.GOOGLE_PLACES_API_KEY || '').trim());

  const report = {
    campaign: 'C1 Local Accountancy & Bookkeeping',
    dryRun,
    dryRunReason: url.searchParams.get('dry') === '1' ? 'dry=1 on request'
                : !discoveryEnabled ? 'DISCOVERY_ENABLED is not true in app_config' : null,
    placesCheck: placesEnabled ? 'on' : 'off (GOOGLE_PLACES_API_KEY not set)',
    examined: 0, skippedExisting: 0, skippedNotCorporate: 0, skippedExcluded: 0,
    excludedReasons: {}, websiteFound: 0, placesFound: 0,
    qualified: 0, needsReview: 0, belowThreshold: 0, wouldWrite: 0, written: 0,
    errors: [], companies: []
  };

  // Search the postcode districts we serve. Companies House matches `location`
  // against the registered office address.
  const districts = ['London'];
  let candidates = [];
  for (const location of districts) {
    try {
      const { items } = await searchCompanies({ sicCodes: CAMPAIGN_SIC, location, size: 100 });
      candidates.push(...items);
    } catch (e) { report.errors.push(`search ${location}: ${e.message}`); }
  }

  // Deduplicate, then drop anything already in the CRM.
  const seen = new Set();
  candidates = candidates.filter(c => !seen.has(c.companyNumber) && seen.add(c.companyNumber));

  if (candidates.length) {
    const { data: existing } = await db.from('companies')
      .select('company_number').in('company_number', candidates.map(c => c.companyNumber));
    const have = new Set((existing ?? []).map(r => r.company_number));
    const before = candidates.length;
    candidates = candidates.filter(c => !have.has(c.companyNumber));
    report.skippedExisting = before - candidates.length;
  }

  for (const c of candidates) {
    if (report.wouldWrite >= limit) break;
    report.examined++;

    try {
      // PECR gate first: if it is not a corporate subscriber we do not research it.
      const status = subscriberStatus(c.companyType);
      if (status === 'NOT_ELIGIBLE') { report.skippedNotCorporate++; continue; }

      const postcode = c.address?.postal_code ?? null;
      const here = postcode ? await lookup(postcode) : null;
      const distance = here && home ? milesBetween(home, here) : null;
      if (distance !== null && distance > radius + 15) continue;

      const profile = await companyProfile(c.companyNumber);
      const band = employeeBand(profile.accountsCategory);

      const places = placesEnabled
        ? await placesLookup({ legalName: c.legalName, postcode, city: c.address?.locality })
        : { checked: false };
      if (places.found) report.placesFound++;

      const liveness = {
        employeeBand: band.band,
        companyStatus: c.companyStatus,
        subscriberStatus: status,
        incorporationDate: profile.incorporationDate ?? c.incorporationDate ?? null,
        lastConfirmationMadeUpTo: profile.lastConfirmationMadeUpTo,
        confirmationOverdue: profile.confirmationOverdue,
        accountsOverdue: profile.accountsOverdue,
        staleFilingMonths: staleMonths,
        placesChecked: places.checked && !places.error,
        placesFound: Boolean(places.found),
        placesBusinessStatus: places.businessStatus ?? null,
        placesRatingCount: places.ratingCount ?? 0,
        placesLatestReviewAt: places.latestReviewAt ?? null
      };

      // Cheap gates first, so we do not fetch websites for companies that
      // are excluded whatever we find.
      const early = scoreCompany({ sicCodes: c.sicCodes, distanceMiles: distance, ...liveness });
      if (early.excluded.length) {
        report.skippedExcluded++;
        for (const r of early.excluded) report.excludedReasons[r] = (report.excludedReasons[r] ?? 0) + 1;
        continue;
      }

      const site = await findWebsite({ legalName: c.legalName, postcode, hintUrl: places.websiteUri ?? null });
      const signals = site ? extractSignals(site) : {};
      if (site) report.websiteFound++;

      const sector = sectorFromSic(c.sicCodes);
      const scored = scoreCompany({
        sicCodes: c.sicCodes,
        distanceMiles: distance,
        websiteConfirmed: Boolean(site),
        ...liveness,
        ...signals
      });

      const pers = personalisation({
        ...signals, websiteUrl: site?.url ?? null,
        city: c.address?.locality ?? null, sector
      });

      const row = {
        legal_name: c.legalName,
        company_number: c.companyNumber,
        company_type: c.companyType,
        corporate_subscriber_status: status,
        companies_house_status: c.companyStatus,
        incorporation_date: c.incorporationDate || null,
        sector,
        sic_codes: c.sicCodes,
        employee_estimate: band.estimate,
        website: site?.url ?? null,
        domain: site?.domain ?? null,
        address_line1: c.address?.address_line_1 ?? null,
        city: c.address?.locality ?? null,
        postcode,
        distance_miles: distance,
        source: 'companies_house_advanced_search',
        source_url: `https://find-and-update.company-information.service.gov.uk/company/${c.companyNumber}`,
        date_verified: new Date().toISOString(),
        lead_score: scored.score,
        lead_score_breakdown: scored.breakdown,
        lead_reason: scored.reason,
        research_summary: [
          site ? `Website confirmed via ${site.confirmedVia}. ${signals.namedPeopleCount ?? 0} people named. Role addresses: ${(signals.roleEmails ?? []).join(', ') || 'none found'}.`
               : 'No website could be confirmed. Needs a manual look before any contact.',
          `Last confirmation statement made up to ${profile.lastConfirmationMadeUpTo ?? 'none on file'}; last accounts to ${profile.lastAccountsMadeUpTo ?? 'none on file'} (${profile.accountsCategory ?? 'unknown category'}).`,
          places.checked
            ? (places.found ? `Google lists it as ${places.businessStatus ?? 'unknown status'} with ${places.ratingCount} reviews, newest ${places.latestReviewAt ?? 'n/a'} (${places.sourceUrl}).`
                            : places.error ? `Google Places check failed: ${places.error}.` : 'No Google Business listing found.')
            : 'Google Places not checked.'
        ].join(' '),
        personalisation_fact: pers.fact,
        personalisation_source_url: pers.url,
        // The owner's rule: no website means keep it for a manual look, never
        // qualify it automatically. QUALIFIED requires a confirmed website.
        pipeline_status: site && scored.score >= threshold ? 'QUALIFIED' : 'RESEARCHED',
        notes: !site ? 'NEEDS_REVIEW: no website confirmed' : null
      };

      if (row.pipeline_status === 'QUALIFIED') report.qualified++;
      else if (!site && scored.score >= threshold) report.needsReview++;
      else report.belowThreshold++;

      report.companies.push({
        name: row.legal_name, number: row.company_number, score: row.lead_score,
        status: row.pipeline_status, needsReview: !site,
        domain: row.domain, distance: row.distance_miles, city: row.city,
        incorporated: row.incorporation_date, lastConfirmation: profile.lastConfirmationMadeUpTo,
        google: places.checked ? (places.found ? `${places.businessStatus ?? '?'}, ${places.ratingCount} reviews, newest ${places.latestReviewAt ?? 'n/a'}` : 'not listed') : 'not checked',
        companiesHouse: row.source_url, reason: row.lead_reason
      });
      report.wouldWrite++;

      if (!dryRun) {
        const { error } = await db.from('companies').insert(row);
        if (error) { report.errors.push(`${c.companyNumber}: ${error.message}`); continue; }
        await db.from('activity_log').insert({
          actor: 'SYSTEM:lead-engine',
          action: 'COMPANY_DISCOVERED_AND_SCORED',
          entity_type: 'companies',
          detail: { company_number: c.companyNumber, score: scored.score,
                    breakdown: scored.breakdown, website_confirmed: Boolean(site),
                    places: places.checked ? { found: Boolean(places.found), status: places.businessStatus ?? null } : null },
          outcome: row.pipeline_status
        });
        report.written++;
      }
    } catch (e) {
      report.errors.push(`${c.companyNumber}: ${e.message}`);
    }
  }

  // Discovery never sends. Stated explicitly so the boundary is visible in logs.
  report.outreachTriggered = false;
  return Response.json(report);
}
