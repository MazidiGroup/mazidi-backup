# Business Backup & Recovery — website + lead capture

## Before this goes live

1. Replace every `___PLACEHOLDER___` in `lib/config.js`. The site will render them
   literally until you do — that is deliberate, so nothing false ships by accident.
2. Copy `.env.example` to `.env.local` and fill it in.
3. Have `app/privacy/page.jsx` reviewed. It is a working draft, not legal advice.

## Run locally

```
npm install
npm run dev
```

## Deploy

Vercel, free tier. Set the environment variables from `.env.example` in the project
settings. `SUPABASE_SERVICE_ROLE_KEY` must be a server-side variable — it bypasses
row-level security and must never be prefixed `NEXT_PUBLIC_`.

## Data flow

Contact form → `POST /api/lead` → server-side validation → `website_leads` table →
`activity_log` entry → email alert to the owner. Row-level security is on and there
are no policies, so the anon key can read nothing; all writes go through the service
role inside the API route.
