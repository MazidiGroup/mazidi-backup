'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, secretMatches, tokenFor, configured } from '../../../lib/adminAuth';

// Tiny in-memory limiter so the login form cannot be brute-forced cheaply.
const attempts = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  list.push(now);
  attempts.set(ip, list);
  return list.length > 8;
}

export async function login(prevState, formData) {
  if (!configured()) return { error: 'ADMIN_SECRET is not set on this deployment.' };
  const ip = 'shared'; // Vercel does not expose the client IP to server actions reliably; one bucket is still a ceiling.
  if (limited(ip)) return { error: 'Too many attempts. Wait 15 minutes.' };

  const supplied = formData.get('secret');
  if (!secretMatches(supplied)) return { error: 'That secret did not match.' };

  const jar = await cookies();
  jar.set(COOKIE, tokenFor(), {
    httpOnly: true, secure: process.env.VERCEL === '1', sameSite: 'lax', path: '/admin', maxAge: 12 * 60 * 60
  });
  redirect('/admin');
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect('/admin/login');
}
