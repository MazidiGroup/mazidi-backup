import Link from 'next/link';
import { product } from '../../lib/config';

export const metadata = { title: 'Business backup and recovery' };

export default function BusinessBackup() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <h1>Business backup and recovery</h1>
          <p className="lede">{product.promise}</p>
        </div>
      </div>

      <section className="wrap">
        <h2>What the system does</h2>

        <h3>Workstation backups</h3>
        <p>Each office computer backs up automatically to an appliance on your network. No one has
          to remember to run anything, and nothing depends on somebody plugging in a drive.</p>

        <h3>File recovery</h3>
        <p>Individual files and folders can be restored without rebuilding a machine — the common
          case, and the one people need most often.</p>

        <h3>Full computer recovery</h3>
        <p>If a computer is lost entirely, the aim is to bring the machine back rather than just
          the documents: operating system, applications and settings.</p>

        <h3>Version history</h3>
        <p>Backups are kept as point-in-time versions, so a file that was corrupted or overwritten
          can be recovered from before the change, not just as it stands now.</p>

        <h3>Optional offsite copy</h3>
        <p>A second copy held away from the premises, so a fire, flood or theft does not take the
          backups along with the originals.</p>

        <h3>Monitoring</h3>
        <p>Backups that silently stop are worse than no backups, because you think you are covered.
          We check that jobs are completing and follow up when they are not.</p>

        <h3>Restore testing</h3>
        <p>We run a restore with you at installation, and again periodically if you take the
          monitoring service. An untested backup is an assumption.</p>
      </section>

      <section className="wrap">
        <div className="note">
          <strong>What we will not claim.</strong> No backup system prevents ransomware, hardware
          failure or human error, and nobody can promise data loss is impossible. What a good system
          does is give you a practical, tested route back — and tell you honestly how much you would
          lose and how long it would take.
        </div>
        <p><Link className="btn" href="/contact">Book a free backup check</Link></p>
      </section>
    </>
  );
}
