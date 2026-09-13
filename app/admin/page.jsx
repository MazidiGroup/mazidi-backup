import { redirect } from 'next/navigation';
import { isSignedIn } from '../../lib/adminAuth';
export default async function Admin() {
  if (!(await isSignedIn())) redirect('/admin/login');
  redirect('/admin/apps');
}
