// Contact discovery rules that can be tested without the network.
const { activeOfficers } = await import('../lib/companiesHouse.js');
let pass = 0, fail = 0;
const check = (ok, name) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : '*** FAIL ***'}  ${name}`); };

// Officer name parsing: register format "SURNAME, Forenames"
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ items: [
  { name: 'MAZIDI, Aimal', officer_role: 'director', appointed_on: '2023-12-01' },
  { name: "O'BRIEN, Mary Jane", officer_role: 'director', appointed_on: '2019-03-01' },
  { name: 'SMITH, John', officer_role: 'director', appointed_on: '2015-01-01', resigned_on: '2020-01-01' },
  { name: 'ACME NOMINEES LTD', officer_role: 'corporate-director', appointed_on: '2010-01-01', identification: {} },
  { name: 'JONES, Peter', officer_role: 'secretary', appointed_on: '2010-01-01' }
] }) });
process.env.COMPANIES_HOUSE_API_KEY = 'test';
const people = await activeOfficers('00000000');
check(people.length === 2, `only active natural-person directors kept (${people.length})`);
check(people[0].surname === "O'Brien" && people[0].firstName === 'Mary', 'longest-serving first, name cased, first forename only');
check(people[1].firstName === 'Aimal' && people[1].surname === 'Mazidi' && people[1].role === 'Director', 'register name parsed');


const { collectAddresses } = await import('../lib/contacts.js');
globalThis.fetch = async (url) => ({
  ok: true, status: 200, url: String(url), headers: { get: () => 'text/html' },
  text: async () => String(url).endsWith('/get-in-touch')
    ? '<p>Email us: <a href="/cdn-cgi/l/email-protection" data-cfemail="a9c0c7cfc6e9cfc0dbc487cac687dcc2">[email protected]</a> or hello [at] firm dot co dot uk</p>'
    : '<a href="/get-in-touch">Get in touch</a><a href="/blog">Blog</a>'
});
const r = await collectAddresses('https://firm.co.uk', 'firm.co.uk');
const emails = r.found.map(a => a.email).sort();
check(emails.includes('info@firm.co.uk'), `Cloudflare-obfuscated address decoded (${emails.join(', ')})`);
check(emails.includes('hello@firm.co.uk'), '"[at] ... dot" spelling decoded');
check(r.found.every(a => a.sourceUrl.endsWith('/get-in-touch')), 'contact link discovered from the homepage and used as source');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
