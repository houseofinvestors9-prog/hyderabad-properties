# Backend workflow: from government records to a published verdict

This is the build order for the data side of hyderabad.properties. It assumes the site keeps its own
Next.js and Postgres stack (no Base44), and that every step writes to one database HOI owns.

What already exists in this repo is marked **Built**. Everything else is to do, in the order below.

---

## Where Base44 fits

Base44 is the sales floor, not the data engine.

| Job | Where it lives | Why |
| --- | --- | --- |
| Project records, documents, verdicts, alerts | This app's Postgres | Crawling thousands of pages and reading PDFs every night needs a real job runner and a database we own. Base44 is metered: its shared credits ran out on 30 Sep and blocked every integration. |
| Buyer leads, calling rota, Priya, follow-up | HOI Lead Engine (Base44) | It already does this well. This site sends it leads and nothing else. |
| Later: "this buyer checked these projects" on the lead card | Lead Engine reads from this app's API | One-way read, added once the Lead Engine has a field for it. |

---

## The pipeline at a glance

```
 1 Discover        2 Collect           3 Read             4 Match            5 Check            6 Review          7 Publish        8 Watch
 ───────────       ──────────          ──────             ───────            ───────            ────────          ─────────        ───────
 every RERA   ──▶  RERA page, PDFs, ─▶ AI pulls fields ─▶ one project id ──▶ rules + verdict ─▶ person signs ──▶ public page ──▶ nightly re-run,
 project in        permits, lake       from each PDF,     across all          floor, score,      off, edits       with source      alerts to buyers
 Hyderabad,        maps, guideline     with confidence    sources, one        mismatches         wording          links and        who watch it
 plus buyer        values, builder                        developer table                                         dates
 requests          sites
```

---

## Step 0. Foundation (week 1)

| # | Task | Notes |
| --- | --- | --- |
| 0.1 | Production Postgres in AWS Mumbai | Same HOI-owned database server as the data spine in the roadmap, its own schema for this site. Set `DATABASE_URL`. Migrations run on boot (**Built**). |
| 0.2 | Document store | S3 bucket in Mumbai for every PDF and page snapshot, keyed by content hash. Today PDFs are read and discarded; keep them, they are the evidence behind each verdict. |
| 0.3 | Separate worker process | Move crawling out of the web app's cron route into a scheduled worker (ECS scheduled task or Cloud Run job). A full city sync takes hours; a web request times out in seconds. `npm run worker:sync` (**Built**) is the starting point. |
| 0.4 | Job queue with per-site rate limits | One queue table or SQS. Each government domain gets its own slow rate (for example one request every 3 to 5 seconds) and its own retry budget. |
| 0.5 | Secrets and admin accounts | `ADMIN_USERS`, `ADMIN_SESSION_SECRET`, `CRON_SECRET` (**Built**, must be set in production). |
| 0.6 | Monitoring | `scrape_runs` table (**Built**). Add a daily summary to the team WhatsApp or email: pages fetched, failures by source, queue size. |

## Step 1. Discover every project (weeks 1 to 3)

Today the worker only watches projects someone adds by hand. Coverage starts with a full list.

| # | Task | Notes |
| --- | --- | --- |
| 1.1 | TG-RERA project list crawler | Walk the portal's public registered-project listing for the Hyderabad, Rangareddy, Medchal-Malkajgiri and Sangareddy districts. Store each registration number, name, promoter and page URL in a new `rera_registry` table. Expect several thousand projects. |
| 1.2 | Buyer requests | **Built** this week: `project_requests` table and the "Projects buyers asked for" list on `/admin`. Most-asked projects go first in every queue. |
| 1.3 | Search misses | Log every search that returned nothing (a `search_misses` table). This is the same demand signal from people who did not fill the form. |
| 1.4 | Priority order | Process in this order: buyer requests, then West Hyderabad corridors (Kokapet, Neopolis, Financial District, Narsingi, Tellapur, Gachibowli), then the rest of the city. |

## Step 2. Collect the records (weeks 2 to 6)

One collector per source. Each one saves the raw page or file to S3 first, then hashes it to detect change (**Built** for RERA and permit pages).

| # | Source | What we take | How |
| --- | --- | --- | --- |
| 2.1 | TG-RERA project page | Registration status, validity and extensions, promoter, land area, approved plans, quarterly progress reports, escrow, complaints and orders | Page plus every linked PDF (**Built** for a given URL; needs the URL list from 1.1) |
| 2.2 | TG-RERA orders and notices | Penalties, revocations, defaulter lists | Crawl the orders pages daily. Revocations are the alerts buyers care about most. |
| 2.3 | Building permissions (TS-bPASS, HMDA, GHMC) | Permit number, sanctioned floors and units, occupancy certificate | Permit page per project (**Built** for a given URL). Permit numbers come from the RERA filings in 2.1. |
| 2.4 | Lake full tank level and buffer maps (HMDA lakes, HYDRAA, irrigation) | Lake boundary polygons | Download once as GeoJSON, refresh monthly. Distance check is **Built** (`lib/ingest/geo.ts`). |
| 2.5 | Site location | Latitude and longitude of each project | From the RERA layout plan or the address, geocoded, then a person confirms on a map. Without coordinates the lake check cannot run. |
| 2.6 | Land records (Bhu Bharati) | Survey number status, prohibited-land list | Usually behind search forms and captchas. Do not automate past them. Look up manually for the top projects, or licence data from a records provider. |
| 2.7 | Guideline values (IGRS) | Government value per sq ft by area, revised 5 June 2026 | CSV import (**Built**). |
| 2.8 | Builder websites and brochures | Possession date, floors, amenities, price sheet | Crawl politely (Firecrawl is already paid for). Never republish the brochure; store it as evidence only. |
| 2.9 | News and court reports | Demolitions, disputes, stop-work orders | Daily news search per project and builder name, matched in step 4, always reviewed before use. |

