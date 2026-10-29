import { and, asc, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import type { DB } from '../db/client';
import { reraRegistry, type ReraChange, type ReraDetails, type ReraRegistryRow } from '../db/schema';
import { request } from 'node:https';
import { rootCertificates } from 'node:tls';
import { sha256 } from './fetcher';
import { EMSIGN_SSL_CA_G1 } from './certs';
import { parseDocumentList, saveDocumentList } from './rera-documents';

/**
 * TG-RERA registry.
 *
 * 1. Feed: the authority's public project map (rerait.telangana.gov.in/GIS) loads every registered
 *    project with its registration number, name, locality, survey numbers and site coordinates
 *    from one JSON endpoint. No captcha, one request.
 * 2. Details: the certificate link on that map opens the project's search result (promoter name and
 *    a "View" link), and the View link opens the full public project page. Two requests per project,
 *    spaced out so we stay a light, polite visitor.
 *
 * We keep project and company facts only. Names, phone numbers and IDs of individuals on those
 * pages are never stored.
 */

const BASE = 'https://rerait.telangana.gov.in';
const FEED_URL = `${BASE}/GIS/getData.ashx?GetMapData=Data`;
const UA =
  process.env.INGEST_USER_AGENT ??
  'Mozilla/5.0 (compatible; hyderabad.properties-verifier/1.0; +https://hyderabad.properties)';
const GAP_MS = Number(process.env.RERA_REQUEST_GAP_MS ?? 1500);
/** Re-read a project page after this many days. Weekly until the site goes public. */
const REFRESH_DAYS = Number(process.env.RERA_REFRESH_DAYS ?? 7);

interface FeedRow {
  Name_of_Project: string | null;
  PlotBearing: string | null;
  locality: string | null;
  street: string | null;
  Project_Village: string | null;
  Project_Taluka: string | null;
  Project_District: string | null;
  PinCode: string | null;
  'Registration No.': string | null;
  Application_No: string | null;
  lat: number | null;
  lng: number | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CA = [...rootCertificates, EMSIGN_SSL_CA_G1];

/** HTTPS GET with the portal's missing intermediate certificate supplied. Follows redirects. */
export function getBuffer(url: string, referer?: string, redirects = 3): Promise<{ body: Buffer; type: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        ca: CA,
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          ...(referer ? { referer } : {}),
        },
        timeout: 30_000,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
          res.resume();
          resolve(getBuffer(new URL(res.headers.location, url).toString(), referer, redirects - 1));
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`${url.split('?')[0]} responded ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ body: Buffer.concat(chunks), type: String(res.headers['content-type'] ?? '') }));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error(`${url.split('?')[0]} timed out`)));
    req.on('error', reject);
    req.end();
  });
}

export async function get(url: string, referer?: string): Promise<string> {
  return (await getBuffer(url, referer)).body.toString('utf8');
}

function clean(s: string | null | undefined): string | null {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t && t.toLowerCase() !== 'null' && t !== 'NA' ? t : null;
}

/** "MYSCAPE-ISLE OF SKY" -> "Myscape-Isle Of Sky" (portal data is often all caps). */
export function tidyName(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s\-(/&.])([a-z])/g, (_, p, c) => p + c.toUpperCase());
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

export function registrySlug(name: string, locality: string | null, regNo: string): string {
  return [slugify(name), locality ? slugify(locality).split('-').slice(0, 3).join('-') : '', regNo.toLowerCase()]
    .filter(Boolean)
    .join('-');
}

// ---------------------------------------------------------------------------
// Step 1: the feed
// ---------------------------------------------------------------------------

export interface FeedResult {
  total: number;
  added: number;
  updated: number;
}

export async function syncRegistryFeed(db: DB): Promise<FeedResult> {
  const raw = await get(FEED_URL, `${BASE}/GIS/default.aspx`);
  let rows: FeedRow[] = JSON.parse(raw);
  if (typeof rows === 'string') rows = JSON.parse(rows);
  if (!Array.isArray(rows) || rows.length < 100) throw new Error(`RERA map feed returned ${Array.isArray(rows) ? rows.length : 'no'} rows`);

  const existing = new Set((await db.select({ r: reraRegistry.registrationNo }).from(reraRegistry)).map((x) => x.r));
  const now = new Date();
  const values = new Map<string, typeof reraRegistry.$inferInsert>();

  for (const r of rows) {
    const regNo = clean(r['Registration No.']);
    const rawName = clean(r.Name_of_Project);
    if (!regNo || !rawName) continue;
    const name = tidyName(rawName);
    const locality = clean(r.locality) ? tidyName(clean(r.locality)!) : null;
    values.set(regNo, {
      registrationNo: regNo,
      slug: registrySlug(name, locality, regNo),
      applicationNo: clean(r.Application_No),
      name,
      locality,
      street: clean(r.street) ? tidyName(clean(r.street)!) : null,
      village: clean(r.Project_Village),
      mandal: clean(r.Project_Taluka),
      district: clean(r.Project_District),
      pinCode: clean(r.PinCode),
      surveyNumbers: clean(r.PlotBearing),
      lat: r.lat ? Number(r.lat) : null,
      lng: r.lng ? Number(r.lng) : null,
      lastSeenAt: now,
    });
  }

  // Batched upsert: a few round trips instead of one per project. The slug is kept once set.
  const all = [...values.values()];
  for (let i = 0; i < all.length; i += 200) {
    await db
      .insert(reraRegistry)
      .values(all.slice(i, i + 200))
      .onConflictDoUpdate({
        target: reraRegistry.registrationNo,
        set: {
          applicationNo: sql`excluded.application_no`,
          name: sql`excluded.name`,
          locality: sql`excluded.locality`,
          street: sql`excluded.street`,
          village: sql`excluded.village`,
          mandal: sql`excluded.mandal`,
          district: sql`excluded.district`,
          pinCode: sql`excluded.pin_code`,
          surveyNumbers: sql`excluded.survey_numbers`,
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
          lastSeenAt: sql`excluded.last_seen_at`,
        },
      });
  }
  const added = all.filter((v) => !existing.has(v.registrationNo)).length;
  const updated = all.length - added;
  return { total: rows.length, added, updated };
}

// ---------------------------------------------------------------------------
// Step 2: the project page
// ---------------------------------------------------------------------------

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Page text as a list of cells, in reading order. */
function tokens(html: string): string[] {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, '\u0001')
  )
    .split('\u0001')
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

interface Table {
  header: string[];
  rows: string[][];
}

function cellText(s: string): string {
  return decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Every <table>…</table>, nesting-aware, with nested tables removed from its body. */
function allTables(html: string): string[] {
  const out: string[] = [];
  const re = /<\/?table\b[^>]*>/gi;
  const stack: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0][1] !== '/') stack.push(m.index);
    else if (stack.length) {
      const start = stack.pop()!;
      out.push(html.slice(start, m.index + m[0].length));
    }
  }
  // Remove nested tables (they are listed on their own) so rows stay with their own table.
  return out.map((t) => {
    const inner = t.slice(t.indexOf('>') + 1, t.lastIndexOf('<'));
    let flat = inner;
    for (let guard = 0; guard < 50 && /<table\b/i.test(flat); guard++) {
      flat = flat.replace(/<table\b(?:(?!<table\b)[\s\S])*?<\/table>/gi, ' ');
    }
    return flat;
  });
}

/** Tables whose header row contains `headerCell`, with empty cells kept so columns stay aligned. */
function tablesWith(html: string, headerCell: string): Table[] {
  const out: Table[] = [];
  for (const body of allTables(html)) {
    if (!body.includes(headerCell)) continue;
    const rows = [...body.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) =>
      [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => cellText(c[1]))
    );
    const h = rows.findIndex((r) => r.includes(headerCell));
    if (h < 0) continue;
    out.push({ header: rows[h], rows: rows.slice(h + 1).filter((r) => r.length >= rows[h].length - 1) });
  }
  return out;
}

function col(header: string[], name: string): number {
  return header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
}

function isoDate(s: string | null | undefined): string | null {
  const m = s?.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function num(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Value cell after a label, or null when the next cell is another label (empty field). */
function after(t: string[], label: string | RegExp, from = 0, labels: Set<string> = LABELS): string | null {
  for (let i = from; i < t.length - 1; i++) {
    const hit = typeof label === 'string' ? t[i].toLowerCase() === label.toLowerCase() : label.test(t[i]);
    if (hit) {
      const v = t[i + 1];
      return labels.has(v.toLowerCase()) || v.endsWith(':') ? null : v;
    }
  }
  return null;
}

const LABELS = new Set(
  [
    'Authority Name', 'Plan Approval Number', 'Project Name', 'Project Status', 'Approved Date',
    'Proposed Date of Completion', 'Revised Proposed Date of Completion', 'Litigations related to the project ?',
    'Project Type', 'Website URL', 'Bank Details', 'Land Details', 'Sy.No/TS No.', 'Plot No./House No.',
    'Total Area(In sqmts)', 'Area affected in Road widening/FTL of Tanks/Nala Widening(In sqmts)',
    'Net Area(In sqmts)', 'Total Building Units (as per approved plan)', 'Proposed Building Units(as per agreement)',
    'Built-Up Area Details', 'Approved Built up Area (In Sqmts)', 'Mortgage Area (In Sqmts)', 'Address Details',
    'Are there any Promoter(Land Owner/ Investor) (as defined by Telangana RERA Order) in the project ?',
    'Is the project an MSB or a High-Rise?', 'Past Experience Details', 'Member Information', 'Information Type',
  ].map((l) => l.toLowerCase())
);

export function parseProjectPage(html: string): Omit<ReraDetails, 'hasExtension' | 'lastModified'> {
  const t = tokens(html);
  const pi = Math.max(0, t.findIndex((x) => x === 'Project Information'));

  // Flats: every table with a "Number of Booked Apartment" column
  let totalUnits = 0;
  let bookedUnits = 0;
  const unitTypes = new Set<string>();
  for (const tbl of tablesWith(html, 'Number of Booked Apartment')) {
    const cType = col(tbl.header, 'Apartment Type');
    const cCount = col(tbl.header, 'Number of Apartment');
    const cBooked = col(tbl.header, 'Number of Booked Apartment');
    for (const r of tbl.rows) {
      const n = num(r[cCount]);
      if (n == null) continue;
      // Clubhouse and amenity rows are not homes.
      if (/AMENIT|CLUB|COMMON|UTILITY|SOCIETY/i.test(r[cType] ?? '')) continue;
      totalUnits += n;
      bookedUnits += num(r[cBooked]) ?? 0;
      const type = (r[cType] ?? '')
        .toUpperCase()
        .replace(/BED\s*ROOMS?/g, 'BHK')
        .replace(/(\d(?:\.5)?)\s*BHK/g, '$1 BHK')
        .replace(/\s+/g, ' ')
        .trim();
      if (type && type !== 'BHK') unitTypes.add(type);
    }
  }

  // Buildings: tables with a "Number of Slab of Super Structure" column
  let buildings = 0;
  let maxSlabs = 0;
  let basements = 0;
  for (const tbl of tablesWith(html, 'Number of Slab of Super Structure')) {
    const cSlabs = col(tbl.header, 'Number of Slab of Super Structure');
    const cBase = col(tbl.header, "Number of Basement's");
    for (const r of tbl.rows) {
      const slabs = num(r[cSlabs]);
      if (slabs == null && !r[cBase]) continue;
      buildings++;
      if (slabs != null && slabs <= 150) maxSlabs = Math.max(maxSlabs, slabs);
      basements = Math.max(basements, num(r[cBase]) ?? 0);
    }
  }

  // Construction progress: "Percentage of Work" tables, rows of [sr, task, percent]
  const work: number[] = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === 'Percentage of Work') {
      for (let j = i + 1; j + 2 < t.length && /^\d+$/.test(t[j]) && /^\d{1,3}(\.\d+)?$/.test(t[j + 2]); j += 3) {
        work.push(Number(t[j + 2]));
      }
    }
  }

  const website = after(t, 'Website URL');
  const infoType = after(t, 'Information Type');
  return {
    promoterType: infoType ? (/^individual$/i.test(infoType) ? 'Individual' : 'Organisation') : null,
    promoterWebsite: website && /\./.test(website) ? website : null,
    authority: after(t, 'Authority Name', pi),
    planApprovalNo: after(t, 'Plan Approval Number', pi),
    projectStatus: after(t, 'Project Status', pi),
    projectType: after(t, 'Project Type', pi),
    approvedDate: isoDate(after(t, 'Approved Date', pi)),
    proposedCompletion: isoDate(after(t, 'Proposed Date of Completion', pi)),
    revisedCompletion: isoDate(after(t, 'Revised Proposed Date of Completion', pi)),
    litigation: after(t, 'Litigations related to the project ?', pi),
    landAreaSqm: num(after(t, 'Total Area(In sqmts)', pi)),
    affectedAreaSqm: num(after(t, 'Area affected in Road widening/FTL of Tanks/Nala Widening(In sqmts)', pi)),
    netAreaSqm: num(after(t, 'Net Area(In sqmts)', pi)),
    builtUpAreaSqm: num(after(t, 'Approved Built up Area (In Sqmts)', pi)),
    buildings: buildings || null,
    maxSlabs: maxSlabs || null,
    basements: buildings ? basements : null,
    totalUnits: totalUnits || null,
    bookedUnits: totalUnits ? bookedUnits : null,
    unitTypes: [...unitTypes].sort(),
    workDonePercent: work.length ? Math.round(work.reduce((a, b) => a + b, 0) / work.length) : null,
  };
}

interface SearchHit {
  promoter: string | null;
  detailUrl: string | null;
  lastModified: string | null;
  hasExtension: boolean;
}

/** The certificate search result: promoter, the View link, last-modified date, extension certificate. */
export function parseSearchResult(html: string): SearchHit {
  const row = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  const view = row.match(/href='(\/PrintPreview\/PrintPreview\?q=[^']+)'/i)?.[1];
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
  // [sr, project, promoter, View, last modified, certificate, extension, special extension, ...]
  return {
    promoter: clean(cells[2]),
    detailUrl: view ? BASE + view : null,
    lastModified: isoDate(cells[4]),
    hasExtension: /showFile|Certificate/i.test(row.split(/<td/i)[7] ?? '') && !/^NA$/.test(cells[6] ?? 'NA'),
  };
}

const TRACKED: (keyof ReraDetails)[] = [
  'projectStatus', 'revisedCompletion', 'litigation', 'hasExtension', 'planApprovalNo', 'affectedAreaSqm', 'bookedUnits',
];

async function enrichOne(db: DB, row: ReraRegistryRow): Promise<'updated' | 'unchanged' | string> {
  try {
    let detailUrl = row.detailUrl;
    let hit: SearchHit | null = null;
    if (row.applicationNo) {
      const searchHtml = await get(`${BASE}/SearchList/Search?CertficateNo=${encodeURIComponent(row.applicationNo)}`, `${BASE}/GIS/default.aspx`);
      hit = parseSearchResult(searchHtml);
      detailUrl = hit.detailUrl ?? detailUrl;
      await sleep(GAP_MS);
    }
    if (!detailUrl) throw new Error('No project page link on the RERA search result');

    const html = await get(detailUrl, `${BASE}/SearchList/Search`);
    const parsed = parseProjectPage(html);
    if (!parsed.projectStatus && !parsed.authority && !parsed.landAreaSqm) throw new Error('Project page did not contain project information');
    await saveDocumentList(db, row.registrationNo, parseDocumentList(html));
    const details: ReraDetails = { ...parsed, hasExtension: hit?.hasExtension ?? row.details?.hasExtension ?? false, lastModified: hit?.lastModified ?? row.details?.lastModified ?? null };
    // Individuals are not named on our pages: keep company promoters only.
    const promoterName = details.promoterType === 'Individual' ? null : hit?.promoter ? tidyName(hit.promoter) : row.promoter;
    if (details.promoterType === 'Individual') details.promoterWebsite = null;
    const hash = sha256(JSON.stringify(details) + (promoterName ?? ''));

    const changes: ReraChange[] = [...(row.changes ?? [])];
    if (row.details) {
      const at = new Date().toISOString();
      for (const f of TRACKED) {
        const a = row.details[f] ?? null;
        const b = details[f] ?? null;
        if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ at, field: f, from: a, to: b });
      }
      if (promoterName && row.promoter && promoterName !== row.promoter) changes.push({ at, field: 'promoter', from: row.promoter, to: promoterName });
    }

    await db
      .update(reraRegistry)
      .set({
        promoter: promoterName,
        detailUrl,
        details,
        detailHash: hash,
        detailFetchedAt: new Date(),
        detailError: null,
        changes: changes.slice(-50),
      })
      .where(eq(reraRegistry.registrationNo, row.registrationNo));
    return hash === row.detailHash ? 'unchanged' : 'updated';
  } catch (err) {
    await db
      .update(reraRegistry)
      // Retry a failed page after one day rather than waiting for the weekly refresh.
      .set({ detailError: String((err as Error).message ?? err).slice(0, 300), detailFetchedAt: new Date(Date.now() - (REFRESH_DAYS - 1) * 86_400_000) })
      .where(eq(reraRegistry.registrationNo, row.registrationNo));
    return `error: ${String((err as Error).message ?? err).slice(0, 160)}`;
  }
}

export interface DetailsResult {
  processed: number;
  updated: number;
  unchanged: number;
  errors: number;
  remaining: number;
  sampleErrors: string[];
}

/**
 * Read project pages that were never read or are older than REFRESH_DAYS, oldest first,
 * until the time budget runs out. Call repeatedly until `remaining` is 0.
 */
export async function syncRegistryDetails(db: DB, opts: { budgetMs?: number; limit?: number } = {}): Promise<DetailsResult> {
  const budget = opts.budgetMs ?? 45_000;
  const started = Date.now();
  const stale = new Date(Date.now() - REFRESH_DAYS * 86_400_000);
  // Projects with no certificate number in the feed have no reachable page; they keep the feed facts only.
  const due = and(
    or(isNotNull(reraRegistry.applicationNo), isNotNull(reraRegistry.detailUrl)),
    or(isNull(reraRegistry.detailFetchedAt), lt(reraRegistry.detailFetchedAt, stale))
  );

  const queue = await db
    .select()
    .from(reraRegistry)
    .where(due)
    .orderBy(sql`${reraRegistry.detailFetchedAt} asc nulls first`, asc(reraRegistry.registrationNo))
    .limit(opts.limit ?? 60);

  const out: DetailsResult = { processed: 0, updated: 0, unchanged: 0, errors: 0, remaining: 0, sampleErrors: [] };
  for (const row of queue) {
    if (Date.now() - started > budget - 8_000) break;
    const r = await enrichOne(db, row);
    out.processed++;
    if (r === 'updated' || r === 'unchanged') out[r]++;
    else {
      out.errors++;
      if (out.sampleErrors.length < 5) out.sampleErrors.push(`${row.registrationNo} ${r.slice(7)}`);
    }
    await sleep(GAP_MS);
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(reraRegistry).where(due);
  out.remaining = n;
  return out;
}
