import Link from 'next/link';
import { product } from '../../lib/config';

export const metadata = { title: 'What the Business Backup Box does' };

const I = {
  pc: <path d="M4 6h16v10H4zM9 20h6M12 16v4" />,
  file: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h5M10 17h5" />,
  machine: <path d="M4 5h16v14H4zM4 11h16M8 8h.01M8 15h.01" />,
  clock: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" />,
  offsite: <path d="M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 9a4 4 0 0 1 0 9z" />,
  monitor: <path d="M3 13l4-4 4 4 4-6 6 6M3 20h18" />,
  restore: <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5M10 13l2 2 4-5" />
};

const Icon = ({ d }) => (
  <span className="icon" aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
  </span>
);

const features = [
  ['pc', 'Workstation backups', 'Each office computer backs up automatically to an appliance on your network. No one has to remember to run anything, and nothing depends on somebody plugging in a drive.'],
  ['file', 'File recovery', 'Individual files and folders can be restored without rebuilding a machine. This is the common case, and the one people need most often.'],
  ['machine', 'Full computer recovery', 'If a computer is lost entirely, the aim is to bring the machine back rather than just the documents: operating system, applications and settings.'],
  ['clock', 'Version history', 'Backups are kept as point-in-time versions, so a file that was corrupted or overwritten can be recovered from before the change, not just as it stands now.'],
  ['offsite', 'Optional offsite copy', 'A second copy held away from the premises, so a fire, flood or theft does not take the backups along with the originals.'],
  ['monitor', 'Monitoring', 'Backups that silently stop are worse than no backups, because you think you are covered. We check that jobs are completing and follow up when they are not.'],
  ['restore', 'Restore testing', 'We run a restore with you at installation, and again periodically if you take the monitoring service. An untested backup is an assumption.']
];

export default function BusinessBackup() {
  return (
    <>
      <div className="hero compact">
        <div className="wrap">
          <h1>What the Business Backup Box does</h1>
          <p className="lede">{product.promise}</p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="features">
            {features.map(([icon, title, body]) => (
              <div key={title}>
                <Icon d={I[icon]} />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="note measure">
            <strong>What we will not claim.</strong> No backup system prevents ransomware, hardware
            failure or human error, and nobody can promise data loss is impossible. What a good system
            does is give you a practical, tested route back, and tell you honestly how much you would
            lose and how long it would take.
          </div>
          <div className="btn-row mt-2">
            <Link className="btn" href="/contact">Book a free backup check</Link>
            <Link className="btn secondary" href="/pricing">See pricing</Link>
          </div>
        </div>
      </section>
    </>
  );
}
