const { scoreCompany, exclusions, sectorFromSic } = await import('../lib/scoring.js');
const NOW = Date.parse('2026-09-01T12:00:00Z');

const cases = [
  ['Ideal target: 8-person W12 accountancy practice', {
    sicCodes:['69201'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:2.4, websiteConfirmed:true,
    hasOfficeSignal:true, roleEmails:['info@x.co.uk'], namedPeopleCount:8,
    mentionsInternalIT:false, looksLikeITProvider:false, looksLikeCloudNative:false
  }, 'QUALIFY'],

  ['Bookkeeping LLP, no website found', {
    sicCodes:['69202'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LLP', distanceMiles:11, websiteConfirmed:false,
    hasOfficeSignal:false, roleEmails:[], namedPeopleCount:0, mentionsInternalIT:undefined
  }, 'below threshold - cannot personalise or contact'],

  ['Managed IT provider that also files under 69201', {
    sicCodes:['69201','62020'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:5, websiteConfirmed:true,
    hasOfficeSignal:true, roleEmails:['info@x.co.uk'], namedPeopleCount:6,
    mentionsInternalIT:false, looksLikeITProvider:true
  }, 'MUST NOT QUALIFY'],

  ['Limited partnership (not a corporate subscriber)', {
    sicCodes:['69201'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'NOT_ELIGIBLE', distanceMiles:3, websiteConfirmed:true,
    hasOfficeSignal:true, roleEmails:['info@x.co.uk'], namedPeopleCount:5,
    mentionsInternalIT:false
  }, 'MUST NOT QUALIFY'],

  ['80-person firm filing full accounts', {
    sicCodes:['69201'], employeeBand:'50+', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:6, websiteConfirmed:true,
    hasOfficeSignal:true, roleEmails:['info@x.co.uk'], namedPeopleCount:40,
    mentionsInternalIT:true
  }, 'MUST NOT QUALIFY'],

  ['Good fit but in Manchester', {
    sicCodes:['69201'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:163, websiteConfirmed:true,
    hasOfficeSignal:true, roleEmails:['info@x.co.uk'], namedPeopleCount:7,
    mentionsInternalIT:false
  }, 'MUST NOT QUALIFY'],
  ['Boundary: good fit at exactly 30 miles', {
    sicCodes:['69201'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:30, websiteConfirmed:true,
    hasOfficeSignal:true, roleEmails:['info@x.co.uk'], namedPeopleCount:6,
    mentionsInternalIT:false
  }, 'QUALIFY'],

  ['Boundary: good fit at 46 miles, just past the buffer', {
    sicCodes:['69201'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:46, websiteConfirmed:true,
    hasOfficeSignal:true, roleEmails:['info@x.co.uk'], namedPeopleCount:6,
    mentionsInternalIT:false
  }, 'MUST NOT QUALIFY'],

  ['Dormant company, otherwise perfect', {
    sicCodes:['69201'], employeeBand:'dormant', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:3, websiteConfirmed:true,
    hasOfficeSignal:true, roleEmails:['info@x.co.uk'], namedPeopleCount:4,
    mentionsInternalIT:false
  }, 'MUST NOT QUALIFY'],
  // ---- Liveness and hard exclusions (added after the first dry run) ----
  ['Live firm: confirmation statement 4 months ago, 5 years old, Google listed', {
    sicCodes:['69201'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:3, websiteConfirmed:true,
    roleEmails:['info@x.co.uk'], incorporationDate:'2021-05-01',
    lastConfirmationMadeUpTo:'2026-05-01', placesChecked:true, placesFound:true,
    placesBusinessStatus:'OPERATIONAL', placesRatingCount:7
  }, 'QUALIFY'],

  ['Shell: no confirmation statement for 20 months', {
    sicCodes:['69201'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:3, websiteConfirmed:true,
    roleEmails:['info@x.co.uk'], incorporationDate:'2019-01-01',
    lastConfirmationMadeUpTo:'2025-01-01'
  }, 'MUST NOT QUALIFY'],

  ['Accounts overdue at Companies House', {
    sicCodes:['69201'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:3, websiteConfirmed:true,
    roleEmails:['info@x.co.uk'], incorporationDate:'2019-01-01',
    lastConfirmationMadeUpTo:'2026-06-01', accountsOverdue:true
  }, 'MUST NOT QUALIFY'],

  ['Disqualifying SIC is an exclusion, not a penalty', {
    sicCodes:['69201','62020'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:3, websiteConfirmed:true,
    roleEmails:['info@x.co.uk'], namedPeopleCount:6, incorporationDate:'2019-01-01',
    lastConfirmationMadeUpTo:'2026-06-01'
  }, 'MUST NOT QUALIFY'],

  ['Google says permanently closed', {
    sicCodes:['69201'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:3, websiteConfirmed:true,
    roleEmails:['info@x.co.uk'], incorporationDate:'2019-01-01',
    lastConfirmationMadeUpTo:'2026-06-01', placesChecked:true, placesFound:true,
    placesBusinessStatus:'CLOSED_PERMANENTLY', placesRatingCount:12
  }, 'MUST NOT QUALIFY'],

  ['Incorporated 5 months ago, no other signals', {
    sicCodes:['69201'], employeeBand:'unknown', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:3, websiteConfirmed:false,
    incorporationDate:'2026-04-01', lastConfirmationMadeUpTo:null
  }, 'MUST NOT QUALIFY'],

  ['Live but no Google listing when Places is on', {
    sicCodes:['69201'], employeeBand:'1-10', companyStatus:'active',
    subscriberStatus:'CORPORATE_LIMITED', distanceMiles:3, websiteConfirmed:false,
    incorporationDate:'2020-01-01', lastConfirmationMadeUpTo:'2026-03-01',
    placesChecked:true, placesFound:false
  }, 'MUST NOT QUALIFY'],
];

const T = 65;
let pass = 0, fail = 0;
for (const [name, input, expect] of cases) {
  const r = scoreCompany(input, NOW);
  const q = r.score >= T && r.excluded.length === 0;
  const mustNot = expect.includes('MUST NOT');
  const mustYes = expect === 'QUALIFY';
  let ok = true;
  if (mustNot && q) ok = false;
  if (mustYes && !q) ok = false;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : '*** FAIL ***'}  ${String(r.score).padStart(4)}  ${q ? 'QUALIFIED' : 'held back'}  ${name}`);
  const summed = Object.values(r.breakdown).reduce((a, x) => a + x, 0);
  if (Math.max(-100, Math.min(100, summed)) !== r.score) { ok = false; console.log('        breakdown does not sum to score'); }
  const shown = (r.reason.match(/\(([+-]\d+)\)/g) || []).map(x => Number(x.slice(1, -1))).reduce((a, x) => a + x, 0);
  if (shown !== summed) { ok = false; console.log(`        reason text (${shown}) does not match breakdown (${summed})`); }
  console.log(`        ${r.reason}`);
}
console.log(`\n${pass} passed, ${fail} failed  (threshold ${T})`);
process.exit(fail ? 1 : 0);
