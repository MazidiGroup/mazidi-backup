import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  APP_CATALOG,
  validateAppLead,
  renderAppMessage,
  deliverAppMessage,
} from "../lib/appGrowth.js";

const now = new Date();
const input = {
  app_key: "fmc",
  audience: "personal_trainer",
  email: " Person@Example.com ",
  ios_interest: true,
  permission_state: "opted_in",
  consent_app_key: "fmc",
  consent_source: "https://example.com/form/receipt",
  consent_text: "Please send me emails about Fitness Muscle Coach.",
  consent_at: new Date(now - 3600000).toISOString(),
  email_verified_at: new Date(now - 3600000).toISOString(),
};
assert.equal(validateAppLead(input).email, "person@example.com");
for (const bad of [
  { audience: "gym_user" },
  { consent_app_key: "rera" },
  { permission_state: "pending" },
  { ios_interest: false },
  { consent_source: "" },
  { email: "x@example.com\nBcc:test@example.com" },
  { email_verified_at: new Date(now - 181 * 86400000).toISOString() },
]) {
  assert.throws(() => validateAppLead({ ...input, ...bad }));
}
for (const key of Object.keys(APP_CATALOG))
  for (const step of [1, 2]) {
    const mail = renderAppMessage({
      app_key: key,
      sequence_step: step,
      first_name: "Sam",
      unsubscribeUrl: "https://example.com/unsubscribe/token",
    });
    assert.match(mail.text, /https:\/\/example.com\/unsubscribe\/token/);
    assert.equal(
      Object.values(APP_CATALOG).filter((a) => mail.text.includes(a.url))
        .length,
      1,
    );
    assert.ok(mail.text.includes(APP_CATALOG[key].url));
    assert.equal(mail.from, APP_CATALOG[key].from);
    assert.ok(
      !/backup check|calendly|£|guaranteed pass|free trial/i.test(mail.text),
    );
  }
const savedKey = process.env.RESEND_API_KEY;
process.env.RESEND_API_KEY = "test-only";
let requests = 0;
await assert.rejects(
  deliverAppMessage(
    { message_id: "test-message", payload: { to: ["test@example.com"] } },
    async (url, options) => {
      requests++;
      assert.equal(
        options.headers["Idempotency-Key"],
        "app-growth/test-message",
      );
      throw new Error("timeout");
    },
  ),
);
assert.equal(
  requests,
  1,
  "Provider ambiguity must not trigger automatic retries",
);
if (savedKey === undefined) delete process.env.RESEND_API_KEY;
else process.env.RESEND_API_KEY = savedKey;

const db = new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create table app_config(key text primary key,value text,description text,is_secret boolean);
 insert into app_config(key,value) values ('OUTREACH_ENABLED','true'),('DISCOVERY_ENABLED','true');
 create table companies(company_id uuid primary key default gen_random_uuid(),is_customer boolean default false,pipeline_status text);
 create table contacts(contact_id uuid primary key default gen_random_uuid(),company_id uuid references companies,email text,objected boolean default false,hard_bounced boolean default false);
 create table outreach(outreach_id uuid primary key default gen_random_uuid(),contact_id uuid references contacts,sent_at timestamptz);
 create table replies(from_email text,classification text);
 create table suppression(email text,email_domain text,reason text,source text,permanent boolean);
 create table campaigns(active boolean); insert into campaigns values(true);
`);
try {
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20260913184137_ios_app_acquisition.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
} catch (error) {
  console.error("Migration failed:", error.message);
  throw error;
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const call = async (name, params = []) =>
  Object.values(
    await one(
      `select ${name}(${params.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
      params,
    ),
  )[0];
const blockers = async (id) =>
  (
    await db.query("select blocker from app_growth_blockers($1)", [id])
  ).rows.map((x) => x.blocker);
