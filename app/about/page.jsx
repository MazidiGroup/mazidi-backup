import Link from 'next/link';
import { business } from '../../lib/config';

export const metadata = { title: 'About' };

export default function About() {
  return (
    <>
      <div className="hero compact">
        <div className="wrap">
          <h1>About {business.companyName}</h1>
          <p className="lede">
            A local business that installs and supports backup and recovery systems for small
            offices across {business.serviceArea}.
          </p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="prose">
            <h2>What we do</h2>
            <p>
              We work with businesses that have somewhere between three and fifteen people, important
              files on office computers, and no IT department. That combination usually means backups
              are somebody&apos;s secondary responsibility, and often nobody has checked in a while
              whether they still work.
            </p>

            <h2>How we work</h2>
            <p>
              One person carries out the backup check, specifies the system, installs it, tests the
              restore with you and answers the phone afterwards. You are not routed through a helpdesk
              and you are not sold a system before anyone has looked at your setup.
            </p>

            <h2>What we are not</h2>
            <p>
              We are not a general IT support company, and we do not sell storage hardware on its own.
              The product is a working, monitored, tested recovery route. The box is just how it is
              delivered.
            </p>

            {/* NOTE FOR OWNER: do not add years in business, customer counts, certifications,
                partnerships or testimonials to this page until they are genuinely true and
                evidenced. Case studies belong here once real installations exist. */}

            <div className="btn-row mt-3">
              <Link className="btn" href="/contact">Get in touch</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
