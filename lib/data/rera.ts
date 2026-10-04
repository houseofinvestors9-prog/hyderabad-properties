import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { reraOrders, reraRegistry, type ReraOrderRow, type ReraRegistryRow } from '../db/schema';

export interface RegistryHit {
  slug: string;
  name: string;
  promoter: string | null;
  locality: string | null;
  mandal: string | null;
  district: string | null;
  registrationNo: string;
  projectStatus: string | null;
}

function toHit(r: ReraRegistryRow): RegistryHit {
  return {
    slug: r.slug,
    name: r.name,
    promoter: r.promoter,
    locality: r.locality,
    mandal: r.mandal,
    district: r.district,
    registrationNo: r.registrationNo,
    projectStatus: r.details?.projectStatus ?? null,
  };
}

/** Name, builder, area or RERA number search over every registered project. */
export async function searchRegistry(q: string, limit = 8): Promise<RegistryHit[]> {
  const words = q
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 5);
  if (!words.length) return [];
  const db = await getDb();
  const haystack = sql`lower(coalesce(${reraRegistry.name},'') || ' ' || coalesce(${reraRegistry.promoter},'') || ' ' || coalesce(${reraRegistry.locality},'') || ' ' || coalesce(${reraRegistry.village},'') || ' ' || coalesce(${reraRegistry.mandal},'') || ' ' || lower(${reraRegistry.registrationNo}))`;
  const rows = await db
    .select()
    .from(reraRegistry)
    .where(and(...words.map((w) => sql`${haystack} like ${'%' + w + '%'}`)))
    .orderBy(
      // Name matches first, then projects whose page we have read
      sql`case when lower(${reraRegistry.name}) like ${'%' + words[0] + '%'} then 0 else 1 end`,
      sql`case when ${reraRegistry.details} is null then 1 else 0 end`,
      asc(reraRegistry.name)
    )
    .limit(limit);
  return rows.map(toHit);
}

export async function getRegistryBySlug(slug: string): Promise<ReraRegistryRow | null> {
  const db = await getDb();
  const rows = await db.select().from(reraRegistry).where(eq(reraRegistry.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/** Other registered projects in the same locality or mandal, for "nearby" links. */
export async function nearbyRegistry(row: ReraRegistryRow, limit = 6): Promise<RegistryHit[]> {
  const db = await getDb();
  const area = row.locality ?? row.mandal;
  if (!area) return [];
  const rows = await db
    .select()
    .from(reraRegistry)
    .where(
      and(
        sql`${reraRegistry.registrationNo} <> ${row.registrationNo}`,
        or(ilike(reraRegistry.locality, area), ilike(reraRegistry.mandal, row.mandal ?? area))
      )
    )
    .orderBy(desc(reraRegistry.lastSeenAt), asc(reraRegistry.name))
    .limit(limit);
  return rows.map(toHit);
}

export async function registrySitemapEntries(): Promise<{ slug: string; updated: Date }[]> {
  const db = await getDb();
  const rows = await db
    .select({ slug: reraRegistry.slug, f: reraRegistry.detailFetchedAt, s: reraRegistry.lastSeenAt })
    .from(reraRegistry)
    .where(isNotNull(reraRegistry.slug));
  return rows.map((r) => ({ slug: r.slug, updated: r.f ?? r.s }));
}

export async function registryStats() {
  const db = await getDb();
  const [s] = await db
    .select({
      total: sql<number>`count(*)::int`,
      read: sql<number>`count(${reraRegistry.details})::int`,
      errors: sql<number>`count(*) filter (where ${reraRegistry.detailError} is not null)::int`,
      lastFeed: sql<string | null>`max(${reraRegistry.lastSeenAt})`,
      lastRead: sql<string | null>`max(${reraRegistry.detailFetchedAt}) filter (where ${reraRegistry.detailError} is null)`,
    })
    .from(reraRegistry);
  return s;
}

const PAGE_SIZE = 60;

/** Paged list for /rera, filtered by district and/or a search. */
export async function listRegistry(opts: { district?: string; q?: string; page?: number }) {
  const db = await getDb();
  const page = Math.max(1, opts.page ?? 1);
  if (opts.q && opts.q.trim().length >= 2) {
    const results = await searchRegistry(opts.q, PAGE_SIZE);
    return { rows: results, total: results.length, page: 1, pages: 1 };
  }
  const where = opts.district ? eq(reraRegistry.district, opts.district) : undefined;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(reraRegistry).where(where);
  const rows = await db
    .select()
    .from(reraRegistry)
    .where(where)
    .orderBy(asc(reraRegistry.name))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { rows: rows.map(toHit), total: n, page, pages: Math.max(1, Math.ceil(n / PAGE_SIZE)) };
}

export async function registryDistricts(): Promise<{ district: string; n: number }[]> {
  const db = await getDb();
  const rows = await db
    .select({ district: reraRegistry.district, n: sql<number>`count(*)::int` })
    .from(reraRegistry)
    .where(isNotNull(reraRegistry.district))
    .groupBy(reraRegistry.district)
    .orderBy(desc(sql`count(*)`));
  return rows.map((r) => ({ district: r.district!, n: r.n }));
}

const METRO = ['Ranga Reddy', 'Medchal-Malkajgiri', 'Hyderabad', 'Sangareddy'];

export interface RegistryCard extends RegistryHit {
  approvedDate: string | null;
  completion: string | null;
  totalUnits: number | null;
  authority: string | null;
}

export interface RegistryOverview {
  total: number;
  read: number;
  flagged: number;
  areas: { name: string; n: number }[];
  recent: RegistryCard[];
}

/** Numbers and lists for the home page, from the TG-RERA registry. */
export async function registryOverview(): Promise<RegistryOverview> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const metro = sql`${reraRegistry.district} in (${sql.join(METRO.map((d) => sql`${d}`), sql`, `)})`;
  const due = sql`coalesce(${reraRegistry.details}->>'revisedCompletion', ${reraRegistry.details}->>'proposedCompletion')`;

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      read: sql<number>`count(${reraRegistry.details})::int`,
      flagged: sql<number>`count(*) filter (where (${due} < ${today} and coalesce(${reraRegistry.details}->>'projectStatus','') not ilike '%complet%') or ${reraRegistry.details}->>'litigation' ilike 'yes%')::int`,
    })
    .from(reraRegistry);

  const areas = await db
    .select({ name: reraRegistry.mandal, n: sql<number>`count(*)::int` })
    .from(reraRegistry)
    .where(and(metro, isNotNull(reraRegistry.mandal)))
    .groupBy(reraRegistry.mandal)
    .orderBy(desc(sql`count(*)`))
    .limit(30);

  const recentRows = await db
    .select()
    .from(reraRegistry)
    .where(and(metro, isNotNull(reraRegistry.details), sql`${reraRegistry.details}->>'approvedDate' is not null`))
    .orderBy(desc(sql`${reraRegistry.details}->>'approvedDate'`))
    .limit(6);

  return {
    ...counts,
    areas: areas.filter((a) => a.name).map((a) => ({ name: a.name!, n: a.n })),
    recent: recentRows.map((r) => ({
      ...toHit(r),
      approvedDate: r.details?.approvedDate ?? null,
      completion: r.details?.revisedCompletion ?? r.details?.proposedCompletion ?? null,
      totalUnits: r.details?.totalUnits ?? null,
      authority: r.details?.authority ?? null,
    })),
  };
}

