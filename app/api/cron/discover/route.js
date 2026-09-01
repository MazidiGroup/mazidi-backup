import { serverClient } from '../../../../lib/supabase';
import { searchCompanies, companyProfile, employeeBand, subscriberStatus } from '../../../../lib/companiesHouse';
import { lookup, milesBetween } from '../../../../lib/postcode';
import { findWebsite, extractSignals } from '../../../../lib/research';
import { scoreCompany, personalisation, sectorFromSic } from '../../../../lib/scoring';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Campaign one: local accountancy and bookkeeping practices.
const CAMPAIGN_SIC = ['69201', '69202', '69203'];

function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${secret}`;
}

async function config(db, keys) {
  const { data } = await db.from('app_config').select('key,value').in('key', keys);
  return Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
}

export async function GET(request) {
  if (!authorised(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '15', 10) || 15, 40);
  const dryRun = url.searchParams.get('dry') === '1';

  const db = serverClient();
  const cfg = await config(db, ['SERVICE_POSTCODE', 'SERVICE_RADIUS_MILES', 'LEAD_SCORE_THRESHOLD']);
  const radius    = Number(cfg.SERVICE_RADIUS_MILES ?? 30);
  const threshold = Number(cfg.LEAD_SCORE_THRESHOLD ?? 65);
  const home      = await lookup(cfg.SERVICE_POSTCODE || 'W12 0QJ');

  const report = {
    campaign: 'C1 Local Accountancy & Bookkeeping',
    dryRun, examined: 0, skippedExisting: 0, skippedNotCorporate: 0,
    websiteFound: 0, qualified: 0, belowThreshold: 0, written: 0,
    errors: [], samples: []
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
    if (report.written >= limit) break;
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
      if (band.fits === false) continue;

      const site = await findWebsite({ legalName: c.legalName, postcode });
      const signals = site ? extractSignals(site) : {};
      if (site) report.websiteFound++;

      const sector = sectorFromSic(c.sicCodes);
      const scored = scoreCompany({
        sicCodes: c.sicCodes,
        employeeBand: band.band,
        companyStatus: c.companyStatus,
        subscriberStatus: status,
        distanceMiles: distance,
        websiteConfirmed: Boolean(site),
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
        research_summary: site
          ? `Website confirmed via ${site.confirmedVia}. ${signals.namedPeopleCount ?? 0} people named. Role addresses: ${(signals.roleEmails ?? []).join(', ') || 'none found'}.`
          : 'No website could be confirmed from the registered name.',
        personalisation_fact: pers.fact,
        personalisation_source_url: pers.url,
        pipeline_status: scored.score >= threshold ? 'QUALIFIED' : 'RESEARCHED'
      };

      scored.score >= threshold ? report.qualified++ : report.belowThreshold++;
      if (report.samples.length < 5) {
        report.samples.push({
          name: row.legal_name, score: row.lead_score, status: row.pipeline_status,
          domain: row.domain, distance: row.distance_miles, reason: row.lead_reason
        });
      }

      if (!dryRun) {
        const { error } = await db.from('companies').insert(row);
        if (error) { report.errors.push(`${c.companyNumber}: ${error.message}`); continue; }
        await db.from('activity_log').insert({
          actor: 'SYSTEM:lead-engine',
          action: 'COMPANY_DISCOVERED_AND_SCORED',
          entity_type: 'companies',
          detail: { company_number: c.companyNumber, score: scored.score,
                    breakdown: scored.breakdown, website_confirmed: Boolean(site) },
          outcome: row.pipeline_status
        });
      }
      report.written++;
    } catch (e) {
      report.errors.push(`${c.companyNumber}: ${e.message}`);
    }
  }

  // Discovery never sends. Stated explicitly so the boundary is visible in logs.
  report.outreachTriggered = false;
  return Response.json(report);
}