Rules for every collector:
- If a page shows a captcha or a login, stop and mark it for manual collection. Working around it puts the whole brand at risk.
- Keep every request polite and identified, and respect each site's terms.
- Personal data stays out: collect projects and companies, not individuals.

## Step 3. Read the documents (weeks 3 to 7)

| # | Task | Notes |
| --- | --- | --- |
| 3.1 | Text from PDFs | `unpdf` for text PDFs (**Built**). Add OCR for scanned plans and certificates. |
| 3.2 | AI field extraction | `lib/ai/analyze-notice.ts` (**Built**, Gemini with a rules fallback). Extend it to a fixed list of fields per document type, each with a confidence score and the page it came from. |
| 3.3 | Bulk runs | The first city-wide pass is thousands of PDFs. Run it on rented cloud GPUs or the office RTX 4090 workstation at night; keep daily updates on the normal worker. |

## Step 4. Match everything to one project (weeks 4 to 8)

| # | Task | Notes |
| --- | --- | --- |
| 4.1 | One project id | The RERA registration number is the key. Phases with separate registrations are separate projects linked to a parent. |
| 4.2 | Developer table | One row per company, with every name variant and its CIN. Lets one builder's record carry across projects. |
| 4.3 | Name aliases and fuzzy search | Store marketing names, old names and spelling variants; add Postgres trigram search so "Prestige Clairmont" finds "Prestige Clairemont". This is what keeps the "not found" page honest. |

## Step 5. Check and score (weeks 6 to 9)

| # | Task | Notes |
| --- | --- | --- |
| 5.1 | Verdict floor | **Built** (`lib/verdict.ts`): lake buffer overlap or missing registration is always High Risk; pending approval, lapsed validity or open penalty is at least Needs a Closer Look. |
| 5.2 | Mismatch checks | Brochure versus filing: possession date, floors, units, amenities on the sanctioned plan. These are the most useful lines on any report. |
| 5.3 | Published method | One public page that explains every check and how the verdict is set. Same method for projects House of Investors sells. |

## Step 6. Human review (ongoing)

| # | Task | Notes |
| --- | --- | --- |
| 6.1 | Review Desk | **Built** (`/admin`): side-by-side diff, edit wording, approve, flag or reject. |
| 6.2 | A named verifier | A person with approvals or legal background signs off every new verdict and every downgrade. |
| 6.3 | Legal opinion before launch | One review of how we word negative findings about named projects. |
| 6.4 | Correction requests | A form for builders to dispute a finding with documents, answered within a set number of days. |

## Step 7. Publish (week 8 onward)

| # | Task | Notes |
| --- | --- | --- |
| 7.1 | Public report | **Built**. Add the source link and fetch date on every line, and the evidence PDF from S3. |
| 7.2 | One page per project and per area | Real URLs (`/projects/aurelia-heights-neopolis`) instead of `?id=`, with a sitemap. This is where the public traffic comes from. |
| 7.3 | Monthly area index | Built from guideline values plus our own deal data later. |

## Step 8. Watch and alert (ongoing)

| # | Task | Notes |
| --- | --- | --- |
| 8.1 | Nightly re-run | Change detection on every source (**Built** per page). |
| 8.2 | Buyer alerts | **Built**: WhatsApp webhook and email, logged in `notifications`. Connect the WhatsApp provider. |
| 8.3 | Request follow-up | When a requested project goes live, message everyone who asked for it (`project_requests.requester_*`). |

## Step 9. Leads to the Lead Engine

**Built** this week. Every form writes to the `leads` table first, then forwards to the CRM.

To connect:

1. Set `LEAD_WEBHOOK_URL=https://hoi-lead-flow.base44.app/functions/webhookHP` in the production environment. Leave `LEAD_WEBHOOK_TOKEN` empty unless the Lead Engine secret `HP_WEBHOOK_TOKEN` is set, then use the same value.
2. Restart the app.
3. Send one test booking with a team member's real number and check it appears in the Lead Engine under project HP.