export interface OrderView {
  id: string;
  kind: ReraOrderRow['kind'];
  title: string;
  respondent: string | null;
  orderDate: string | null;
  pdfUrl: string;
  caseNo: string | null;
  penaltyInr: number | null;
  penaltiesInr: number[];
  registrationNos: string[];
}

function toOrder(o: ReraOrderRow): OrderView {
  // Orders against individuals keep a neutral title; the person's name is not repeated here.
  const title = o.respondent || o.kind === 'notice' || o.kind === 'rejection' || /case no/i.test(o.title) ? o.title : `${o.kind === 'penalty' ? 'Penalty' : 'Suo motu'} order against an individual promoter`;
  return { id: o.id, kind: o.kind, title, respondent: o.respondent, orderDate: o.orderDate, pdfUrl: o.pdfUrl, caseNo: o.caseNo, penaltyInr: o.penaltyInr, penaltiesInr: o.penaltiesInr, registrationNos: o.registrationNos };
}

/** Orders that cite this project's registration number. Nothing is attached by builder or by name. */
export async function ordersForRegistry(row: ReraRegistryRow): Promise<OrderView[]> {
  const db = await getDb();
  const all = await db.select().from(reraOrders).orderBy(desc(reraOrders.orderDate));
  return all.filter((o) => o.registrationNos.includes(row.registrationNo)).map(toOrder);
}

export async function listOrders(): Promise<(OrderView & { projects: RegistryHit[] })[]> {
  const db = await getDb();
  const all = await db.select().from(reraOrders).orderBy(desc(reraOrders.orderDate));
  const regNos = [...new Set(all.flatMap((o) => o.registrationNos))];
  const rows = regNos.length ? await db.select().from(reraRegistry).where(inArray(reraRegistry.registrationNo, regNos)) : [];
  const byNo = new Map(rows.map((r) => [r.registrationNo, toHit(r)]));
  return all.map((o) => ({ ...toOrder(o), projects: o.registrationNos.map((n) => byNo.get(n)).filter((x): x is RegistryHit => !!x) }));
}

/** "Penalty ₹10,77,520" or "Penalties ₹12,70,400 and ₹8,46,960", as the order states them. */
export function penaltyLabel(o: Pick<OrderView, 'penaltyInr' | 'penaltiesInr'>): string | null {
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  if (o.penaltyInr) return `Penalty ${inr(o.penaltyInr)}`;
  if (o.penaltiesInr.length > 1) return `Penalties ${o.penaltiesInr.slice(0, -1).map(inr).join(', ')} and ${inr(o.penaltiesInr[o.penaltiesInr.length - 1])} under separate sections`;
  return null;
}
