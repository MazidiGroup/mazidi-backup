import { authorised } from '../../../../lib/cronAuth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  if (!authorised(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  return Response.json({ engine: 'ios_apps', halted: 'Former backup verification is retired. App imports require verified email addresses and app-specific permission.' });
}
