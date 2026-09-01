// Companies House public API client.
// Free key from developer.company-information.service.gov.uk.
// Rate limit is 600 requests per 5 minutes; we stay far below it.

const BASE = 'https://api.company-information.service.gov.uk';

function auth() {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) throw new Error('COMPANIES_HOUSE_API_KEY is not set');
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
}

async function ch(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    Array.isArray(v) ? v.forEach(x => url.searchParams.append(k, x))
                     : url.searchParams.set(k, String(v));
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { Authorization: auth() }, signal: ctl.signal });
    if (res.status === 429) throw new Error('Companies House rate limit hit — back off and retry');
    if (!res.ok) throw new Error(`Companies House ${res.status} on ${path}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// PECR turns on whether the subscriber is a corporate body. Only these three
// company types are bodies corporate for our purposes. A limited partnership
// (LP Act 1907) is NOT one, and is deliberately excluded.
const CORPORATE = {
  'ltd':                                        'CORPORATE_LIMITED',
  'private-limited-guarant-nsc':                'CORPORATE_OTHER',
  'private-limited-guarant-nsc-limited-exemption': 'CORPORATE_OTHER',
  'private-limited-shares-section-30-exemption':   'CORPORATE_OTHER',
  'plc':                                        'CORPORATE_OTHER',
  'llp':                                        'CORPORATE_LLP'
};

export function subscriberStatus(companyType) {
  return CORPORATE[companyType] ?? 'NOT_ELIGIBLE';
}

/**
 * Search active companies by SIC code within a postcode area.
 * `location` is matched against the registered office address.
 */
export async function searchCompanies({ sicCodes, location, size = 50, startIndex = 0 }) {
  const data = await ch('/advanced-search/companies', {
    sic_codes: sicCodes,
    location,
    company_status: 'active',
    size,
    start_index: startIndex
  });
  return {
    total: data.hits ?? 0,
    items: (data.items ?? []).map(i => ({
      legalName:        i.company_name,
      companyNumber:    i.company_number,
      companyType:      i.company_type,
      companyStatus:    i.company_status,
      incorporationDate: i.date_of_creation,
      sicCodes:         i.sic_codes ?? [],
      address:          i.registered_office_address ?? {}
    }))
  };
}

/**
 * Company profile. We want it for the accounts category, which is the only
 * free proxy Companies House offers for company size.
 */
export async function companyProfile(companyNumber) {
  const p = await ch(`/company/${encodeURIComponent(companyNumber)}`);
  return {
    accountsCategory:        p?.accounts?.last_accounts?.type ?? null,
    lastAccountsMadeUpTo:    p?.accounts?.last_accounts?.made_up_to ?? null,
    nextAccountsDue:         p?.accounts?.next_due ?? null,
    accountsOverdue:         Boolean(p?.accounts?.overdue),
    // The confirmation statement is annual and every live company must file
    // one, so its date is the cleanest free signal that a company is being
    // kept alive by someone.
    lastConfirmationMadeUpTo: p?.confirmation_statement?.last_made_up_to ?? null,
    confirmationOverdue:     Boolean(p?.confirmation_statement?.overdue),
    incorporationDate:       p?.date_of_creation ?? null,
    hasCharges:              Boolean(p?.has_charges),
    status:                  p?.company_status ?? null
  };
}

/**
 * Micro-entity accounts imply roughly ten employees or fewer; small implies
 * up to fifty. Anything filing full or group accounts is bigger than our
 * target. This is a band, not a headcount, and is treated as such.
 */
export function employeeBand(accountsCategory) {
  switch (accountsCategory) {
    case 'micro-entity': return { band: '1-10',  estimate: 6,  fits: true };
    case 'small':        return { band: '10-50', estimate: 20, fits: 'maybe' };
    case 'dormant':      return { band: 'dormant', estimate: 0, fits: false };
    case 'full':
    case 'medium':
    case 'group':        return { band: '50+',  estimate: 80, fits: false };
    default:             return { band: 'unknown', estimate: null, fits: 'maybe' };
  }
}
