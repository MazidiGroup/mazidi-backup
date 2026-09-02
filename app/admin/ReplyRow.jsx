'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { actionReply } from './actions';

export default function ReplyRow({ r, when }) {
  const [s, act, pending] = useActionState(actionReply, null);
  return (
    <tr>
      <td><span className={`tag ${r.classification === 'POSITIVE_INTERESTED' ? 'q' : 'r'}`}>{r.classification.replace(/_/g, ' ')}</span></td>
      <td>
        {r.company_id ? <Link href={`/admin/companies/${r.company_id}`}>{r.subject || r.from_email}</Link> : (r.subject || r.from_email)}
        <div className="small">{r.from_email} — {r.summary}</div>
        {r.excerpt && <div className="small" style={{ marginTop: 4, fontStyle: 'italic' }}>“{r.excerpt}”</div>}
      </td>
      <td className="small">{when}<br />
        {s?.ok ? <span className="ok">handled</span> : (
          <form action={act}><input type="hidden" name="reply_id" value={r.reply_id} /><button className="linklike" type="submit" disabled={pending} style={{ padding: 0 }}>{pending ? '…' : 'mark handled'}</button></form>
        )}
      </td>
    </tr>
  );
}
