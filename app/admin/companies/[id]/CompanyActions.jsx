'use client';
import { useActionState, useState } from 'react';
import { setWebsite, setStatus, addNote, addContact } from '../../actions';

function Msg({ state }) {
  if (!state) return null;
  if (state.error) return <p className="err mt-1">{state.error}</p>;
  if (state.ok) return <p className="ok mt-1">{state.ok}</p>;
  return null;
}

export default function CompanyActions({ company }) {
  const [w, wAct, wPend] = useActionState(setWebsite, null);
  const [url, setUrl] = useState('');
  const [s, sAct, sPend] = useActionState(setStatus, null);
  const [n, nAct, nPend] = useActionState(addNote, null);
  const [c, cAct, cPend] = useActionState(addContact, null);
  return (
    <div className="cards">
      <div className="card">
        <h3>{company.website ? 'Replace website' : 'Record their website'}</h3>
        <form action={wAct}>
          <input type="hidden" name="company_id" value={company.company_id} />
          <div className="field">
            <label htmlFor="url">Web address</label>
            <input id="url" name="url" placeholder="www.example.co.uk" required value={url} onChange={e => setUrl(e.target.value)} />
            <p className="hint">Recorded automatically if the page shows their name or registered postcode.</p>
          </div>
          <div className="field">
            <label style={{ fontWeight: 500, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" name="attest" style={{ width: 'auto', marginTop: 4 }} />
              <span>I've opened this site myself and it is this company's. Record it on my say-so if the automatic check can't.</span>
            </label>
            <p className="hint">Only used when the check fails. Logged under your name; the site won't be read for personalisation.</p>
          </div>
          <button className="btn" type="submit" disabled={wPend}>{wPend ? 'Checking…' : 'Check and record'}</button>
          <Msg state={w} />
        </form>
      </div>

      <div className="card">
        <h3>Your decision</h3>
        <form action={sAct}>
          <input type="hidden" name="company_id" value={company.company_id} />
          <div className="field">
            <label htmlFor="status">Set status</label>
            <select id="status" name="status" defaultValue="">
              <option value="" disabled>Choose…</option>
              <option value="QUALIFIED" disabled={!company.website}>Qualified — worth contacting{!company.website ? ' (needs a website first)' : ''}</option>
              <option value="RESEARCHED">Park it — leave for later</option>
              <option value="LOST">Not a prospect</option>
              <option value="DO_NOT_CONTACT">Do not contact — ever (suppresses their domain)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="reason">Reason (kept on record)</label>
            <input id="reason" name="reason" maxLength={500} />
          </div>
          <button className="btn secondary" type="submit" disabled={sPend}>{sPend ? 'Saving…' : 'Save decision'}</button>
          <Msg state={s} />
        </form>
      </div>

      <div className="card">
        <h3>Add a contact by hand</h3>
        <form action={cAct}>
          <input type="hidden" name="company_id" value={company.company_id} />
          <div className="two">
            <div className="field"><label htmlFor="first_name">First name</label><input id="first_name" name="first_name" /></div>
            <div className="field"><label htmlFor="surname">Surname</label><input id="surname" name="surname" /></div>
          </div>
          <div className="field"><label htmlFor="job_title">Role</label><input id="job_title" name="job_title" placeholder="Director" /></div>
          <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required /></div>
          <div className="field">
            <label htmlFor="source_url">Where you found it</label>
            <input id="source_url" name="source_url" type="url" required placeholder="https://" />
            <p className="hint">Required. The page that shows this address — their contact page, a directory listing, a letterhead you were sent.</p>
          </div>
          <button className="btn secondary" type="submit" disabled={cPend}>{cPend ? 'Saving…' : 'Record contact'}</button>
          <Msg state={c} />
        </form>
      </div>

      <div className="card">
        <h3>Add a note</h3>
        <form action={nAct}>
          <input type="hidden" name="company_id" value={company.company_id} />
          <div className="field">
            <textarea name="note" rows={4} maxLength={2000} required />
          </div>
          <button className="btn secondary" type="submit" disabled={nPend}>{nPend ? 'Saving…' : 'Save note'}</button>
          <Msg state={n} />
        </form>
      </div>
    </div>
  );
}
