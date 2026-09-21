# GrowthOS

Agency Intelligence for HighLevel — one screen for your whole client portfolio.

This is **phase 1**: GHL Marketplace OAuth install, data sync from sub-accounts, and a single-owner Agency Dashboard. See `/root/.claude/plans/i-want-to-create-moonlit-clover.md` (or your own copy of the plan) for the full phase 1 scope and the longer-term roadmap (RBAC, AI analyst, morning brief, multi-factor health scoring) this schema is designed to grow into.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · Postgres (Neon/Supabase) · NextAuth (email magic link) · deployed on **Hostinger Node.js Web Apps Hosting**.

## Local setup

1. **Database** — `docker compose up -d` starts a local Postgres. Or point `DATABASE_URL`/`DIRECT_URL` at Neon/Supabase.
2. **Env** — copy `.env.example` to `.env` and fill in:
   - `TOKEN_ENCRYPTION_KEY` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `GHL_CLIENT_ID` / `GHL_CLIENT_SECRET` / `GHL_REDIRECT_URI` — from a dev app in the [HighLevel developer portal](https://marketplace.gohighlevel.com/). Since the OAuth callback needs a public HTTPS URL, point `GHL_REDIRECT_URI` at an ngrok/Cloudflare Tunnel URL during local dev (HighLevel has no separate API sandbox — you test against a real trial agency).
   - `GHL_WEBHOOK_PUBLIC_KEY` — HighLevel's published Ed25519 public key for verifying webhook signatures.
   - `EMAIL_SERVER` / `EMAIL_FROM` — SMTP creds (e.g. Resend) for magic-link sign-in.
   - `CRON_SECRET` — any random string; must match what you send as `Authorization: Bearer <CRON_SECRET>` when hitting `/api/cron/sync` locally.
3. **Install & migrate:**
   ```bash
   npm install
   npm run prisma:migrate
   npm run dev
   ```
4. Visit `/api/ghl/install` to start the install flow against your dev HighLevel agency.

## Key flows

- **Install:** `GET /api/ghl/install` → HighLevel consent → `GET /api/ghl/callback` (exchanges the code, stores encrypted tokens, pulls installed locations, seeds sync runs, routes to onboarding or the dashboard).
- **Sync:** triggered by the post-install seed, an in-process 15-minute interval started from `src/instrumentation.ts` (Hostinger's Node.js Web Apps Hosting has no cron product, but does run a persistent Node process, so the process schedules its own sync work — see below), the `/api/cron/sync` route as a manual/external-trigger fallback, or the dashboard's "Refresh Now" button (`/api/sync/trigger` + `/api/sync/status`). See `src/server/sync/runSync.ts` — each invocation processes a bounded amount of work and resumes from a persisted cursor next time.
- **Webhooks:** `POST /api/ghl/webhook` verifies the Ed25519 signature, dedupes by `webhookId`, and handles `AppUninstall` / `LocationCreate` / `LocationUpdate`.
- **Dashboard:** `src/app/(dashboard)/dashboard/page.tsx` — portfolio stat tiles + per-client health table, computed in `src/lib/aggregate.ts` with a placeholder scoring function in `src/lib/health.ts`.

## Deploying to Hostinger

This app deploys via Hostinger's **Node.js Web Apps Hosting** (hPanel → Websites → Add Website → Node.js web app → Import Git repository), a Git-connected build/deploy flow (not a VPS). It runs a real persistent Next.js server, but has no built-in Postgres and no cron/scheduled-jobs product for this hosting type — both are handled as described above and below.

1. **Connect the repo** — in hPanel, import `fullstackgrowthagency/growthos`, branch `main`. Framework preset "Next.js", Node 22.x, and default build/output settings are auto-detected correctly; nothing to change there.
2. **Database** — provision a free Postgres instance on [Neon](https://neon.tech) (recommended) or [Supabase](https://supabase.com). Neon gives you both a pooled connection string (`DATABASE_URL`) and a direct one (`DIRECT_URL`) out of the box; Supabase's connection page has the same split.
3. **Environment variables** — in the "Environment Variables" step of the import flow (or later under the site's settings), add every var from `.env.example`, with production values:
   - `DATABASE_URL`, `DIRECT_URL` — from step 2
   - `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_REDIRECT_URI` (`https://<your-domain>/api/ghl/callback`), `GHL_API_BASE_URL`, `GHL_API_VERSION`, `GHL_SCOPES`, `GHL_WEBHOOK_PUBLIC_KEY`
   - `TOKEN_ENCRYPTION_KEY`, `NEXTAUTH_SECRET` — each `openssl rand -base64 32`
   - `NEXTAUTH_URL` (`https://<your-domain>`)
   - `EMAIL_SERVER`, `EMAIL_FROM`, `CRON_SECRET`, `SYNC_LOOKBACK_DAYS`
4. **Deploy** — the build runs `npm install` (which runs `postinstall` → `prisma generate`) then `npm run build`. This does **not** run migrations. After the first successful deploy, run `npx prisma migrate deploy` once from a machine that can reach the production database (using the same `DATABASE_URL`/`DIRECT_URL`) to create the schema.
5. **Domain** — works immediately on the free `*.hostingersite.com` subdomain Hostinger assigns; attach a custom domain in hPanel for production use (automatic SSL either way). Update `GHL_REDIRECT_URI` and `NEXTAUTH_URL` if the domain changes after the HighLevel app is already registered.
6. **HighLevel app** — register (or update) a Marketplace app in the HighLevel developer portal with the redirect URI pointed at the live domain, then run a real install end-to-end.
7. **Confirm the in-process scheduler is actually running** — check that `SyncRun` rows advance roughly every 15 minutes with no external trigger (see `src/instrumentation.ts`). If the platform ever recycles the process faster than that interval, sync still catches up via the resumable cursor design; nothing to lose.

## Explicitly out of scope for phase 1

Per-user RBAC/assignment UI, AI analyst chat, AI morning brief, the full multi-factor Client Health Score engine, per-sub-account drill-down dashboards, embedded GHL Custom Pages, and Marketplace listing/review submission. The `User`/`UserLocationAccess` schema and the `raw Json` columns on synced entities exist so these are additive later without a rewrite.

## Verification checklist

- [ ] OAuth: real install against a trial HighLevel agency; confirm `Agency`/`GhlInstallation`/`Location` rows via `npm run prisma:studio`; confirm token fields are ciphertext.
- [ ] Token refresh: backdate `GhlInstallation.expiresAt`, confirm the next call refreshes and rotates the stored refresh token.
- [ ] Sync correctness: seed known records in the GHL UI for one location, sync, compare against what lands in Postgres; add a record, re-sync, confirm no duplicates.
- [ ] Webhooks: use the Marketplace app's test-send to fire `LocationCreate`/`AppUninstall`; confirm signature verification and dedupe.
- [ ] Dashboard accuracy: compute expected totals via direct SQL for a fixed range and compare to what renders.
