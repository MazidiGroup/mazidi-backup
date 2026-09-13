import {
  APP_CATALOG,
  deliverAppMessage,
  renderAppMessage,
  validateAppLead,
} from "./appGrowth.js";

export function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function growthSettings(db) {
  return checked(
    await db.from("app_growth_settings").select("*").eq("id", true).single(),
  );
}

export async function importAppLeads(db, inputs) {
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 100)
    throw new Error("Provide between 1 and 100 contacts.");
  const rows = inputs.map((input) => validateAppLead(input));
  // Insert only: imports cannot silently move people between apps, reset replies,
  // overwrite withdrawn permission or re-enrol an existing recipient.
  return checked(
    await db.from("app_growth_leads").insert(rows).select("lead_id,app_key"),
  );
}

export async function runAppOutreach(db, { dryRun = false } = {}) {
  const report = {
    engine: "ios_apps",
    dryRun,
    sent: 0,
    held: 0,
    campaigns: {},
    errors: [],
  };
  const settings = await growthSettings(db);
  if (!dryRun && !settings.sending_enabled)
    return { ...report, halted: "App invitations are paused." };
  if (!dryRun && !process.env.RESEND_API_KEY)
    return { ...report, halted: "Resend is not configured." };
  if (!dryRun && !process.env.RESEND_WEBHOOK_SECRET)
    return {
      ...report,
      halted: "Delivery event verification is not configured.",
    };
  // A small bounded run; existing hourly schedule continues to handle the queue.
  // SQL serialises reservations and enforces both global and per-app daily caps.
  for (const appKey of Object.keys(APP_CATALOG)) {
    if (dryRun) {
      const rows = checked(
        await db
          .from("app_growth_leads")
          .select("lead_id")
          .eq("app_key", appKey)
          .eq("status", "active")
          .limit(50),
      );
      const reasons = {};
      for (const row of rows) {
        const blockers = checked(
          await db.rpc("app_growth_blockers", { p_lead_id: row.lead_id }),
        );
        for (const { blocker } of blockers)
          reasons[blocker] = (reasons[blocker] || 0) + 1;
      }
      report.campaigns[appKey] = { assessed: rows.length, blockers: reasons };
      continue;
    }
    for (let i = 0; i < 2; i++) {
      const claim = checked(
        await db.rpc("app_growth_claim", { p_app_key: appKey }),
      );
      if (!claim) break;
      const lead = checked(
        await db
          .from("app_growth_leads")
          .select("email,first_name")
          .eq("lead_id", claim.lead_id)
          .single(),
      );
      const unsubscribeUrl = `https://backup.mazidigroup.com/api/app-growth/unsubscribe?t=${claim.unsubscribe_token}`;
      const copy = renderAppMessage({
        ...claim,
        first_name: lead.first_name,
        unsubscribeUrl,
      });
      const payload = {
        ...copy,
        to: [lead.email],
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [
          { name: "app", value: appKey },
          { name: "step", value: String(claim.sequence_step) },
          { name: "message", value: claim.message_id },
        ],
      };
      checked(
        await db
          .from("app_growth_messages")
          .update({ payload })
          .eq("message_id", claim.message_id)
          .eq("status", "reserved"),
      );
      // Recheck opt-out and reply gates immediately before the provider request.
      const permitted = checked(
        await db.rpc("app_growth_begin_send", {
          p_message_id: claim.message_id,
        }),
      );
      if (!permitted) {
        report.held++;
        continue;
      }
      try {
        const providerId = await deliverAppMessage({ ...claim, payload });
        // Do not regress delivered/bounced if a fast webhook arrived first.
        checked(
          await db.rpc("app_growth_record_sent", {
            p_message_id: claim.message_id,
            p_provider_id: providerId,
          }),
        );
        report.sent++;
      } catch (error) {
        report.errors.push({
          message_id: claim.message_id,
          error: error.message,
        });
        checked(
          await db
            .from("app_growth_messages")
            .update({ status: "uncertain", error: error.message })
            .eq("message_id", claim.message_id)
            .eq("status", "sending"),
        );
        // Uncertain messages are retained for reconciliation, never re-enqueued.
      }
    }
  }
  checked(
    await db
      .from("app_growth_runs")
      .insert({ kind: "outreach", detail: report }),
  );
  return report;
}

export async function runAppDiscovery(
  db,
  { dryRun = false, fetcher = fetch } = {},
) {
  const report = {
    engine: "ios_apps",
    dryRun,
    opportunities: 0,
    invitationsSent: 0,
    searches: [],
    errors: [],
  };
  const settings = await growthSettings(db);
  if (!settings.discovery_enabled)
    return { ...report, halted: "App discovery is paused." };
  const key = (process.env.GOOGLE_PLACES_API_KEY || "").trim();
  if (!key) return { ...report, halted: "Google Places is not configured." };
  // One search per app per day. Atomic claim prevents duplicate paid lookups.
  // These are potential partners/referral sources, not permission to email people.
  for (const [appKey, app] of Object.entries(APP_CATALOG)) {
    const sequence = dryRun
      ? { cursor: 0 }
      : checked(
          await db.rpc("app_growth_claim_discovery", { p_app_key: appKey }),
        );
    if (!sequence) continue;
    const query = app.searches[sequence.cursor % app.searches.length];
    report.searches.push({ app: appKey, query });
    if (dryRun) continue;
    try {
      const response = await fetcher(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.websiteUri,places.googleMapsUri,places.businessStatus,places.attributions",
          },
          body: JSON.stringify({
            textQuery: query,
            pageSize: 10,
            languageCode: "en",
            regionCode: appKey === "rera" ? "AE" : "GB",
          }),
        },
      );
      if (!response.ok)
        throw new Error(`Google Places returned ${response.status}.`);
      const result = await response.json();
      for (const place of result.places || []) {
        if (!place.id || place.businessStatus !== "OPERATIONAL") continue;
        const rows = checked(
          await db
            .from("app_growth_opportunities")
            .upsert(
              {
                source_key: `google:${place.id}`,
                app_key: appKey,
                name: place.displayName?.text || "Business",
                website: place.websiteUri || null,
                source_url: place.googleMapsUri || null,
                source_query: query,
                source_attributions: place.attributions || [],
                observed_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 29 * 86400000).toISOString(),
                note:
                  appKey === "musclemap"
                    ? "Gym partnership opportunity; membership does not establish individual interest or email permission."
                    : "Relevant business to review; no email permission established.",
              },
              { onConflict: "source_key", ignoreDuplicates: true },
            )
            .select("opportunity_id"),
        );
        report.opportunities += rows.length;
      }
    } catch (error) {
      report.errors.push({ app: appKey, error: error.message });
    }
  }
  if (!dryRun) {
    // Expired Google display content is removed; stable source IDs remain for deduplication.
    checked(
      await db
        .from("app_growth_opportunities")
        .update({
          name: "Refresh required",
          website: null,
          source_url: null,
          source_attributions: [],
        })
        .lt("expires_at", new Date().toISOString()),
    );
    checked(
      await db
        .from("app_growth_runs")
        .insert({ kind: "discovery", detail: report }),
    );
  }
  return report;
}
