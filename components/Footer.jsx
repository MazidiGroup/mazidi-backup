import Link from 'next/link';
import { business } from '../lib/config';

export default function Footer() {
  return (
    <footer className="site">
      <div className="wrap cols">
        <div>
          <strong>{business.companyName}</strong><br />
          {business.legalName}, registered in England &amp; Wales no. {business.companyNumber}<br />
          {business.registeredAddress}
        </div>
        <div>
          <a href={`mailto:${business.email}`}>{business.email}</a><br />
          <a href={`tel:${business.phone.replace(/\s/g, '')}`}>{business.phone}</a><br />
          {business.hours}
        </div>
        <div>
          <Link href="/privacy">Privacy Notice</Link><br />
          <Link href="/contact">Contact</Link><br />
          Serving {business.serviceArea}
        </div>
      </div>
    </footer>
  );
}
