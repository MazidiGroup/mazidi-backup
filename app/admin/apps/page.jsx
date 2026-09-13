import { redirect } from "next/navigation";
import { isSignedIn } from "../../../lib/adminAuth";
import { serverClient } from "../../../lib/supabase";
import { APP_CATALOG, renderAppMessage } from "../../../lib/appGrowth";
import { checked, growthSettings } from "../../../lib/appGrowthServer";
import {
  addContact,
  setSending,
  discoverNow,
  previewQueue,
  refreshReplies,
  stopContact,
  recordPurchase,
} from "./actions";

export const metadata = { title: "App campaigns" };
const labels = {
  personal_trainer: "Personal trainers and coaches",
  gym_user: "People interested in gym training",
  dubai_exam_candidate: "Dubai real estate exam candidates",
};
const readable = (value) => String(value).replaceAll("_", " ");
const safeLink = (value) => {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};

export default async function Apps({ searchParams }) {
  if (!(await isSignedIn())) redirect("/admin/login");
  const db = serverClient();
  const [settings, campaigns, leads, opportunities, runs, replies] =
    await Promise.all([
      growthSettings(db),
      db
        .from("app_growth_campaigns")
        .select("*")
        .order("app_key")
        .then(checked),
      db
        .from("app_growth_leads")
        .select("lead_id,email,app_key,status,permission_state,created_at")
        .order("created_at", { ascending: false })
        .limit(100)
        .then(checked),
      db
        .from("app_growth_opportunities")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("observed_at", { ascending: false })
        .limit(60)
        .then(checked),
      db
        .from("app_growth_runs")
        .select("kind,created_at,detail")
        .order("created_at", { ascending: false })
        .limit(10)
        .then(checked),
      db
        .from("app_growth_reply_events")
        .select("event_key,lead_id,subject,body,classification,received_at")
        .order("received_at", { ascending: false })
        .limit(20)
        .then(checked),
    ]);
  const counts = {};
  for (const key of Object.keys(APP_CATALOG)) {
    const [contacts, sent, converted] = await Promise.all([
      db
        .from("app_growth_leads")
        .select("*", { count: "exact", head: true })
        .eq("app_key", key),
      db
        .from("app_growth_messages")
        .select("*", { count: "exact", head: true })
        .eq("app_key", key)
        .in("status", ["sent", "delivered"]),
      db
        .from("app_growth_leads")
        .select("*", { count: "exact", head: true })
        .eq("app_key", key)
        .not("converted_at", "is", null),
    ]);
    [contacts, sent, converted].forEach(checked);
    counts[key] = {
      contacts: contacts.count,
      sent: sent.count,
      converted: converted.count,
    };
  }
  const blockers = {};
  const messages = leads.length
    ? checked(
        await db
          .from("app_growth_messages")
          .select("lead_id,sequence_step,status")
          .in(
            "lead_id",
            leads.map((l) => l.lead_id),
          ),
      )
    : [];
  for (const lead of leads.filter((l) => l.status === "active"))
    blockers[lead.lead_id] = checked(
      await db.rpc("app_growth_blockers", { p_lead_id: lead.lead_id }),
    ).map((r) => readable(r.blocker));
  for (const lead of leads) {
    const history = messages.filter((m) => m.lead_id === lead.lead_id);
    if (
      history.some((m) =>
        ["uncertain", "reserved", "sending"].includes(m.status),
      )
    )
      blockers[lead.lead_id] = [
        "Delivery pending or needs review; automatic retries are blocked",
      ];
    else if (history.some((m) => m.sequence_step === 2))
      blockers[lead.lead_id] = ["Sequence finished"];
    else if (history.length && !(blockers[lead.lead_id] || []).length)
      blockers[lead.lead_id] = ["Waiting for the follow-up date"];
  }
  const params = await searchParams;
  return (
    <>
      <h1>App campaigns</h1>
      <p>
        Three audiences. One relevant app per contact. Invitations lead directly
        to the App Store.
      </p>
      {params.message && (
        <p role="status" className="notice">
          {params.message}
        </p>
      )}
      <p>
        <strong>
          {settings.sending_enabled
            ? "Invitations enabled"
            : "Invitations paused"}
        </strong>{" "}
        · Discovery {settings.discovery_enabled ? "on" : "paused"} · Up to{" "}
        {settings.daily_cap} invitations per day across all apps
      </p>
      <div className="growth-controls">
        <form action={setSending}>
          <input
            type="hidden"
            name="enabled"
            value={String(!settings.sending_enabled)}
          />
          <button type="submit">
            {settings.sending_enabled
              ? "Pause invitations"
              : "Enable eligible invitations"}
          </button>
        </form>
        <form action={discoverNow}>
          <button type="submit">Find app opportunities</button>
        </form>
        <form action={refreshReplies}>
          <button type="submit">Check reply inboxes</button>
        </form>
        <form action={previewQueue}>
          <button type="submit">Check queue without sending</button>
        </form>
      </div>
      <div className="cards">
        {campaigns.map((c) => {
          const a = APP_CATALOG[c.app_key];
          return (
            <section className="card" key={c.app_key}>
              <span className="tag">{a.brand}</span>
              <h2>{a.name}</h2>
              <p>{labels[a.audience]}</p>
              <p>
                {counts[c.app_key].contacts} contacts · {counts[c.app_key].sent}{" "}
                invitations sent · {counts[c.app_key].converted} matched
                customers
              </p>
              <p className="small">
                Sender {c.sender_ready ? "verified" : "awaiting verification"} ·
                Reply inbox{" "}
                {c.replies_ready &&
                c.replies_last_checked_at &&
                Date.now() - new Date(c.replies_last_checked_at) < 7200000
                  ? "checked recently"
                  : "awaiting a successful check"}
              </p>
              <p className="small">
                Up to {c.daily_cap}/day · {c.window_start}:00–{c.window_end}:00,{" "}
                {c.time_zone} · One follow-up after five days, when eligible
              </p>
              <a href={a.url} target="_blank" rel="noreferrer">
                View on the App Store ↗
              </a>
              <details>
                <summary>Read invitation</summary>
                <pre className="notes">
                  {
                    renderAppMessage({
                      app_key: c.app_key,
                      sequence_step: 1,
                      first_name: "there",
                      unsubscribeUrl: "[individual unsubscribe link]",
                    }).text
                  }
                </pre>
              </details>
            </section>
          );
        })}
      </div>
      <h2>Contacts</h2>
      <p className="small">
        Latest 100. Matching email addresses and linked person identifiers
        cannot join another app campaign. Discovered businesses are not
        automatically enrolled.
      </p>
      {!leads.length ? (
        <p className="empty">
          No app contacts yet. Add verified opt-ins below or connect your
          existing opt-in form.
        </p>
      ) : (
        <div className="growth-table">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>App</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.lead_id}>
                  <td>{l.email}</td>
                  <td>{APP_CATALOG[l.app_key].name}</td>
                  <td>
                    {l.status === "active"
                      ? blockers[l.lead_id]?.join(", ") ||
                        "Eligible; sequence and daily limits checked at send time"
                      : readable(l.status)}
                  </td>
                  <td>
                    {l.status === "active" && (
                      <form action={stopContact}>
                        <input type="hidden" name="lead_id" value={l.lead_id} />
                        <button type="submit">Stop invitations</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="cards">
        <section className="card">
          <h2>Add an opted-in contact</h2>
          <p className="small">
            Use the person’s recorded permission for the selected app. A
            publicly listed email address or gym membership alone does not
            provide that permission.
          </p>
          <form action={addContact}>
            <label>
              App
              <select name="app_key" required>
                {Object.entries(APP_CATALOG).map(([k, a]) => (
                  <option key={k} value={k}>
                    {a.name} — {labels[a.audience]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Email
              <input type="email" name="email" required maxLength={254} />
            </label>
            <label>
              First name
              <input name="first_name" maxLength={80} />
            </label>
            <label>
              Permission source or record link
              <input
                name="consent_source"
                required
                minLength={10}
                maxLength={4000}
              />
            </label>
            <label>
              Exact wording they agreed to
              <textarea
                name="consent_text"
                required
                minLength={10}
                maxLength={4000}
              />
            </label>
            <label>
              Permission date
              <input type="date" name="consent_at" required />
            </label>
            <label>
              Email verified on
              <input type="date" name="email_verified_at" required />
            </label>
            <label className="check">
              <input type="checkbox" name="ios_interest" required />
              This person expressed interest in the selected iOS app.
            </label>
            <label className="check">
              <input type="checkbox" name="permission_confirmed" required />
              The record confirms permission to email this person about this
              app.
            </label>
            <button type="submit">Add contact</button>
          </form>
        </section>
        <section className="card">
          <h2>Record an existing customer</h2>
          <p className="small">
            A known purchase stops further invitations. RevenueCat billing
            continues in the apps. Only record a purchase when it can be matched
            to this email.
          </p>
          <form action={recordPurchase}>
            <label>
              App
              <select name="app_key">
                {Object.entries(APP_CATALOG).map(([k, a]) => (
                  <option key={k} value={k}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Customer email
              <input type="email" name="email" required />
            </label>
            <label>
              Purchase reference or evidence
              <input name="source" required minLength={10} maxLength={1000} />
            </label>
            <button type="submit">Record customer and stop invitations</button>
          </form>
        </section>
      </div>
      <h2>Research opportunities</h2>
      <p className="small">
        Google Maps business results for relevant coaches, gyms and Dubai
        training providers. Gym results identify potential referral partners,
        not individual gym users. Review relevance and obtain permission before
        enrolling anyone.
      </p>
      {!opportunities.length ? (
        <p className="empty">
          Research results will appear after discovery runs.
        </p>
      ) : (
        <div className="growth-table">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>App</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.opportunity_id}>
                  <td>{o.name}</td>
                  <td>{APP_CATALOG[o.app_key].name}</td>
                  <td>
                    {safeLink(o.source_url) ? (
                      <a
                        href={safeLink(o.source_url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Google Maps ↗
                      </a>
                    ) : (
                      "Google Maps"
                    )}
                    {safeLink(o.website) && (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={safeLink(o.website)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Website ↗
                        </a>
                      </>
                    )}
                    {o.source_attributions.map((a, i) => (
                      <span key={i}> · {a.provider}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2>Recent replies</h2>
      {!replies.length ? (
        <p className="small">No app replies recorded.</p>
      ) : (
        replies.map((r) => (
          <details className="card" key={r.event_key}>
            <summary>
              {r.subject || "(No subject)"} · {readable(r.classification)}
            </summary>
            <pre className="notes">{r.body}</pre>
          </details>
        ))
      )}
      <h2>Recent runs</h2>
      {runs.map((r, i) => (
        <p className="small" key={i}>
          {new Date(r.created_at).toLocaleString("en-GB", {
            timeZone: "Europe/London",
          })}{" "}
          · {r.kind} ·{" "}
          {r.detail.halted ||
            (r.kind === "discovery"
              ? `${r.detail.opportunities || 0} new opportunities`
              : `${r.detail.sent || 0} invitations sent`)}
          {r.detail.errors?.length
            ? ` · ${r.detail.errors.length} errors: ${r.detail.errors.map((e) => e.error).join("; ")}`
            : ""}
        </p>
      ))}
    </>
  );
}
