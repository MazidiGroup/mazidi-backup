import Link from 'next/link';

export const metadata = { title: 'How it works' };

export default function HowItWorks() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <h1>How it works</h1>
          <p className="lede">Six steps from first conversation to a system you have seen restore.</p>
        </div>
      </div>

      <section className="wrap">
        <ol className="steps">
          <li>
            <strong>Backup check — 15 minutes, free</strong>
            We go through how many computers you have, where files live, what backs up today and
            whether a restore has ever been tested.
          </li>
          <li>
            <strong>Recommendation</strong>
            A short written summary of what we would protect, how much storage that needs, and
            whether an offsite copy is worth it for you.
          </li>
          <li>
            <strong>Fixed quotation</strong>
            One price, with the assumptions and exclusions written down. Nothing is ordered until
            you approve it.
          </li>
          <li>
            <strong>Installation</strong>
            We configure the appliance, set up each computer, and check the first backups complete.
          </li>
          <li>
            <strong>Restore test</strong>
            Before we leave, we restore a file in front of you so you have seen it work.
          </li>
          <li>
            <strong>Optional monitoring</strong>
            We keep an eye on whether backups are completing and contact you if they stop.
          </li>
        </ol>
        <p style={{ marginTop: '30px' }}>
          <Link className="btn" href="/contact">Start with the backup check</Link>
        </p>
      </section>
    </>
  );
}
