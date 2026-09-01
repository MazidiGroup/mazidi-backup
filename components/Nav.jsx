import Link from 'next/link';
import { business } from '../lib/config';

export default function Nav() {
  return (
    <header className="site">
      <div className="wrap">
        <Link href="/" className="brand">{business.companyName}</Link>
        <nav>
          <Link href="/business-backup">Business Backup</Link>
          <Link href="/how-it-works">How It Works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
    </header>
  );
}
