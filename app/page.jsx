import Link from 'next/link';
import { business, pricing } from '../lib/config';

export default function Home() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <h1>Could your business restore its computers tomorrow?</h1>
          <p className="lede">
            We help small businesses set up practical local and offsite backup systems,
            monitor them, and test that files can actually be recovered.
          </p>
          <p style={{ marginTop: '28px' }}>
            <Link className="btn" href="/contact">Book a free 15-minute backup check</Link>
            <Link className="btn ghost" href="/business-backup">How it protects you</Link>
          </p>
        </div>
      </div>

      <section className="wrap">
        <h2>The situations we plan for</h2>
        <div className="grid">
          <div className="card">
            <h3>A computer fails</h3>
            <p>A drive dies on a Tuesday morning. The question is not whether it happens, but how
              long the machine and its files take to come back.</p>
          </div>
          <div className="card">
            <h3>Files are deleted</h3>
            <p>Someone overwrites a spreadsheet or empties a folder. Version history lets you go
              back to how it looked yesterday, or last month.</p>
          </div>
          <div className="card">
            <h3>Equipment is stolen or damaged</h3>
            <p>If the office is affected, an offsite copy is what stands between you and starting
              again from nothing.</p>
          </div>
          <div className="card">
            <h3>Systems are encrypted</h3>
            <p>Ransomware is a recovery problem as much as a security one. Separated, versioned
              backups give you a route back that does not involve paying anyone.</p>
          </div>
        </div>
      </section>

      <section className="wrap">
        <h2>What the backup check involves</h2>
        <p className="lede">
          Fifteen minutes, by phone or in person. We go through what you have now, what would
          actually happen if a machine failed, and whether a restore has ever been tested.
          You get a straight answer about what is and is not covered.
        </p>
        <div className="note">
          <strong>No obligation and no charge.</strong> If your current arrangement is sound,
          we will tell you so.
        </div>
        <p>
          <Link className="btn" href="/contact">Arrange a backup check</Link>
        </p>
      </section>

      <section className="wrap">
        <h2>Straightforward pricing</h2>
        <p>
          A typical Business Backup Box installation starts from{' '}
          <strong>{pricing.currency}{pricing.installFrom.toLocaleString('en-GB')}</strong>, with
          optional monitoring from {pricing.currency}{pricing.monitoring} per month. The final
          figure depends on how many computers you have and how much data needs protecting, so we
          confirm it in writing before anything is ordered.
        </p>
        <p><Link href="/pricing">See what is included →</Link></p>
      </section>

      <section className="wrap">
        <h2>Local and accountable</h2>
        <p>
          We install and support systems across {business.serviceArea}. One person configures it,
          installs it, tests the restore with you and answers the phone afterwards.
        </p>
      </section>
    </>
  );
}
