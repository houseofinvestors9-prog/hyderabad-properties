# hyderabad.properties

Free, independent checks for Hyderabad homes.
Live at **https://hyderabad.properties**

A buyer usually decides they want a flat before anyone checks whether the project is
legally safe to buy. The records that would tell them are public, and almost nobody reads
them, because they are spread across four government portals and arrive as PDFs.

This reads those records and turns them into one plain verdict per project, with the
source and the date attached to every claim.

## What it reads

| Source | What it takes |
|---|---|
| TG-RERA | Registration status, validity and extensions, promoter, approved plans, quarterly progress, complaints and orders |
| TS-bPASS, HMDA, GHMC | Permit number, sanctioned floors and units, occupancy certificate |
| HYDRAA and irrigation | Lake full tank level polygons, to flag anything inside the buffer |
| IGR | Government guideline value per sq ft, by area |

## How it works

```
 Government sources          Worker (cron or CLI)          Review desk (/admin)         Public site
 ──────────────────          ────────────────────          ────────────────────         ───────────
 RERA project page   ─┐      detect change by hash         side by side diff            /project?id=…
 bPASS permit page   ─┼──▶   read new PDFs          ──▶    edit what changed      ──▶   check, commute
 HYDRAA FTL GeoJSON  ─┤      AI read, rules fallback       verdict and score            and watch views
 IGR guideline CSV   ─┘      queue in pending_updates      approve, flag, reject        WhatsApp alerts
```

Change is detected by hashing page text rather than by CSS selectors, so a portal
redesign does not break the collector. Claude reads newly linked PDFs and extracts fields
with a confidence label. Where no API key is set, a deterministic rules reader runs
instead, at lower confidence.

**Nothing publishes automatically.** Every verdict waits for a named person to press
approve on the review desk. A wrong verdict in public about somebody's project carries
legal exposure, so a person signs it.

## Stack

Next.js App Router and TypeScript, Postgres with Drizzle, Anthropic SDK, Tailwind.
Locally it needs no database: on first request it creates an embedded Postgres in
`./.data/pglite`, runs the migrations and seeds.

## Run it

```bash
npm install
npm run dev                        # http://localhost:3000
open http://localhost:3000/admin   # any email, password "admin" in development
```

In the review desk, keep **Demo notices** selected and press **Run sync now**. Realistic
notices are generated, read, and queued. Approve one and the public report updates.

Production setup, every environment variable, and the full collector reference are in
[docs/LIVE-DATA.md](docs/LIVE-DATA.md). The build order for the data side is in
[docs/BACKEND-WORKFLOW.md](docs/BACKEND-WORKFLOW.md).

## Honest limits

- Individual promoters are never named. Projects and companies only.
- About 15% of RERA feed rows carry no certificate number. Those show feed facts only.
- Land records (Bhu Bharati) sit behind search forms and captchas. They are not
  automated, and they are not pretended to be.
- A project with no checked report says so, rather than guessing.

## Context

This is the public surface of a larger system. The family record it feeds, the partner
attribution layer and the case study are at
[hoi-one-record](https://github.com/houseofinvestors9-prog/hoi-one-record).

Built by House of Investors, Hyderabad.
