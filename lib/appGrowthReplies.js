import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { classify, ownWords } from "./replies.js";
import { checked } from "./appGrowthServer.js";

async function scanMailbox(db, { host, user, pass, appKeys, dryRun }) {
  if (!host || !user || !pass)
    return {
      apps: appKeys,
      ready: false,
      reason: "Reply mailbox is not configured.",
    };
  const contacts = [];
  for (let offset = 0; ; offset += 500) {
    const page = checked(
      await db
        .from("app_growth_leads")
        .select("lead_id,email,created_at")
        .in("app_key", appKeys)
        .order("lead_id")
        .range(offset, offset + 499),
    );
    contacts.push(...page);
    if (page.length < 500) break;
    if (offset >= 9500)
      throw new Error("Reply recipient scan requires pagination expansion.");
  }
  const byEmail = new Map(contacts.map((c) => [c.email, c]));
  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
  let recorded = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Fetch only envelopes first; bodies are retrieved only for exact recipients.
      const envelopes = await client.fetchAll(
        { since: new Date(Date.now() - 14 * 86400000) },
        { envelope: true },
        { uid: true },
      );
      for (const envelope of envelopes) {
        const sender = (
          envelope.envelope?.from?.[0]?.address || ""
        ).toLowerCase();
        const contact = byEmail.get(sender);
        if (!contact) continue;
        // Earlier unrelated mailbox conversations are not app replies.
        if (
          envelope.envelope?.date &&
          new Date(envelope.envelope.date) < new Date(contact.created_at)
        )
          continue;
        const eventKey = `${user}/${client.mailbox.uidValidity}/${envelope.uid}`;
        const existing = checked(
          await db
            .from("app_growth_reply_events")
            .select("event_key")
            .eq("event_key", eventKey)
            .maybeSingle(),
        );
        if (existing) continue;
        const item = await client.fetchOne(
          envelope.uid,
          { source: true },
          { uid: true },
        );
        const parsed = await simpleParser(item.source);
        const text = parsed.text || "";
        const headers = Object.fromEntries(
          [...parsed.headers.entries()].map(([k, v]) => [
            k,
            typeof v === "string" ? v : v?.value || "",
          ]),
        );
        const result = classify({
          subject: parsed.subject,
          text,
          headers,
          fromEmail: sender,
        });
        if (dryRun) continue;
        const saved = checked(
          await db.rpc("app_growth_receive_reply", {
            p_lead_id: contact.lead_id,
            p_event_key: eventKey,
            p_classification: result.classification,
            p_subject: parsed.subject || "",
            p_body: ownWords(text).slice(0, 20000),
            p_received_at: (parsed.date || new Date()).toISOString(),
          }),
        );
        if (saved) recorded++;
      }
    } finally {
      lock.release();
    }
    if (!dryRun)
      checked(
        await db
          .from("app_growth_campaigns")
          .update({ replies_last_checked_at: new Date().toISOString() })
          .in("app_key", appKeys),
      );
    return { apps: appKeys, ready: true, recorded };
  } finally {
    try {
      await client.logout();
    } catch {}
  }
}

export async function processAppReplies(db, { dryRun = false } = {}) {
  const reports = [];
  const inboxes = [
    {
      host: process.env.IMAP_HOST,
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD,
      appKeys: ["fmc", "musclemap"],
    },
    {
      host: process.env.RERA_IMAP_HOST,
      user: process.env.RERA_IMAP_USER,
      pass: process.env.RERA_IMAP_PASSWORD,
      appKeys: ["rera"],
    },
  ];
  for (const inbox of inboxes) {
    // Guard against accidentally monitoring a different mailbox from Reply-To.
    const expected =
      inbox.appKeys[0] === "rera"
        ? "aimal@mazidihomes.com"
        : "support@mazidigroup.com";
    if ((inbox.user || "").trim().toLowerCase() !== expected) {
      reports.push({
        apps: inbox.appKeys,
        ready: false,
        reason: "The app Reply-To mailbox is not connected.",
      });
      continue;
    }
    try {
      reports.push(await scanMailbox(db, { ...inbox, dryRun }));
    } catch {
      reports.push({
        apps: inbox.appKeys,
        ready: false,
        reason: "Reply mailbox check failed.",
      });
    }
  }
  return reports;
}
