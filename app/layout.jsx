import './globals.css';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { business } from '../lib/config';

export const metadata = {
  title: {
    default: `${business.companyName} — Business backup and recovery`,
    template: `%s — ${business.companyName}`
  },
  description:
    'We help small businesses set up local and offsite backups for their office computers, ' +
    'monitor them, and test that files can actually be recovered.'
};

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
