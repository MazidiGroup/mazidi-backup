import { authorised } from '../../../../lib/cronAuth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  if (!authorised(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  return Response.json({ engine: 'ios_apps', contactsCreated: 0, halted: 'Former backup contact harvesting is retired. App contacts enter through permission-based imports.' });
}
