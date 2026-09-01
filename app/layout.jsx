import '@fontsource-variable/schibsted-grotesk';
import './globals.css';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { business } from '../lib/config';

export const metadata = {
  metadataBase: new URL('https://backup.mazidigroup.com'),
  title: {
    default: `${business.companyName} — Business backup and recovery`,
    template: `%s — ${business.companyName}`
  },
  description:
    'We install a backup box in your office, keep a copy of every computer on it, and test ' +
    'with you that files actually come back. West London, within 30 miles.',
  icons: { icon: '/icon.svg' }
};

export const viewport = { themeColor: '#16233a' };

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
