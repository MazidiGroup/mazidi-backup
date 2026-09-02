'use client';
import { useActionState } from 'react';
import { reverifyContact } from '../../actions';

export default function ReverifyButton({ contactId }) {
  const [s, act, pending] = useActionState(reverifyContact, null);
  return (
    <form action={act} style={{ display: 'inline' }}>
      <input type="hidden" name="contact_id" value={contactId} />
      <button className="linklike" type="submit" disabled={pending} style={{ padding: '0 6px', fontSize: '.85rem' }}>{pending ? '…' : 're-check'}</button>
      {s?.ok && <span className="small ok"> queued</span>}{s?.error && <span className="small err"> {s.error}</span>}
    </form>
  );
}
