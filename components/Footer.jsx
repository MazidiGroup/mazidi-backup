import Link from 'next/link';
import Logo from './Logo';
import { business } from '../lib/config';

export default function Footer() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="cols">
          <div>
            <div className="brand"><Logo ink="#ffffff" accent="#5fbf95" /></div>
            <p>
              Backup and recovery systems for small offices, installed and supported by one
              accountable person. Serving {business.serviceArea}.
            </p>
          </div>
          <div>
            <h4>Get in touch</h4>
            <ul>
              <li><a href={`tel:${business.phone.replace(/\s/g, '')}`}>{business.phone}</a></li>
              <li><a href={`mailto:${business.email}`}>{business.email}</a></li>
              <li>{business.hours}</li>
            </ul>
          </div>
          <div>
            <h4>Pages</h4>
            <ul>
              <li><Link href="/business-backup">What it does</Link></li>
              <li><Link href="/how-it-works">How it works</Link></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
              <li><Link href="/contact">Book a backup check</Link></li>
              <li><Link href="/privacy">Privacy notice</Link></li>
            </ul>
          </div>
        </div>
        <div className="legal">
          <span>
            {business.legalName}, trading as {business.companyName}. Registered in England &amp; Wales,
            company no. {business.companyNumber}. {business.registeredAddress}.
          </span>
          <span>ICO registration {business.icoRegistration}</span>
        </div>
      </div>
    </footer>
  );
}
