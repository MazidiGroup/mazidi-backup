# Deploying mazidi-backup

Vercel's API integration cannot create production deployments on this account,
so this project goes up the same way your other five do: via GitHub.

## 1. Create the repo

On GitHub, under the **MazidiGroup** org, create an empty **private** repo named
`mazidi-backup`. No README, no .gitignore, no licence — this folder already has them.

## 2. Push this folder

From inside this folder:

```bash
git init
git add .
git commit -m "Backup and recovery site, CRM lead capture, lead discovery engine"
git branch -M main
git remote add origin https://github.com/MazidiGroup/mazidi-backup.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `.next` and `.env*`, so no secrets
and no build output are committed.

## 3. Tell Claude the repo exists

Claude links it to a new Vercel project and triggers the first deployment.

## 4. Environment variables

Set these in Vercel → Settings → Environment Variables **before** the first run
of the lead engine. Add them yourself; do not paste keys into a chat.

| Variable | Where it comes from | Environments |
|---|---|---|
| `SUPABASE_URL` | `https://kiplqpsubnxohswvkwxr.supabase.co` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Production only |
| `COMPANIES_HOUSE_API_KEY` | Your new REST key | Production, Preview |
| `CRON_SECRET` | `openssl rand -base64 32` | Production |
| `RESEND_API_KEY` | Resend dashboard | Production |
| `RESEND_FROM` | `Aimal Mazidi <aimal@mazidigroup.com>` | Production |
| `OWNER_ALERT_EMAIL` | `support@mazidigroup.com` | Production |

**`SUPABASE_SERVICE_ROLE_KEY` must never be prefixed `NEXT_PUBLIC_`.** That key
bypasses every row-level security policy on the CRM; the prefix would ship it to
every visitor's browser.

## 5. Domain

Add `backup.mazidigroup.com` in Vercel → project → Settings → Domains. The
wildcard `*.mazidigroup.com` already points at Vercel, so no DNS change is needed.

## 6. First dry run

```
GET https://backup.mazidigroup.com/api/cron/discover?dry=1&limit=10
Authorization: Bearer <CRON_SECRET>
```

`dry=1` writes nothing to the database and sends nothing. It returns the
companies it found, their scores and the reasoning. Check those against your own
judgement before running it for real.

Once you drop `dry=1` it writes to the CRM — but still sends nothing. Outreach is
gated separately on `OUTREACH_ENABLED` in `app_config`, which is `false`.

## Tests

```bash
npm test
```

Nine scoring cases covering the ideal target, an MSP that files under an
accountancy SIC code, a non-corporate subscriber, an oversized firm, a dormant
company, and the distance boundaries at 30 and 46 miles.
