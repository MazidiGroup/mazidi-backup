'use client';
import { useActionState } from 'react';
import { setWebsite, setStatus, addNote } from '../../actions';

function Msg({ state }) {
  if (!state) return null;
  if (state.error) return <p className="err mt-1">{state.error}</p>;
  if (state.ok) return <p className="ok mt-1">{state.ok}</p>;
  return null;
}

export default function CompanyActions({ company }) {
  const [w, wAct, wPend] = useActionState(setWebsite, null);
  const [s, sAct, sPend] = useActionState(setStatus, null);
  const [n, nAct, nPend] = useActionState(addNote, null);
  return (
    <div className="cards">
      <div className="card">
        <h3>{company.website ? 'Replace website' : 'Record their website'}</h3>
        <form action={wAct}>
          <input type="hidden" name="company_id" value={company.company_id} />
          <div className="field">
            <label htmlFor="url">Web address</label>
            <input id="url" name="url" placeholder="www.example.co.uk" required />
            <p className="hint">Only recorded if the page shows their name or registered postcode.</p>
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
