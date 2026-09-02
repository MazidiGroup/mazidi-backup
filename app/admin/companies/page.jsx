import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSignedIn } from '../../../lib/adminAuth';
import { companies } from '../../../lib/admin';

export const metadata = { title: 'Companies' };

const titles = { all: 'All companies', qualified: 'Qualified', review: 'Needs your review' };
const tagClass = s => s === 'QUALIFIED' ? 'q' : ['DO_NOT_CONTACT', 'LOST'].includes(s) ? 'x' : 'r';

// What a human needs to do for this company, in plain words.
function why(c) {
  const n = c.notes || '';
  if (!c.website) {
    const g = (c.research_summary || '').match(/Google lists ([^\s]+) \(unverified/);
    return g ? `No website proven — Google lists ${g[1]}; open it and record it if it's theirs` : 'No website confirmed — find their site and record it';
  }
  if (/failed verification/.test(n)) return 'Published address is dead — find another and add it';
  if (/no contact address/.test(n)) return 'Site publishes no email — find an address (contact form, LinkedIn, phone) and add it';
  return 'Open to see';
}

export default async function Companies({ searchParams }) {
  if (!(await isSignedIn())) redirect('/admin/login');
  const view = (await searchParams)?.view ?? 'all';
  const rows = await companies(view);
  return (
    <>
      <h1>{titles[view] ?? titles.all}</h1>
      {view === 'review' && (
        <p className="small measure">
          These companies passed every gate but no website could be proven. Open each one, find its
          site, and paste the address in. It is only recorded if the page shows their name or postcode.
          If it is not a real prospect, mark it as such and it will stop appearing.
        </p>
      )}
      {rows.length === 0 ? <div className="empty mt-2">Nothing here yet.</div> : (
        <table className="mt-2">
          <thead><tr><th>Company</th><th>Score</th><th>Status</th>{view === 'review' ? <th>Why it's here</th> : <th>Website</th>}<th>Miles</th></tr></thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.company_id}>
                <td><Link href={`/admin/companies/${c.company_id}`}>{c.legal_name}</Link><div className="small">{c.city}</div></td>
                <td>{c.lead_score}</td>
                <td><span className={`tag ${tagClass(c.pipeline_status)}`}>{c.pipeline_status.replace(/_/g, ' ')}</span></td>
                {view === 'review' ? <td className="small">{why(c)}</td> : <td>{c.domain ?? <span className="small">none</span>}</td>}
                <td>{c.distance_miles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
