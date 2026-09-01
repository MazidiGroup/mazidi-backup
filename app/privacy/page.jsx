import { business } from '../../lib/config';

export const metadata = { title: 'Privacy notice' };

export default function Privacy() {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <h1>Privacy notice</h1>
          <p className="lede">How {business.companyName} handles personal information.</p>
        </div>
      </div>

      <section className="wrap">
        <div className="note">
          <strong>Owner action required.</strong> This is a working draft covering the processing
          this system actually performs. It has not been reviewed by a solicitor. Have it checked
          before the site goes live, and register with the ICO if required.
        </div>

        <h2>Who we are</h2>
        <p>
          {business.legalName} (company number {business.companyNumber}), {business.registeredAddress},
          is the data controller. Contact: <a href={`mailto:${business.email}`}>{business.email}</a>.
          ICO registration: {business.icoRegistration}.
        </p>

        <h2>Information we collect</h2>
        <h3>If you contact us</h3>
        <p>
          The name, company, email address, telephone number and enquiry details you provide,
          together with the number of computers if you tell us. We use this to answer your enquiry
          and, if you go ahead, to provide the service.
        </p>
        <h3>If we contact you</h3>
        <p>
          We identify businesses that may need backup and recovery services using publicly available
          information: the Companies House register, company websites, and published business
          directories. Where this includes the name, job title and work email address of a person at
          that business, that is personal data and we record where and when we obtained it.
        </p>

        <h2>Lawful basis</h2>
        <p>
          For enquiries you send us: taking steps at your request prior to entering a contract, and
          our legitimate interest in responding to you.
        </p>
        <p>
          For business-development email to a named person at a company: our legitimate interests in
          promoting a relevant service to businesses likely to need it. We have carried out a
          legitimate interests assessment and balanced our interest against your rights. Marketing
          by electronic mail to corporate subscribers is permitted under the Privacy and Electronic
          Communications Regulations without prior consent, provided you can opt out at any time.
        </p>

        <h2>Your rights</h2>
        <p>
          You can object to direct marketing at any time and we will stop immediately — this right
          is absolute. You may also request access to the information we hold about you, ask us to
          correct or erase it, or restrict how we use it. Email{' '}
          <a href={`mailto:${business.email}`}>{business.email}</a>.
        </p>
        <p>
          If you ask us to stop contacting you, we keep your email address on a suppression list.
          This is so we do not contact you again by accident — it is the only way to honour your
          objection reliably, and we hold it for no other purpose.
        </p>

        <h2>Retention</h2>
        <p>
          Prospect records that produce no response are deleted after 24 months. Customer records
          are kept for 7 years to meet accounting obligations. Suppression records are kept
          indefinitely so that objections continue to be honoured.
        </p>

        <h2>Sharing and storage</h2>
        <p>
          Data is held in our own database hosted in the United Kingdom (London region), and in our
          email provider&apos;s systems for the purpose of sending and receiving mail. We do not
          sell or share personal data for marketing purposes.
        </p>

        <h2>Cookies</h2>
        <p>
          This site sets no advertising or tracking cookies. Nothing is placed on your device that
          requires consent.
        </p>

        <h2>Complaints</h2>
        <p>
          If you are unhappy with how we have handled your information you can complain to the
          Information Commissioner&apos;s Office at ico.org.uk, though we would like the chance to
          put it right first.
        </p>
      </section>
    </>
  );
}