const lead = async (email, app = "fmc", extra = {}) => {
  const cols = [
    "email",
    "app_key",
    "audience",
    "ios_interest",
    "permission_state",
    "consent_app_key",
    "consent_source",
    "consent_text",
    "consent_at",
    "email_verified_at",
    ...Object.keys(extra),
  ];
  const values = [
    email,
    app,
    APP_CATALOG[app].audience,
    true,
    "opted_in",
    app,
    "Recorded form permission",
    "Agreed to emails about the selected app",
    new Date(now - 3600000).toISOString(),
    new Date(now - 3600000).toISOString(),
    ...Object.values(extra),
  ];
  return (
    await one(
      `insert into app_growth_leads(${cols.join(",")}) values(${values.map((_, i) => "$" + (i + 1)).join(",")}) returning lead_id`,
      values,
    )
  ).lead_id;
};
assert.equal(
  (await one("select value from app_config where key='OUTREACH_ENABLED'"))
    .value,
  "false",
);
assert.equal((await one("select active from campaigns")).active, false);
assert.equal(
  (await one("select sending_enabled from app_growth_settings"))
    .sending_enabled,
  false,
);
assert.equal(
  (
    await one(
      "select count(*)::int as n from pg_class where relname like 'app_growth_%' and relkind='r' and not relrowsecurity",
    )
  ).n,
  0,
);
await db.exec("set role anon");
await assert.rejects(
  db.query("select * from app_growth_leads"),
  /permission denied/,
);
await assert.rejects(
  db.query("select app_growth_claim('fmc')"),
  /permission denied/,
);
await db.exec("reset role");

const first = await lead("sam@gmail.com", "fmc", {
  person_key: "crm:person-one",
});
await assert.rejects(
  lead("s.am+different@googlemail.com", "musclemap"),
  /unique/,
);
await assert.rejects(
  lead("other@example.com", "rera", { person_key: "crm:person-one" }),
  /unique/,
);
await assert.rejects(
  db.query(
    "update app_growth_leads set app_key='musclemap',audience='gym_user' where lead_id=$1",
    [first],
  ),
  /cannot be reassigned/,
);
await assert.rejects(
  db.query(
    "insert into app_growth_messages(lead_id,app_key,sequence_step) values($1,'rera',1)",
    [first],
  ),
  /foreign key/,
);
assert.ok((await blockers(first)).includes("sender_not_verified"));
assert.equal(await call("app_growth_claim", ["fmc"]), null);
await db.exec(`update app_growth_settings set sending_enabled=true;
 update app_growth_campaigns set sender_ready=true,replies_ready=true,replies_last_checked_at=now(),window_start=0,window_end=24,send_weekdays=array[1,2,3,4,5,6,7];`);
assert.deepEqual(await blockers(first), []);
const reservation = await call("app_growth_claim", ["fmc"]);
assert.equal(reservation.lead_id, first);
assert.equal(reservation.sequence_step, 1);
assert.equal(
  await call("app_growth_claim", ["fmc"]),
  null,
  "Reserved recipient cannot be claimed twice",
);
await db.query(
  "update app_growth_messages set payload='{}' where message_id=$1",
  [reservation.message_id],
);
assert.equal(
  await call("app_growth_begin_send", [reservation.message_id]),
  true,
);
assert.equal(
  await call("app_growth_begin_send", [reservation.message_id]),
  false,
  "Only one worker may begin a provider request",
);
await db.query(
  "update app_growth_messages set status='uncertain' where message_id=$1",
  [reservation.message_id],
);
assert.equal(
  await call("app_growth_claim", ["fmc"]),
  null,
  "Uncertain sends must never restart a sequence",
);
await call("app_growth_delivery_event", [
  reservation.message_id,
  "resend-test",
  "email.delivered",
  new Date().toISOString(),
]);
await call("app_growth_record_sent", [reservation.message_id, "resend-test"]);
assert.equal(
  (
    await one("select status from app_growth_messages where message_id=$1", [
      reservation.message_id,
    ])
  ).status,
  "delivered",
);
assert.equal(
  await call("app_growth_claim", ["fmc"]),
  null,
  "Follow-up cannot send early",
);
await db.query(
  "update app_growth_messages set sent_at=now()-interval '6 days' where message_id=$1",
  [reservation.message_id],
);
const follow = await call("app_growth_claim", ["fmc"]);
assert.equal(follow.sequence_step, 2);
await call("app_growth_unsubscribe", [reservation.unsubscribe_token]);
await db.query(
  "update app_growth_messages set payload='{}' where message_id=$1",
  [follow.message_id],
);
assert.equal(
  await call("app_growth_begin_send", [follow.message_id]),
  false,
  "Unsubscribe cancels an already-reserved follow-up",
);
assert.equal(
  (await one("select status from app_growth_leads where lead_id=$1", [first]))
    .status,
  "suppressed",
);
assert.equal(
  await call("app_growth_unsubscribe", [reservation.unsubscribe_token]),
  true,
  "Unsubscribe is idempotent",
);
await assert.rejects(
  db.query(
    "update app_growth_leads set status='active',permission_state='opted_in' where lead_id=$1",
    [first],
  ),
  /cannot be re-enrolled/,
);

