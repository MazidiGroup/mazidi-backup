import { authorised } from "../../../../lib/cronAuth";
import { serverClient } from "../../../../lib/supabase";
import { importAppLeads } from "../../../../lib/appGrowthServer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request) {
  if (!authorised(request, "APP_GROWTH_INGEST_TOKEN"))
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  const body = await request.text();
  if (body.length > 500000)
    return Response.json({ error: "Import too large." }, { status: 413 });
  try {
    const result = await importAppLeads(serverClient(), JSON.parse(body).leads);
    return Response.json({ imported: result.length }, { status: 201 });
  } catch {
    return Response.json(
      {
        error:
          "Import rejected. Check audience, email verification, permission evidence and duplicate contacts.",
      },
      { status: 422 },
    );
  }
}
