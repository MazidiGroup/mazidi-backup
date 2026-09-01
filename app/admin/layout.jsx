import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSignedIn } from '../../lib/adminAuth';
import { logout } from './login/actions';
import './admin.css';

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const signedIn = await isSignedIn();
  if (!signedIn) {
    // Only the login page is reachable without a session.
    return <div className="admin"><div className="wrap">{children}</div></div>;
  }
  return (
    <div className="admin">
      <div className="wrap">
        <nav className="admin-nav">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/companies?view=review">Needs review</Link>
          <Link href="/admin/companies?view=qualified">Qualified</Link>
          <Link href="/admin/companies">All companies</Link>
          <form action={logout}><button className="linklike" type="submit">Sign out</button></form>
        </nav>
        {children}
      </div>
    </div>
  );
}
