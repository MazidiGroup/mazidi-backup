'use client';
import { useState } from 'react';

export default function LeadForm({ source = 'contact' }) {
  const [state, setState] = useState({ status: 'idle', message: '' });

  async function onSubmit(e) {
    e.preventDefault();
    setState({ status: 'sending', message: '' });
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, page_source: source })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Something went wrong.');
      setState({ status: 'sent', message: 'Thank you. We will reply within one working day.' });
      e.target.reset();
    } catch (err) {
      setState({ status: 'error', message: err.message });
    }
  }

  if (state.status === 'sent') {
    return <p className="ok">{state.message}</p>;
  }

  return (
    <form className="lead" onSubmit={onSubmit}>
      {/* honeypot - bots fill this, humans never see it */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="website_url">Leave this blank</label>
        <input id="website_url" name="website_url" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="two">
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" required maxLength={120} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="company_name">Company</label>
          <input id="company_name" name="company_name" maxLength={160} autoComplete="organization" />
        </div>
      </div>

      <div className="two">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone <span className="small" style={{ fontWeight: 400 }}>(optional)</span></label>
          <input id="phone" name="phone" type="tel" maxLength={40} autoComplete="tel" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="pc_count">Roughly how many computers?</label>
        <input id="pc_count" name="pc_count" type="number" min="1" max="500" inputMode="numeric" style={{ maxWidth: 160 }} />
      </div>

      <div className="field">
        <label htmlFor="message">What would you like to ask?</label>
        <textarea id="message" name="message" rows={5} maxLength={4000} />
      </div>

      <p className="hint">
        We use these details only to answer your enquiry. See our{' '}
        <a href="/privacy">privacy notice</a>.
      </p>

      <div className="btn-row mt-2">
        <button className="btn" type="submit" disabled={state.status === 'sending'}>
          {state.status === 'sending' ? 'Sending…' : 'Send enquiry'}
        </button>
      </div>

      {state.status === 'error' && <p className="err mt-1">{state.message}</p>}
    </form>
  );
}
