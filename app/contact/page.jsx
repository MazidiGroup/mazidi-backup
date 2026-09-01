import LeadForm from '../../components/LeadForm';
import { business } from '../../lib/config';

export const metadata = { title: 'Contact' };

export default function Contact() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <h1>Book a free backup check</h1>
          <p className="lede">
            Fifteen minutes, by phone or at your office. We go through what you have now and tell
            you plainly what is and is not covered.
          </p>
        </div>
      </div>

      <section className="wrap">
        <div className="grid" style={{ gridTemplateColumns: 'minmax(300px,1.4fr) minmax(240px,1fr)' }}>
          <div>
            <LeadForm source="contact" />
          </div>
          <div className="card" style={{ alignSelf: 'start' }}>
            <h3>Prefer to call?</h3>
            <p>
              <a href={`tel:${business.phone.replace(/\s/g, '')}`}>{business.phone}</a><br />
              <a href={`mailto:${business.email}`}>{business.email}</a>
            </p>
            <p className="hint">{business.hours}</p>
            <h3>Service area</h3>
            <p className="hint">{business.serviceArea}</p>
          </div>
        </div>
      </section>
    </>
  );
}
