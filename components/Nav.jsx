'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';

const links = [
  ['/business-backup', 'What it does'],
  ['/how-it-works', 'How it works'],
  ['/pricing', 'Pricing'],
  ['/faq', 'FAQ'],
  ['/about', 'About']
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="site">
      <div className="wrap bar">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <Logo />
        </Link>
        <button
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen(o => !o)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <nav id="primary-nav" className={`primary${open ? ' open' : ''}`} aria-label="Primary">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <Link className="btn" href="/contact" onClick={() => setOpen(false)}>
            Book a free backup check
          </Link>
        </nav>
      </div>
    </header>
  );
}
