import LeadForm from '../../components/LeadForm';
import { business } from '../../lib/config';

export const metadata = { title: 'Book a free backup check' };

export default function Contact() {
  return (
    <>
      <div className="hero compact">
        <div className="wrap">
          <h1>Book a free backup check</h1>
          <p className="lede">
            Fifteen minutes, by phone or at your office. We go through what you have now and tell
            you plainly what is and is not covered.
          </p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="contact-grid">
            <div>
              <LeadForm source="contact" />
            </div>
            <aside className="aside">
              <h3>Prefer to call?</h3>
              <p>
                <a href={`tel:${business.phone.replace(/\s/g, '')}`}>{business.phone}</a><br />
                <a href={`mailto:${business.email}`}>{business.email}</a><br />
                <span className="small">{business.hours}</span>
              </p>
              <h3>What happens next</h3>
              <p className="small">
                We reply within one working day to arrange a time. The check is free, there is no
                obligation, and if what you have is sound we will say so.
              </p>
              <h3>Service area</h3>
              <p className="small">{business.serviceArea}.</p>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
