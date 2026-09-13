"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isSignedIn } from "../../../lib/adminAuth";
import { serverClient } from "../../../lib/supabase";
import { APP_CATALOG } from "../../../lib/appGrowth";
import {
  checked,
  importAppLeads,
  runAppDiscovery,
  runAppOutreach,
} from "../../../lib/appGrowthServer";
import { processAppReplies } from "../../../lib/appGrowthReplies";

async function requireAdmin() {
  if (!(await isSignedIn())) throw new Error("Sign in required.");
}
function done(message) {
  revalidatePath("/admin/apps");
  redirect(`/admin/apps?message=${encodeURIComponent(message)}`);
}

export async function addContact(form) {
  await requireAdmin();
  const appKey = String(form.get("app_key"));
  let result =
    "Contact added. Sending will wait for all campaign checks to pass.";
  try {
    if (form.get("permission_confirmed") !== "on")
      throw new Error("Permission required.");
    await importAppLeads(serverClient(), [
      {
        app_key: appKey,
        audience: APP_CATALOG[appKey]?.audience,
        email: form.get("email"),
        first_name: form.get("first_name"),
        ios_interest: form.get("ios_interest") === "on",
        permission_state: "opted_in",
        consent_app_key: appKey,
        consent_source: form.get("consent_source"),
        consent_text: form.get("consent_text"),
        consent_at: form.get("consent_at"),
        email_verified_at: form.get("email_verified_at"),
      },
    ]);
  } catch {
    result =
      "Contact not added. Check the permission evidence, verification dates and whether this person is already assigned to an app.";
  }
  done(result);
}

export async function setSending(form) {
  await requireAdmin();
  checked(
    await serverClient()
      .from("app_growth_settings")
      .update({ sending_enabled: form.get("enabled") === "true" })
      .eq("id", true),
  );
  done(
    form.get("enabled") === "true"
      ? "Invitations enabled for eligible contacts. All sender and permission checks still apply."
      : "All app invitations paused.",
  );
}

export async function discoverNow() {
  await requireAdmin();
  let result;
  try {
    const r = await runAppDiscovery(serverClient());
    result =
      r.halted ||
      `${r.opportunities} new research opportunities. ${r.errors.length} search errors.`;
  } catch {
    result =
      "Discovery could not complete. Check the activity and provider connection.";
  }
  done(result);
}

export async function previewQueue() {
  await requireAdmin();
  let result;
  try {
    const r = await runAppOutreach(serverClient(), { dryRun: true });
    result =
      r.halted ||
      "Queue checked. No invitations were sent. See each contact’s status below.";
  } catch {
    result =
      "Queue check failed. Sending remains blocked when a required check fails.";
  }
  done(result);
}

export async function refreshReplies() {
  await requireAdmin();
  const reports = await processAppReplies(serverClient());
  done(
    reports
      .map(
        (r) =>
          `${r.apps.includes("rera") ? "Mazidi Homes" : "Mazidi Group"}: ${r.ready ? "inbox checked" : r.reason}`,
      )
      .join(" "),
  );
}

export async function stopContact(form) {
  await requireAdmin();
  checked(
    await serverClient().rpc("app_growth_stop", {
      p_lead_id: String(form.get("lead_id")),
      p_reason: "Paused by owner",
      p_suppress: true,
    }),
  );
  done("Contact suppressed. Further invitations are stopped.");
}

export async function recordPurchase(form) {
  await requireAdmin();
  const source = String(form.get("source") || "").trim();
  if (source.length < 10)
    done("Enter a purchase reference or source before recording a customer.");
  const saved = checked(
    await serverClient().rpc("app_growth_conversion", {
      p_app_key: String(form.get("app_key")),
      p_email: String(form.get("email")),
      p_source: source.slice(0, 1000),
    }),
  );
  done(
    saved
      ? "Customer recorded. Further invitations to this contact are stopped."
      : "No matching contact for that app.",
  );
}