What happens on the Lead Engine side (set up 2 Oct 2026):
- `webhookHP` stores the raw request, then creates the lead with source `hyderabad_properties` and project `HP` (hyderabad.properties).
- The HP rota is Sukanya only. She makes the first call and hands the buyer to a mandate rota (Terrace 35, Oxygen Forest and so on) when one fits.
- The site, page, form, project the buyer was checking and their quiz answers are in the lead's notes.
- Leads without a phone number are not forwarded, because the Lead Engine cannot put them on the calling rota. They stay in our `leads` table.
- If forwarding fails, the lead is still saved here with `forward_status = failed` and the error, so nothing is lost.

## Step 10. New launches, picked up automatically

The goal: a project has a page on hyderabad.properties within a day of it first appearing anywhere public,
so buyers searching its name land on us first.

### Where a new project shows up first

| Signal | Usually appears | How we catch it | Check frequency |
| --- | --- | --- | --- |
| Building permit (TS-bPASS, HMDA, GHMC) | Earliest, months before sales | New permits in our corridors, from the permit search pages | Daily |
| TG-RERA registration | Before legal marketing can start | Diff the registered-project list against `rera_registry` (step 1.1); every new registration number is a new project | Daily, early morning |
| Builder website | Around launch | A watch list of builder sites: sitemap and "projects" page diffs (Firecrawl change tracking) | Daily |
| Builder ads | At launch | Meta Ad Library search by builder page and by area name (the Meta connector already reaches it) | Daily |
| News and launch coverage | At launch | Daily news search for "launch" plus our area names | Daily |

### What happens when one fires

1. **Create a draft project.** One row keyed on the RERA number if there is one, otherwise on builder plus name plus area. It goes through matching (step 4) so a second signal for the same project joins the same row.
2. **Pull the facts.** Collectors from step 2 fetch the RERA page and PDFs, the permit, and the builder's project page.
3. **Read them.** AI extraction (step 3) fills name, builder, location, units, floors, configuration, possession date and price if published.
4. **Place it on the map.** Geocode, then run the lake buffer check automatically.
5. **Publish a "New listing" page at once.** Basic facts only, each with its source and date, clearly marked "Not yet checked". No verdict. This page is what captures early searches.
6. **Queue the full check.** It goes to the Review Desk; the verdict appears only after a person signs off (step 6).
7. **Tell the people who care.** Alert buyers who follow that area, and anyone who requested the project (step 8.3).

### Images: what we can use, and how it is automated

| Image type | Automated? | Rule |
| --- | --- | --- |
| Location map (satellite or street map with the site pinned) | Yes, generated from the coordinates | Use a map provider whose licence allows it on a public site |
| Layout and site plans from the RERA filing | Yes, cropped from the PDF | Public filings, shown as evidence next to the fact they support, with the source |
| Builder renders and brochure photos | Only for builders who have said yes | They are the builder's copyright. A builder opt-in form ("send us your media kit") stores the permission with the files. Without it we do not copy them. |
| Our own photos and drone footage | Yes, from the content team's shoot folder | Best option: real, current and ours. Feeds the site visit and 3D tour plan from the content workstation |
| Area photos | Yes | Stock or our own, always labelled "Representative photo" |

Every image goes into a `project_assets` table: project, type, source URL, licence status (`own`, `public_record`,
`builder_permission`, `stock`), file hash and the date fetched. The worker downloads, de-duplicates by hash, resizes,
stores in S3 and serves through a CDN. AI tags each image (render, plan, real photo) so a render is never shown as
a real photo. The page picks the best image it is allowed to show, in this order: our own photo, builder-permitted
render, map.

### Build order for step 10

1. RERA new-registration diff (needs the registry from step 1.1). Highest value, lowest effort.
2. Draft project rows and "New listing" pages with the "Not yet checked" label.
3. Map image and RERA plan crops.
4. Builder website watch list, starting with the 30 most active builders in West Hyderabad.
5. Meta Ad Library and news checks.
6. Builder opt-in form for media kits.
7. Permit watch, once the permit collector in step 2.3 works.

---

## Order of work and owners

| Weeks | Work | Owner (suggested) |
| --- | --- | --- |
| 1 | Step 0, Step 9 connection | Saif |
| 1 to 3 | Step 1 discovery crawler, search-miss logging | Saif |
| 2 to 6 | Step 2 collectors, starting with RERA pages and orders | Saif, with the tech lead once hired |
| 3 to 7 | Step 3 extraction, first city-wide pass | Saif |
| 4 to 8 | Step 4 matching and aliases | Saif |
| 6 to 9 | Step 5 checks and published method | Saif with the verifier |
| From 6 | Step 6 review, legal opinion | Verifier, founders |
| From 8 | Step 7 public pages and SEO | Nikhil, Saif |
| Ongoing | Step 8 alerts | Saif |
| From 4 | Step 10 new-launch pickup, starting with the RERA diff | Saif |
| From 6 | Builder media kit opt-in, own site photography | Nikhil, Madhu |

## Before anything goes public

- Every published fact links to its source and shows the date we checked it.
- A person has approved every verdict.
- The legal opinion on negative findings is in writing.
- The ownership disclosure is on the site (already in the footer and FAQ).
