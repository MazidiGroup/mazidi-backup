import Link from 'next/link';
import { pricing } from '../../lib/config';

export const metadata = { title: 'Pricing' };
const gbp = n => `${pricing.currency}${n.toLocaleString('en-GB')}`;

export default function Pricing() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <h1>Pricing</h1>
          <p className="lede">
            Indicative figures so you can judge whether this is worth a conversation.
            Every installation is quoted individually.
          </p>
        </div>
      </div>

      <section className="wrap">
        <h2>Business Backup Box installation</h2>
        <p style={{ fontSize: '1.6rem', color: 'var(--ink)', fontWeight: 700, margin: '0 0 6px' }}>
          from {gbp(pricing.installFrom)}
        </p>
        <p className="hint" style={{ marginBottom: '1.6rem' }}>
          One-off. Hardware, configuration and installation included.
        </p>

        <table>
          <thead><tr><th>Included</th><th>Detail</th></tr></thead>
          <tbody>
            <tr><td>Backup appliance</td><td>Supplied, configured and installed on your network</td></tr>
            <tr><td>Storage</td><td>Sized to your data volume, confirmed before ordering</td></tr>
            <tr><td>Workstation setup</td><td>Each computer configured to back up automatically</td></tr>
            <tr><td>Version history</td><td>Point-in-time recovery, retention agreed with you</td></tr>
            <tr><td>Recovery configuration</td><td>File-level and full-machine recovery prepared</td></tr>
            <tr><td>Initial restore test</td><td>Carried out with you present at handover</td></tr>
            <tr><td>Documentation</td><td>Written record of what is protected and how to recover it</td></tr>
          </tbody>
        </table>

        <h2>Optional extras</h2>
        <table>
          <thead><tr><th>Option</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Offsite backup copy</td><td>Second copy held away from the premises. Priced on data volume.</td></tr>
            <tr><td>Additional storage</td><td>If your data volume is larger than a standard configuration</td></tr>
            <tr><td>Additional computers</td><td>Beyond the number in the original quotation</td></tr>
            <tr><td>Uninterruptible power supply</td><td>Protects the appliance from abrupt power loss</td></tr>
          </tbody>
        </table>

        <h2>Backup monitoring</h2>
        <p style={{ fontSize: '1.35rem', color: 'var(--ink)', fontWeight: 700, margin: '0 0 6px' }}>
          from {gbp(pricing.monitoring)} per month
        </p>
        <p>
          We check that backups are completing, follow up when they are not, and run periodic
          restore tests. Optional, and it can be added later.
        </p>

        <div className="note">
          <strong>Why &quot;from&quot;.</strong> A three-computer office and a twelve-computer office
          do not need the same storage or the same amount of work, so a single flat price would be
          misleading. The backup check tells us which you are, and the written quotation that
          follows is fixed.
        </div>

        <p><Link className="btn" href="/contact">Get a quotation for your office</Link></p>
      </section>
    </>
  );
}
