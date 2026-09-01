import Link from 'next/link';
import HeroDiagram from '../components/HeroDiagram';
import { business, pricing } from '../lib/config';

const gbp = n => `${pricing.currency}${n.toLocaleString('en-GB')}`;

export default function Home() {
  return (
    <>
      <div className="hero">
        <div className="wrap grid">
          <div>
            <h1>Could your business restore its computers tomorrow?</h1>
            <p className="lede">
              We install a backup box in your office, keep a copy of every computer on it, and
              test with you that files actually come back.
            </p>
            <div className="btn-row">
              <Link className="btn" href="/contact">Book a free 15-minute backup check</Link>
              <Link className="btn secondary" href="/business-backup">See what it does</Link>
            </div>
            <p className="locale">
              <strong>For offices of 3 to 15 people</strong> with no IT department, across West
              London and within 30 miles.
            </p>
          </div>
          <div>
            <HeroDiagram />
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="section-head">
            <h2>What actually goes wrong</h2>
            <p>Most offices are one of these away from losing work. A tested backup turns each into an inconvenience.</p>
          </div>
          <div className="situations">
            <div>
              <h3>A computer fails</h3>
              <p>A drive dies on a Tuesday morning. The question is not whether it happens, but how
                long the machine and its files take to come back.</p>
            </div>
            <div>
              <h3>Files are deleted</h3>
              <p>Someone overwrites a spreadsheet or empties a folder. Version history lets you go
                back to how it looked yesterday, or last month.</p>
            </div>
            <div>
              <h3>Equipment is stolen or damaged</h3>
              <p>If the office is affected, an offsite copy is what stands between you and starting
                again from nothing.</p>
            </div>
            <div>
              <h3>Systems are encrypted</h3>
              <p>Ransomware is a recovery problem as much as a security one. Separated, versioned
                backups give you a route back that does not involve paying anyone.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="panel">
            <div>
              <h2>Start with a free backup check</h2>
              <p>
                Fifteen minutes, by phone or in person. We go through what you have now, what
                would actually happen if a machine failed, and whether a restore has ever been
                tested. You get a straight answer about what is and is not covered.
              </p>
              <div className="btn-row mt-2">
                <Link className="btn" href="/contact">Arrange a backup check</Link>
              </div>
            </div>
            <div className="promise">
              <strong>No obligation and no charge.</strong>
              If your current arrangement is sound, we will tell you so and leave it there.
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <h2>Straightforward pricing</h2>
          </div>
          <div className="prices">
            <div className="price accent">
              <h3>Business Backup Box, installed</h3>
              <div className="figure">from {gbp(pricing.installFrom)}<span>one-off</span></div>
              <p>Appliance, storage, every computer set up, version history, and a restore test
                before we leave.</p>
            </div>
            <div className="price">
              <h3>Backup monitoring</h3>
              <div className="figure">from {gbp(pricing.monitoring)}<span>per month</span></div>
              <p>We check backups are completing, follow up when they are not, and re-test
                restores periodically. Optional, and can be added later.</p>
            </div>
          </div>
          <p className="caveat">
            The final figure depends on how many computers you have and how much data needs
            protecting, so we confirm it in writing before anything is ordered.{' '}
            <Link href="/pricing">See what is included</Link>
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="local">
            <div>
              <h2>Local and accountable</h2>
              <p className="mt-1">
                We install and support systems across {business.serviceArea}. One person
                configures it, installs it, tests the restore with you and answers the phone
                afterwards. No helpdesk, no ticket numbers.
              </p>
            </div>
            <div>
              <ul className="contact-lines">
                <li><span>Call</span><a href={`tel:${business.phone.replace(/\s/g, '')}`}>{business.phone}</a></li>
                <li><span>Email</span><a href={`mailto:${business.email}`}>{business.email}</a></li>
                <li><span>Hours</span><span className="small" style={{ minWidth: 0 }}>{business.hours}</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
