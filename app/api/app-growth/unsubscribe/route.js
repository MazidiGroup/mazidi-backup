import { serverClient } from "../../../../lib/supabase";
import { checked } from "../../../../lib/appGrowthServer";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function unsubscribe(request) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    )
  )
    return false;
  return checked(
    await serverClient().rpc("app_growth_unsubscribe", { p_token: token }),
  );
}
export async function GET(request) {
  try {
    const ok = await unsubscribe(request);
    return Response.redirect(
      new URL(ok ? "/unsubscribed" : "/unsubscribed?unknown=1", request.url),
      303,
    );
  } catch {
    return new Response("Unable to save your request. Please try again.", {
      status: 503,
    });
  }
}
export async function POST(request) {
  try {
    const ok = await unsubscribe(request);
    return new Response(null, { status: ok ? 200 : 404 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
