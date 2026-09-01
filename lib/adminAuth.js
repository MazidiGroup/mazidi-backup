// Owner-only dashboard access.
//
// One shared secret, ADMIN_SECRET, set by the owner in Vercel. It is never
// logged, never placed in a URL, and never sent anywhere but the login form.
// A successful login sets an HttpOnly cookie holding an HMAC of the secret
// (not the secret itself), valid for 12 hours.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const COOKIE = 'mg_admin';
const TTL_MS = 12 * 60 * 60 * 1000;

function secret() {
  return (process.env.ADMIN_SECRET || '').trim();
}

function sign(expires) {
  return createHmac('sha256', secret()).update(`admin:${expires}`).digest('hex');
}

export function tokenFor(expires = Date.now() + TTL_MS) {
  return `${expires}.${sign(expires)}`;
}

export function tokenValid(token) {
  if (!secret() || !token) return false;
  const [exp, sig] = String(token).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function secretMatches(supplied) {
  const s = secret();
  if (!s || typeof supplied !== 'string') return false;
  const a = Buffer.from(s), b = Buffer.from(supplied.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isSignedIn() {
  const jar = await cookies();
  return tokenValid(jar.get(COOKIE)?.value);
}

export function configured() {
  return Boolean(secret());
}
