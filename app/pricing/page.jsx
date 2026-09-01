import Link from 'next/link';
import { pricing } from '../../lib/config';

export const metadata = { title: 'Pricing' };
const gbp = n => `${pricing.currency}${n.toLocaleString('en-GB')}`;

export default function Pricing() {
  return (
    <>
      <div className="hero compact">
        <div className="wrap">
          <h1>Pricing</h1>
          <p className="lede">
            Indicative figures so you can judge whether this is worth a conversation.
            Every installation is quoted individually and confirmed in writing.
          </p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="prices">
            <div className="price accent">
              <h3>Business Backup Box, installed</h3>
              <div className="figure">from {gbp(pricing.installFrom)}<span>one-off</span></div>
              <p>Hardware, configuration and installation included.</p>
            </div>
            <div className="price">
              <h3>Backup monitoring</h3>
              <div className="figure">from {gbp(pricing.monitoring)}<span>per month</span></div>
              <p>We check that backups are completing, follow up when they are not, and run
                periodic restore tests. Optional, and it can be added later.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="prose">
            <h2>What the installation includes</h2>
            <table>
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
              <tbody>
                <tr><td>Offsite backup copy</td><td>Second copy held away from the premises. Priced on data volume.</td></tr>
                <tr><td>Additional storage</td><td>If your data volume is larger than a standard configuration</td></tr>
                <tr><td>Additional computers</td><td>Beyond the number in the original quotation</td></tr>
                <tr><td>Uninterruptible power supply</td><td>Protects the appliance from abrupt power loss</td></tr>
              </tbody>
            </table>

            <div className="note">
              <strong>Why &quot;from&quot;.</strong> A three-computer office and a twelve-computer office
              do not need the same storage or the same amount of work, so a single flat price would be
              misleading. The backup check tells us which you are, and the written quotation that
              follows is fixed.
            </div>

            <div className="btn-row mt-2">
              <Link className="btn" href="/contact">Get a quotation for your office</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
