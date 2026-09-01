import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { isSignedIn } from '../../../../lib/adminAuth';
import { companyDetail } from '../../../../lib/admin';
import CompanyActions from './CompanyActions';

export const metadata = { title: 'Company' };
const when = iso => new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default async function Company({ params }) {
  if (!(await isSignedIn())) redirect('/admin/login');
  const { id } = await params;
  const { company: c, contacts, log } = await companyDetail(id);
  if (!c) notFound();
  const b = c.lead_score_breakdown ?? {};

  return (
    <>
      <p className="small"><Link href="/admin/companies">← Companies</Link></p>
      <h1>{c.legal_name}</h1>
      <p>
        <span className={`tag ${c.pipeline_status === 'QUALIFIED' ? 'q' : 'r'}`}>{c.pipeline_status.replace(/_/g, ' ')}</span>{' '}
        <span className="small">score {c.lead_score} · {c.distance_miles} miles · {c.sector ?? 'sector unknown'}</span>
      </p>

      <div className="cards">
        <div className="card">
          <h3>Facts on record</h3>
          <dl className="kv">
            <dt>Company number</dt><dd><a href={c.source_url} target="_blank" rel="noreferrer">{c.company_number}</a></dd>
            <dt>Incorporated</dt><dd>{c.incorporation_date ?? '—'}</dd>
            <dt>Address</dt><dd>{[c.address_line1, c.city, c.postcode].filter(Boolean).join(', ')}</dd>
            <dt>Website</dt><dd>{c.website ? <a href={c.website} target="_blank" rel="noreferrer">{c.domain}</a> : 'not confirmed'}</dd>
            <dt>Size band</dt><dd>{c.employee_estimate ? `about ${c.employee_estimate} people` : 'unknown'}</dd>
            <dt>Discovered</dt><dd>{c.date_discovered ? when(c.date_discovered) : '—'}</dd>
          </dl>
          <p className="small mt-2">{c.research_summary}</p>
          {c.personalisation_fact && <p className="small">Personalisation: “{c.personalisation_fact}” — <a href={c.personalisation_source_url} target="_blank" rel="noreferrer">source</a></p>}
        </div>

        <div className="card">
          <h3>Why this score</h3>
          <dl className="kv">
            {Object.entries(b).sort((x, y) => y[1] - x[1]).map(([k, v]) => (
              <span key={k} style={{ display: 'contents' }}>
                <dt>{k.replace(/_/g, ' ')}</dt><dd style={{ color: v < 0 ? 'var(--error)' : 'var(--ink)' }}>{v > 0 ? '+' : ''}{v}</dd>
              </span>
            ))}
          </dl>
        </div>
      </div>

      <CompanyActions company={{ company_id: c.company_id, website: c.website, pipeline_status: c.pipeline_status }} />

      <h2>Contacts</h2>
      {contacts.length === 0 ? <div className="empty">No contacts yet. Contact discovery has not run for this company.</div> : (
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Verified</th><th>Source</th></tr></thead>
          <tbody>
            {contacts.map(p => (
              <tr key={p.contact_id}>
                <td>{[p.first_name, p.surname].filter(Boolean).join(' ') || '—'}{p.objected && <span className="tag x" style={{ marginLeft: 8 }}>objected</span>}</td>
                <td>{p.job_title ?? '—'}</td><td>{p.email}</td><td>{p.verification_status ?? '—'}</td>
                <td>{p.source_url ? <a href={p.source_url} target="_blank" rel="noreferrer">link</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {c.notes && (<><h2>Notes</h2><pre className="notes">{c.notes}</pre></>)}

      <h2>History</h2>
      <ul className="log">
        {log.map((a, i) => (
          <li key={i}>
            <time>{when(a.occurred_at)}</time>
            <div>{a.action.replace(/_/g, ' ').toLowerCase()}{a.outcome ? ` — ${a.outcome}` : ''}<div className="who">{a.actor}</div></div>
          </li>
        ))}
      </ul>
    </>
  );
}
