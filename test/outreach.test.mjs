const { addBusinessDays, render, displayName, personalisationClause } = await import('../lib/outreach.js');
let pass = 0, fail = 0;
const check = (ok, name) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : '*** FAIL ***'}  ${name}`); };

const fri = new Date('2026-09-04T10:00:00Z'); // Friday
check(addBusinessDays(fri, 1).toISOString().startsWith('2026-09-07'), 'Friday + 1 business day = Monday');
check(addBusinessDays(fri, 4).toISOString().startsWith('2026-09-10'), 'Friday + 4 business days = Thursday');
check(addBusinessDays(new Date('2026-09-01T10:00:00Z'), 25).toISOString().startsWith('2026-10-06'), 'day 25 lands 5 weeks later');

check(displayName('MSS ACCOUNTANCY SERVICES LTD') === 'MSS Accountancy Services', 'legal name made readable, acronym kept');
check(displayName('HANSEN SWEENEY LIMITED') === 'Hansen Sweeney', 'LIMITED dropped');
check(personalisationClause({ personalisation_fact: 'accountancy practice based in London' }) === '', 'generic fact produces no clause');
check(personalisationClause({ personalisation_fact: 'team page lists around 4 people' }).includes('team of around 4'), 'team-size fact used');
check(personalisationClause({ personalisation_fact: null }) === '', 'no fact, no clause');

const tpl = { subject: 'Backups at {company_name}', body: 'Hello {first_name},\n\nX{personalisation_clause}.\n\nAimal' };
const out = render(tpl, { contact: { first_name: 'Sylvia' }, company: { legal_name: 'ACCOUNTING SQUARE LIMITED', personalisation_fact: null }, unsubscribeUrl: 'https://x/u?o=1' });
check(out.subject === 'Backups at Accounting Square', 'subject rendered');
check(out.body.includes('Hello Sylvia,') && out.body.includes('https://x/u?o=1') && out.body.includes('15350516'), 'body has greeting, opt-out link and company number');
check(!/\{\w+\}/.test(out.body), 'no unfilled placeholders');
const anon = render(tpl, { contact: { first_name: null }, company: { legal_name: 'X LTD' }, unsubscribeUrl: 'u' });
check(anon.body.startsWith('Hello there,'), 'no name falls back to "there"');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
