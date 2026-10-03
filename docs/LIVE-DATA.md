# Live data, ingestion and the Review Desk

hyderabad.properties no longer reads `lib/mock-data.ts` at runtime. Every public view reads from the database, and nothing reaches the public site until a staff member presses **Approve & push live** on `/admin`.

```
 Government sources            Worker (cron / admin / CLI)          Review Desk (/admin)              Public site
 ──────────────────            ───────────────────────────          ────────────────────              ───────────
 TG-RERA project page  ─┐      detect change (content hash)         side by side diff                 /project?id=…
 TS-bPASS permit page  ─┼──▶   read new PDFs (unpdf)        ──▶     edit What changed / means  ──▶   CheckView, CommuteView,
 HYDRAA FTL GeoJSON    ─┤      AI read (Gemini, rules fallback)     verdict + score                   WatchingView refresh
 IGR guideline CSV     ─┘      queue in pending_updates             Approve │ Flag │ Reject           WhatsApp / email alerts
```

## Run it locally

```bash
npm install
npm run dev            # http://localhost:3000
open http://localhost:3000/admin   # any email, password "admin" in development
```

No database setup is needed locally. On first request the app creates an embedded Postgres in `./.data/pglite`, runs the migrations in `./drizzle`, and seeds the six original projects.

In the Review Desk, keep **Demo notices** selected and press **Run sync now**. Three realistic notices (penalty, extension, sanction, OC, FTL) are generated, read by the AI reader, and queued. Approve one and the public report updates in any open tab within a second (same browser) or within 30 seconds (any device).

## Production setup

1. Create a Postgres database (Neon, Supabase, Cloud SQL) and set `DATABASE_URL`. Migrations and seeding run automatically on first boot.
2. Set `ADMIN_USERS` (or `ADMIN_PASSWORD`), `ADMIN_SESSION_SECRET` and `CRON_SECRET`. The admin login refuses to work in production without them.
3. Set `ANTHROPIC_API_KEY` for AI reading (Claude). Without it, a deterministic rules reader is used (lower confidence, still reviewed by a human).
4. Schedule the sync. Either:
   - add repository secrets `SITE_URL` and `CRON_SECRET` and the included GitHub Action calls `/api/cron/sync-projects` every 6 hours, or
   - point Cloud Scheduler / any cron at `GET /api/cron/sync-projects` with header `Authorization: Bearer $CRON_SECRET`, or
   - run `npm run worker:sync -- --live` as a Cloud Run job.
5. Alerts: set `WHATSAPP_WEBHOOK_URL` (Gallabox, Wati, Zapier) and/or `RESEND_API_KEY`. Without them every alert is recorded in the `notifications` table as `logged`, visible in the desk's delivery log.

All variables are documented in `.env.example`.

## Sources

| Source | What the worker does | What you provide |
| --- | --- | --- |
| **TG-RERA** | Fetches each project's public page, strips volatile form state, hashes the text. On change it queues the page and reads any newly linked PDF (orders, QPRs, extension certificates). | The project's public page URL in **Admin > Sources**, or `RERA_PROJECT_URL_TEMPLATE`. |
| **TS-bPASS / HMDA / GHMC** | Same change detection on the permit page and its PDFs (permit orders, OC). | Permit page URL per project, or `BPASS_PERMIT_URL_TEMPLATE`. |
| **HYDRAA / Irrigation FTL** | Computes the distance from each site coordinate to the nearest FTL polygon edge and flags anything within the 30 m buffer (`FTL_BUFFER_METERS`). | FTL boundaries as GeoJSON (`FTL_GEOJSON_URL` or `data/ftl-lakes.geojson`) and the site lat/lng in **Sources**. |
| **IGR guideline values** | Compares published values to `micro_markets.guideline_rate_per_sq_ft` and queues moves above 1%. | `IGR_RATES_CSV_URL` or `data/igr-guideline-rates.csv`. |
| **Manual** | **Read a notice** on the desk: paste text or a PDF link, the AI reads it, it lands in the queue. | Anything a scraper cannot reach. |

The portal adapters use change detection plus AI reading rather than CSS selectors, so a portal redesign does not break them. Some government portals put project pages behind search forms, sessions or captchas. If a page cannot be fetched, the run log shows the error and the project can still be updated through **Read a notice**. Respect each portal's terms of use and keep the sync interval modest.

## API

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/projects` | public | Live projects, micro markets, latest alerts, version |
| GET | `/api/projects/[id]` | public | One project, its market and alert history |
| POST / DELETE | `/api/watch` | public | Subscribe / unsubscribe `{ projectId, channel, contact }` |
| GET / POST | `/api/cron/sync-projects` | `Bearer CRON_SECRET` | Run ingestion. `?mode=live\|simulate&sources=TG_RERA,IGR` |
| POST | `/api/ai/analyze-notice` | admin or cron | Read a notice `{ projectId, text?, url?, title?, enqueue? }`, returns the structured JSON |
| POST | `/api/admin/scrape-trigger` | admin | Run ingestion now `{ mode?, sources? }` |
| GET | `/api/admin/queue` | admin | Queue items with diffs, stats, delivery log |
| POST | `/api/admin/approve-update` | admin | Approve & push live `{ id, whatChanged?, whatItMeans?, status?, score?, summary?, notify? }` |
| POST | `/api/admin/reject-update` | admin | `{ id, action: 'reject' \| 'flag', note? }` |
| POST | `/api/admin/project-sources` | admin | Save portal URLs, coordinates, survey numbers |

`analyze-notice` returns the shape from the brief (`projectId`, `documentType`, `rawTitle`, `whatChanged`, `whatItMeans`, `recommendedStatus`, `confidenceScore`, `extractedData`) plus `proposedChanges` and `pendingUpdateId`.

## What "Approve & push live" does

In one database transaction:

1. claims the queue row (a second click or a second reviewer gets a 409),
2. applies the field changes to `projects`, sets verdict, score, `last_verified_at`, bumps `version`,
3. writes the timeline entry to `project_alerts`.

After commit it sends WhatsApp / email to every row in `watch_subscriptions` for that project and logs each attempt. Open public tabs refresh instantly via `BroadcastChannel`, other devices pick it up on their 30 second poll or on window focus.

The AI's recommended verdict can never be better than a deterministic floor (lake buffer overlap or missing registration is always Risk; pending approvals, lapsed validity or an open penalty is at least Caution). The reviewer can still override.

## Database

Schema lives in `lib/db/schema.ts` (Drizzle). Tables: `projects`, `micro_markets`, `pending_updates`, `project_alerts`, `watch_subscriptions`, `notifications`, `source_snapshots`, `scrape_runs`. After changing the schema run `npm run db:generate` and commit the new file in `drizzle/`.

`lib/mock-data.ts` remains only as the seed source and for types.
