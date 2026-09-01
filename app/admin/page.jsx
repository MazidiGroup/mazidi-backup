import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSignedIn } from '../../lib/adminAuth';
import { overview } from '../../lib/admin';

export const metadata = { title: 'Dashboard' };

const when = iso => new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default async function Admin() {
  if (!(await isSignedIn())) redirect('/admin/login');
  const o = await overview();
  const on = v => String(v).toLowerCase() === 'true';

  return (
    <>
      <h1>Pipeline</h1>
      <p className="small">
        Discovery {on(o.config.DISCOVERY_ENABLED) ? 'on' : 'off'} · Outreach {on(o.config.OUTREACH_ENABLED) ? 'ON' : 'off'} ·
        Threshold {o.config.LEAD_SCORE_THRESHOLD ?? '65'} · Daily cap {o.config.DAILY_SEND_CAP ?? '10'}
      </p>

      <div className="stats mt-2">
        <Link className="stat" href="/admin/companies"><div className="n">{o.total}</div><div className="l">Companies in CRM</div></Link>
        <Link className="stat" href="/admin/companies?view=qualified"><div className="n">{o.qualified}</div><div className="l">Qualified</div></Link>
        <Link className="stat warn" href="/admin/companies?view=review"><div className="n">{o.needsReview}</div><div className="l">Need your review</div></Link>
        <div className="stat"><div className="n">{o.byStatus.CONTACTED ?? 0}</div><div className="l">In sequence</div></div>
        <div className="stat"><div className="n">{o.byStatus.POSITIVE_REPLY ?? 0}</div><div className="l">Positive replies</div></div>
        <div className="stat"><div className="n">{o.customers}</div><div className="l">Customers</div></div>
      </div>

      <h2>Waiting for you</h2>
      {o.queue.length === 0 && o.leads.length === 0
        ? <div className="empty">Nothing needs a human right now.</div>
        : (
          <table>
            <tbody>
              {o.leads.map(l => (
                <tr key={l.lead_id}>
                  <td><span className="tag q">Website enquiry</span></td>
                  <td>{l.name}{l.company_name ? `, ${l.company_name}` : ''}</td>
                  <td className="small">{when(l.submitted_at)}</td>
                </tr>
              ))}
              {o.queue.map(r => (
                <tr key={r.reply_id}>
                  <td><span className="tag q">{r.classification}</span></td>
                  <td>{r.company_id ? <Link href={`/admin/companies/${r.company_id}`}>{r.subject || r.from_email}</Link> : (r.subject || r.from_email)}<div className="small">{r.summary}</div></td>
                  <td className="small">{when(r.received_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      <h2>Recent activity</h2>
      <ul className="log">
        {o.activity.map((a, i) => (
          <li key={i}>
            <time>{when(a.occurred_at)}</time>
            <div>
              {a.action.replace(/_/g, ' ').toLowerCase()}{a.outcome ? ` — ${a.outcome}` : ''}
              {a.company_id && <> · <Link href={`/admin/companies/${a.company_id}`}>open</Link></>}
              <div className="who">{a.actor}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
