# App acquisition operations

The lead engine promotes Fitness Muscle Coach to personal trainers/coaches, MuscleMap to interested gym users, and RERA Exam Prep Dubai to Dubai exam candidates. Invitations link directly to the respective App Store listing. RevenueCat and existing app purchases are unchanged.

`/admin/apps` is the owner dashboard. It provides campaign status, research, individual permission-based imports, customer recording, replies and a global pause. The old company records and unsubscribe links remain available.

## Deployment and cutover

1. Apply `supabase/migrations/20260913184137_ios_app_acquisition.sql` to the existing database. It creates server-only tables and functions, enables RLS, revokes public/anonymous/authenticated access, disables former campaign sends and discovery, and preserves historical data. It installs with app invitations paused.
2. Deploy this application. Existing scheduled `/api/cron/discover`, `/api/cron/outreach` and `/api/cron/replies` calls are reused. Former `/contacts` and `/verify` calls return a retirement message and perform no searches or writes.
3. Confirm the Resend sender and the actual Reply-To mailbox for each brand. Mark only verified campaigns `sender_ready=true,replies_ready=true` in `app_growth_campaigns`. A successful live inbox check must also be less than two hours old before sending.
4. In the admin dashboard, check inboxes, run discovery, and preview the queue. Enable invitations only after the sender and inbox checks pass. The global default cap is 20 attempted invitations/day, with at most 10 per app; failed and uncertain attempts count toward the cap. UTC day boundaries are used for quotas; sending windows are weekdays 09:00–17:00 London for fitness and Dubai for RERA.

Keep the existing support@mazidigroup.com IMAP environment for the fitness apps. RERA uses aimal@mazidihomes.com and separate RERA_IMAP_* variables. It remains blocked until its sender DNS, mailbox connection, and readiness flags are verified. Do not change the business’s root MX records to enable Resend; sending uses a separate return-path subdomain.

The existing Resend webhook at `/api/webhooks/resend` handles app tags as well as historical backup messages. Subscribe to email.sent, email.delivered, email.bounced, email.complained, email.failed and email.suppressed. Preserve its signing secret in `RESEND_WEBHOOK_SECRET`.

## Discovery and eligible recipients

Daily research rotates through bounded Google Places queries for coaches, fitness gyms and Dubai real estate training organisations. Results are potential partners/referral sources for review, not a list of individuals who consented. At most one ten-result query per app per UTC day is reserved in the database. No public email harvesting is used. The starting fitness geography is the UK; RERA research is in Dubai. Google display content expires after 29 days; stable place identifiers are retained for deduplication.

An app recipient needs all of: a matching audience, expressed iOS interest, recorded email permission specifically for that app, permission source and wording, and email verification within 180 days. Imports do not convert previous backup contacts, change existing assignments, override objections, or fabricate consent. Configure the source form only after identifying the actual permission records.

For an existing server-side opt-in form, set a private `APP_GROWTH_INGEST_TOKEN` and POST to `/api/app-growth/leads` using `Authorization: Bearer <token>`. Never expose this token in a public form or iOS app. The JSON body is `{ "leads": [ ... ] }`, with 1–100 records. Each record contains:

| Field | Meaning |
| --- | --- |
| app_key | fmc, musclemap, or rera; exactly one |
| audience | personal_trainer, gym_user, or dubai_exam_candidate respectively |
| email, first_name | Actual verified address; name optional |
| person_key | Optional stable source-system person identity; prefix with source name |
| ios_interest | true only when established |
| permission_state | opted_in |
| consent_app_key | Same as app_key |
| consent_source | Actual form receipt/reference or source URL |
| consent_text | Exact permission wording |
| consent_at | Actual permission time in ISO 8601 |
| email_verified_at | Actual verification time in ISO 8601 |

The normalized address is globally unique across campaigns; known Gmail dot/plus aliases are collapsed. A provided person_key also prevents one identified person joining via multiple addresses. Distinct unlinked email addresses cannot be reliably identified as the same person.

For verified customer records, POST `{ "app_key": "...", "email": "...", "source": "actual purchase reference" }` to `/api/app-growth/conversions` with the same private token. An app+email match stops invitations. Anonymous RevenueCat IDs and App Store clicks are not counted as identified buyers or installs. There is no automatic RevenueCat identity integration until a genuine source can supply a matching email.

## Delivery behavior

One invitation and at most one follow-up, no sooner than five days later. Every reservation is atomic and unique by contact+step. A second database gate checks permission and suppression immediately before the provider call. Replies, matched purchases, bounces, complaints and unsubscribe events stop further invitations. Historical suppression and contact/reply state are also checked.

If a provider response is uncertain, the message stays reserved/uncertain and is never automatically retried. Inspect Resend and reconcile its provider ID with the stored immutable message ID before any manual intervention. Provider idempotency keys are valid for 24 hours and are not relied on for indefinite deduplication. A message already handed to the provider cannot be recalled by a later unsubscribe.

The six Resend editor drafts are reviewable copies. Production sends the reviewed text from `lib/appGrowth.js` with a per-message unsubscribe link; editing or publishing a Resend draft does not change the worker’s copy.

## Verification

`npm test` includes the existing checks and an in-memory PostgreSQL test of the exact migration: role access, audience/consent, global identity assignment, duplicate reservations, caps, timeout holds, follow-up timing, inbox freshness, legacy suppression, replies, purchases and webhook ordering. `npm run build` verifies the Next.js application. Next.js is patched within version 15 and PostCSS is pinned to a compatible patched version.

To stop all app sends, set `app_growth_settings.sending_enabled=false` or use the dashboard. Retain old OUTREACH_ENABLED=false and inactive former campaigns when rolling back code so backup invitations do not resume. This deployment does not control separate Apollo/Gmail sequences; check any independently scheduled campaigns separately.
