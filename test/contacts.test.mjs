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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
