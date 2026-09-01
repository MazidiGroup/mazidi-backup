import Link from 'next/link';

export const metadata = { title: 'How it works' };

const steps = [
  ['Backup check, 15 minutes, free', 'We go through how many computers you have, where files live, what backs up today and whether a restore has ever been tested.'],
  ['Recommendation', 'A short written summary of what we would protect, how much storage that needs, and whether an offsite copy is worth it for you.'],
  ['Fixed quotation', 'One price, with the assumptions and exclusions written down. Nothing is ordered until you approve it.'],
  ['Installation', 'We configure the appliance, set up each computer, and check the first backups complete.'],
  ['Restore test', 'Before we leave, we restore a file in front of you so you have seen it work.'],
  ['Optional monitoring', 'We keep an eye on whether backups are completing and contact you if they stop.']
];

export default function HowItWorks() {
  return (
    <>
      <div className="hero compact">
        <div className="wrap">
          <h1>How it works</h1>
          <p className="lede">Six steps from first conversation to a system you have seen restore.</p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <ol className="steps">
            {steps.map(([title, body]) => (
              <li key={title}>
                <strong>{title}</strong>
                <p>{body}</p>
              </li>
            ))}
          </ol>
          <div className="btn-row mt-2">
            <Link className="btn" href="/contact">Start with the backup check</Link>
          </div>
        </div>
      </section>
    </>
  );
}
