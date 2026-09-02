// Email verification via Reoon (emailverifier.reoon.com), power mode.
// Optional: without EMAIL_VERIFY_API_KEY every call returns
// { checked: false } and contacts stay UNVERIFIED, which send_blockers()
// treats as a hard stop. A missing key can never cause a send.
//
// Result vocabulary matches send_blockers(): only VALID and CATCH_ALL clear
// the EMAIL_NOT_VERIFIED blocker.

const ENDPOINT = 'https://emailverifier.reoon.com/api/v1/verify';

export function mapReoon(r) {
  const status = String(r.status || '').toLowerCase();
  const deliverable = r.is_deliverable === true;
  const catchAll = r.is_catch_all === true;
  switch (status) {
    case 'safe':
      return { result: 'VALID', why: 'mailbox confirmed' };
    case 'role_account':
      // Reoon labels info@ etc. as a category. The LIA prefers exactly these
      // addresses, so we go by what the check actually found.
      if (deliverable && !catchAll) return { result: 'VALID', why: 'role address, mailbox confirmed' };
      if (catchAll)                 return { result: 'CATCH_ALL', why: 'role address on a catch-all domain' };
      if (r.is_deliverable === false) return { result: 'INVALID', why: 'role address does not exist' };
      return { result: 'UNKNOWN', why: 'role address, deliverability not established' };
    case 'catch_all':
      return { result: 'CATCH_ALL', why: 'domain accepts all addresses; mailbox cannot be confirmed individually' };
    case 'invalid':
    case 'disabled':
    case 'disposable':
    case 'spamtrap':
      return { result: 'INVALID', why: status };
    case 'inbox_full':
      return { result: 'UNKNOWN', why: 'inbox full; retried later' };
    default:
      return { result: 'UNKNOWN', why: `provider could not decide (${status || 'no status'})` };
  }
}

export async function verifyEmail(email) {
  const key = (process.env.EMAIL_VERIFY_API_KEY || '').trim();
  if (!key) return { checked: false };
  const url = new URL(ENDPOINT);
  url.searchParams.set('email', email);
  url.searchParams.set('key', key);
  url.searchParams.set('mode', 'power');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 75000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return { checked: true, error: `Reoon ${res.status}` };
    const j = await res.json();
    if (j.status === 'error' || j.reason) return { checked: true, error: String(j.reason || 'error') };
    return {
      checked: true, ...mapReoon(j),
      raw: { status: j.status, is_deliverable: j.is_deliverable, is_catch_all: j.is_catch_all,
             is_role_account: j.is_role_account, overall_score: j.overall_score, mode: j.verification_mode }
    };
  } catch (e) {
    return { checked: true, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(t);
  }
}
