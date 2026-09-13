import { serverClient } from '../../../../lib/supabase';
import { authorised } from '../../../../lib/cronAuth';
import { runAppOutreach } from '../../../../lib/appGrowthServer';
export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';
export async function GET(request) {
  if (!authorised(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    return Response.json(await runAppOutreach(serverClient(), { dryRun: new URL(request.url).searchParams.get('dry') === '1' }));
  } catch {
    return Response.json({ error: 'App outreach stopped because a required check failed.' }, { status: 503 });
  }
}
