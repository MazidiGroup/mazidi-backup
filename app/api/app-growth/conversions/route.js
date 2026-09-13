import { authorised } from "../../../../lib/cronAuth";
import { serverClient } from "../../../../lib/supabase";
import { checked } from "../../../../lib/appGrowthServer";
import { APP_CATALOG, normalizeEmail } from "../../../../lib/appGrowth";
export const dynamic = "force-dynamic";
export async function POST(request) {
  if (!authorised(request, "APP_GROWTH_INGEST_TOKEN"))
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const input = await request.json();
    if (
      !APP_CATALOG[input.app_key] ||
      !input.email ||
      typeof input.source !== "string" ||
      input.source.trim().length < 10
    )
      return Response.json(
        { error: "A matched email, app and purchase evidence are required." },
        { status: 422 },
      );
    const matched = checked(
      await serverClient().rpc("app_growth_conversion", {
        p_app_key: input.app_key,
        p_email: normalizeEmail(input.email),
        p_source: input.source.slice(0, 1000),
      }),
    );
    return Response.json({ matched });
  } catch {
    return Response.json(
      { error: "Conversion could not be recorded." },
      { status: 503 },
    );
  }
}
