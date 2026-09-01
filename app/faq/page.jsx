import Link from 'next/link';

export const metadata = { title: 'Frequently asked questions' };

const faqs = [
  ['What happens if a hard drive fails?',
   'With a working backup, the files exist in a second place and can be put back onto a replacement drive or a different machine. Without one, recovery means a specialist data-recovery lab, at significant cost and with no guarantee of success.'],
  ['Is RAID the same as a backup?',
   'No. RAID keeps a server or appliance running when a single disk fails. It does not help if a file is deleted, a file is encrypted by ransomware, the device is stolen, or the office floods — because every change is written to all the disks immediately. RAID is about uptime; backup is about going back in time.'],
  ['Can we restore individual files?',
   'Yes, and that is the most common request by far. Individual files and folders can be recovered without rebuilding the whole computer.'],
  ['Can you back up several PCs?',
   'Yes. A typical installation covers between three and ten office computers, and more can be added later.'],
  ['What if our office is damaged or equipment is stolen?',
   'This is what the offsite copy is for. A backup that sits next to the computers it protects shares their fate, so we recommend a second copy held elsewhere.'],
  ['Can backups be stored offsite?',
   'Yes, as an option. We size it to your data volume and explain the ongoing cost before you commit to it.'],
  ['How do we know backups are working?',
   'Two things: the system reports whether jobs completed, and we test a restore. Reporting alone is not proof — a job can complete and still produce something you cannot recover from.'],
  ['Can you monitor the system for us?',
   'Yes. The monitoring service checks that backups are completing, follows up when they are not, and runs periodic restore tests.'],
  ['How much storage does a small office need?',
   'It depends on how much data you hold and how far back you want to be able to go. We work this out during the backup check rather than guessing.'],
  ['Is OneDrive or Google Drive already a backup?',
   'Not on its own. File sync services copy changes — including deletions and encryption — to every device. Many offer some version history, which helps, but the retention and recovery options are usually more limited than people assume. Worth checking rather than assuming.']
];

export default function FAQ() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <h1>Frequently asked questions</h1>
        </div>
      </div>
      <section className="wrap">
        {faqs.map(([q, a]) => (
          <div key={q}>
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}
        <p style={{ marginTop: '2.5rem' }}>
          <Link className="btn" href="/contact">Ask us something else</Link>
        </p>
      </section>
    </>
  );
}
