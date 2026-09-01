// Company website discovery and research.
//
// Companies House does not hold websites, so we derive candidate domains from
// the registered name and then PROVE the match before accepting it. A domain is
// only recorded if the page itself evidences the company — its name or its
// registered postcode. We never assert a website we have not confirmed.

const UA = 'MazidiGroupResearch/1.0 (+https://mazidigroup.com; business research)';
const STOP = new Set(['limited','ltd','llp','the','and','uk','co','group','company','services','partnership']);
// Words that describe the trade rather than the firm. They may appear in a
// domain, but they never PROVE a match: "accountants" is on every accountant's
// page, so it identifies nobody. Only distinctive words count as evidence.
const SECTOR = new Set(['accountant','accountants','accountancy','accounting','accounts','bookkeeping','bookkeepers',
  'tax','taxation','financial','finance','solutions','consultancy','consulting','consultants','advisory','advisors',
  'business','associates','management','london','office','professional','practice']);
const distinctive = toks => toks.filter(t => !SECTOR.has(t));

function tokens(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s&-]/g, ' ')
    .split(/[\s&-]+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

export function candidateDomains(legalName) {
  const t = tokens(legalName);
  if (!t.length) return [];
  const joined = t.join('');
  const hyphen = t.join('-');
  const first  = t[0];
  // A single-token base (just the surname) is WEAK: plenty of unrelated
  // companies share it. It is still tried, because small firms genuinely use
  // it, but it is only accepted on a postcode match - never on name alone.
  // With no distinctive word at all (e.g. "C & C Accountants Ltd") every
  // candidate is weak: it can only be accepted on a registered-postcode match.
  const allWeak = distinctive(t).length === 0;
  const strong = allWeak ? [] : [...new Set([joined, hyphen].filter(b => b.length >= 4 && b.length <= 40))];
  const weak   = allWeak
    ? [...new Set([joined, hyphen].filter(b => b.length >= 4 && b.length <= 40))]
    : (t.length > 1 && first.length >= 4 ? [first] : []);
  const tlds = ['co.uk', 'com', 'uk'];
  const out = [];
  for (const b of strong) for (const tld of tlds) out.push({ domain: `${b}.${tld}`, weak: false });
  for (const b of weak)   for (const tld of tlds) out.push({ domain: `${b}.${tld}`, weak: true });
  return out.slice(0, 9);
}

export async function fetchPage(url, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'follow', signal: ctl.signal
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) return null;
    const html = (await res.text()).slice(0, 400_000);
    return { finalUrl: res.url, html };
  } catch { return null; } finally { clearTimeout(t); }
}

export const strip = html => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ');

/**
 * Confirm a candidate domain genuinely belongs to this company.
 * Requires either a strong name-token match or the registered postcode.
 */
function isMatch(text, legalName, postcode) {
  const lower = text.toLowerCase();
  if (postcode) {
    const pc = postcode.toLowerCase().replace(/\s+/g, '');
    if (lower.replace(/\s+/g, '').includes(pc)) return { matched: true, via: 'postcode' };
  }
  const t = distinctive(tokens(legalName));
  if (!t.length) return { matched: false };
  const hits = t.filter(tok => lower.includes(tok)).length;
  // Every distinctive token must appear, and there must be at least one.
  if (hits === t.length) return { matched: true, via: 'name' };
  return { matched: false };
}

export async function findWebsite({ legalName, postcode, hintUrl = null }) {
  // A hint (e.g. the website Google lists for the business) is tried first,
  // but it is held to exactly the same proof as a guessed domain: the page
  // must evidence the company by name or registered postcode.
  const hinted = [];
  if (hintUrl) {
    try {
      const u = new URL(hintUrl);
      hinted.push({ domain: u.hostname.replace(/^www\./, ''), weak: false, url: u.origin });
    } catch { /* ignore malformed hint */ }
  }
  for (const { domain, weak, url } of [...hinted, ...candidateDomains(legalName)]) {
    const page = await fetchPage(url ?? `https://${domain}`);
    if (!page) continue;
    const text = strip(page.html);
    const m = isMatch(text, legalName, postcode);
    if (!m.matched) continue;
    // A weak base proves nothing by name alone - the postcode must confirm it.
    if (weak && m.via !== 'postcode') continue;
    return { domain, url: page.finalUrl, html: page.html, text, confirmedVia: m.via };
  }
  return null;
}

const ROLE_LOCALPARTS = ['info','office','admin','enquiries','enquiry','hello','contact','accounts','reception','mail','it','support','operations'];

/**
 * Extract only business-development signals. Nothing is collected merely
 * because it is present on the page.
 */
export function extractSignals({ text, html, domain }) {
  const lower = text.toLowerCase();

  const emails = [...new Set(
    (html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
      .map(e => e.toLowerCase())
      .filter(e => e.endsWith('@' + domain) || e.endsWith('.' + domain))
      .filter(e => !/\.(png|jpg|jpeg|gif|svg|webp)$/.test(e))
  )].slice(0, 10);

  const roleEmails = emails.filter(e => ROLE_LOCALPARTS.includes(e.split('@')[0]));

  // Team-size proxy: how many distinct people are named on the page.
  const named = new Set(
    (text.match(/\b[A-Z][a-z]{2,}\s[A-Z][a-z]{2,}\b/g) || [])
      .filter(n => !/^(Privacy|Cookie|Terms|Contact|About|Our|The|Registered|Companies|House|Chartered|Limited|Company)\b/.test(n))
  );

  const has = re => re.test(lower);

  return {
    emails,
    roleEmails,
    namedPeopleCount: named.size,
    hasTeamPage:      has(/\b(our team|the team|meet the team|our people|who we are)\b/),
    hasOfficeSignal:  has(/\b(our office|visit us|office hours|reception|head office)\b/),
    multipleOffices:  has(/\b(our offices|both offices|branches|other locations)\b/),
    mentionsInternalIT: has(/\b(it manager|it director|head of it|systems administrator|it department)\b/),
    looksLikeITProvider: has(/\b(managed (it|service)|msp|it support services|cyber ?security services|we provide it)\b/),
    looksLikeCloudNative: has(/\b(data cent(re|er)|colocation|saas platform|our cloud infrastructure)\b/),
    mentionsBackup:   has(/\b(backup|disaster recovery|business continuity)\b/)
  };
}

/**
 * Owner-supplied website, held to the same proof as a discovered one.
 * Used by the dashboard when a company is in the manual-review pile.
 */
export async function confirmWebsite({ url, legalName, postcode }) {
  let parsed;
  try { parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`); }
  catch { return { ok: false, why: 'That is not a valid web address.' }; }
  const page = await fetchPage(parsed.origin);
  if (!page) return { ok: false, why: 'The site did not respond or did not return a web page.' };
  const text = strip(page.html);
  const m = isMatch(text, legalName, postcode);
  if (!m.matched) {
    return { ok: false, why: 'The page does not show the company name or its registered postcode, so it cannot be recorded as theirs.' };
  }
  const domain = parsed.hostname.replace(/^www\./, '');
  return { ok: true, domain, url: page.finalUrl, html: page.html, text, confirmedVia: m.via };
}