const legacy = await lead("legacy@example.com", "rera");
await db.exec("insert into suppression(email_domain) values('example.com')");
assert.ok((await blockers(legacy)).includes("suppressed"));
await db.exec("delete from suppression where email_domain is not null");
await db.exec(
  "insert into contacts(email,objected) values('legacy@example.com',true)",
);
assert.ok((await blockers(legacy)).includes("existing_contact_stopped"));
await db.exec(
  "update contacts set objected=false; insert into replies values('legacy@example.com','QUESTION')",
);
assert.ok((await blockers(legacy)).includes("existing_reply"));
const replying = await lead("reply@example.org", "musclemap");
assert.equal(
  await call("app_growth_receive_reply", [
    replying,
    "reply-001",
    "OUT_OF_OFFICE",
    "Away",
    "Away until Monday",
    new Date().toISOString(),
  ]),
  true,
);
assert.equal(
  (
    await one("select status from app_growth_leads where lead_id=$1", [
      replying,
    ])
  ).status,
  "active",
);
assert.equal(
  await call("app_growth_receive_reply", [
    replying,
    "reply-002",
    "QUESTION",
    "Question",
    "Can I track sets?",
    new Date().toISOString(),
  ]),
  true,
);
assert.equal(
  await call("app_growth_receive_reply", [
    replying,
    "reply-002",
    "QUESTION",
    "Question",
    "Can I track sets?",
    new Date().toISOString(),
  ]),
  false,
);
assert.ok((await blockers(replying)).includes("recipient_stopped"));
const customer = await lead("buyer@example.org", "rera");
assert.equal(
  await call("app_growth_conversion", [
    "fmc",
    "buyer@example.org",
    "Verified purchase record",
  ]),
  false,
);
assert.equal(
  await call("app_growth_conversion", [
    "rera",
    "buyer@example.org",
    "Verified purchase record",
  ]),
  true,
);
assert.ok((await blockers(customer)).includes("recipient_stopped"));
const bounced = await lead("bounced@example.net", "musclemap");
const bouncedMsg = await call("app_growth_claim", ["musclemap"]);
await call("app_growth_delivery_event", [
  bouncedMsg.message_id,
  "resend-bounce",
  "email.bounced",
  new Date().toISOString(),
]);
await call("app_growth_delivery_event", [
  bouncedMsg.message_id,
  "resend-bounce",
  "email.delivered",
  new Date().toISOString(),
]);
assert.equal(
  (
    await one("select status from app_growth_messages where message_id=$1", [
      bouncedMsg.message_id,
    ])
  ).status,
  "bounced",
);
assert.ok((await blockers(bounced)).includes("suppressed"));
// Stale inboxes and missing config fail closed.
const gated = await lead("gated@example.net", "fmc");
await db.exec(
  "update app_growth_campaigns set replies_last_checked_at=now()-interval '3 hours' where app_key='fmc'",
);
assert.ok((await blockers(gated)).includes("reply_monitor_stale"));
await db.exec(
  "update app_growth_campaigns set replies_last_checked_at=now(); delete from app_config where key='OUTREACH_ENABLED'",
);
assert.ok((await blockers(gated)).includes("legacy_outreach_not_paused"));
await db.exec(
  "insert into app_config(key,value) values('OUTREACH_ENABLED','false')",
);
// Atomic reservations account for every attempt, including uncertain/failed calls.
for (let i = 0; i < 12; i++) await lead(`cap${i}@example.net`, "fmc");
let n = 0;
while (await call("app_growth_claim", ["fmc"])) n++;
assert.equal(
  n,
  8,
  "Two earlier FMC reservations count against its daily cap of ten",
);
for (let i = 0; i < 15; i++) await lead(`mm${i}@example.net`, "musclemap");
while (await call("app_growth_claim", ["musclemap"])) {}
assert.equal(
  (await one("select count(*)::int as n from app_growth_messages")).n,
  20,
  "Global cap is shared across campaigns",
);
const afterCap = await lead("overcap@example.net", "rera");
assert.equal(await call("app_growth_claim", ["rera"]), null);
assert.ok(afterCap);
assert.deepEqual(await call("app_growth_claim_discovery", ["fmc"]), {
  cursor: 0,
});
assert.equal(
  await call("app_growth_claim_discovery", ["fmc"]),
  null,
  "Scheduled overlap cannot duplicate daily discovery",
);
await db.close();
console.log(
  "App acquisition checks passed: content, permission, privacy, identity, caps, reservations, replies, conversions and delivery events.",
);
