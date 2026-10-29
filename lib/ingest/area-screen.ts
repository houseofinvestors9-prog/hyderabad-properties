import { eq, isNotNull, sql } from 'drizzle-orm';
import type { DB } from '../db/client';
import { hmdaLakes, igrRates, igrVillages, reraRegistry, type GuidelineMatch, type LakeScreen, type ReraRegistryRow } from '../db/schema';
import { hmdaPdfUrl, publicLakeId } from './hmda-lakes';
import { igrDistrict, looseMatch, normPlace } from './igr-rates';
import { tileOf, waterNear, waterTilesFetched } from './water';

/**
 * Joins each registered project to the area data we hold:
 *   - lake screen: nearest mapped water (OpenStreetMap), notified HMDA lakes in the same village, and
 *     whether HMDA lists one of the project's survey numbers inside a lake's FTL or buffer zone;
 *   - guideline value: the government unit rate for the project's village.
 * Both are automated first passes, labelled as such on the page. A person checks before a report says more.
 */

// ---------------------------------------------------------------------------
// Survey numbers
// ---------------------------------------------------------------------------

export interface SurveyNo {
  base: string; // leading number, e.g. "340"
  sub: string[]; // sub-divisions, e.g. ["2"] for 340/2
  raw: string;
}

/** "340/2(OLD 340/3)", "37 TO 40", "52,53 & 57", "SY NO. 625", "24A/1/1" -> survey numbers. */
export function parseSurveyNumbers(text: string | null | undefined): SurveyNo[] {
  if (!text) return [];
  const cleaned = text
    .toUpperCase()
    .replace(/\(OLD[^)]*\)/g, ' ')
    .replace(/S(UR)?V?E?Y?\.?\s*NOS?\.?/g, ' ')
    .replace(/\bPART\b|\bP\b(?![/\d])/g, ' ');
  const out: SurveyNo[] = [];
  const range = /(\d+)\s*(?:TO|-)\s*(\d+)\b/g;
  let rest = cleaned;
  for (const m of cleaned.matchAll(range)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b > a && b - a <= 40) {
      for (let n = a; n <= b; n++) out.push({ base: String(n), sub: [], raw: String(n) });
      rest = rest.replace(m[0], ' ');
    }
  }
  for (const tok of rest.split(/[,&;\s]+|\bAND\b/)) {
    const m = tok.match(/^(\d+)([A-Z]{0,2})((?:\/[A-Z0-9]+)*)/);
    if (!m) continue;
    const sub = [m[2], ...m[3].split('/').filter(Boolean)].filter(Boolean);
    out.push({ base: m[1], sub, raw: tok });
  }
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = `${s.base}/${s.sub.join('/')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Same base number, and sub-divisions agree as far as both go (340 matches 340/2; 340/2 does not match 340/3). */
export function surveyOverlap(a: SurveyNo, b: SurveyNo): boolean {
  if (a.base !== b.base) return false;
  const n = Math.min(a.sub.length, b.sub.length);
  for (let i = 0; i < n; i++) if (a.sub[i] !== b.sub[i]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Screening
// ---------------------------------------------------------------------------

type RatesRow = typeof igrRates.$inferSelect;

function summariseRates(rows: RatesRow[], village: typeof igrVillages.$inferSelect, matchedBy: GuidelineMatch['matchedBy']): GuidelineMatch | null {
  const apt = rows.map((r) => r.aptOtherPerSqFt).filter((n): n is number => !!n);
  const land = rows.map((r) => r.landPerSqYd).filter((n): n is number => !!n);
  if (apt.length === 0 && land.length === 0) return null;
  const residential = rows.filter((r) => (r.classification ?? '').startsWith('01'));
  const restAll = rows.find((r) => /REST\s*ALL/i.test(r.locality));
  const baseRow = restAll ?? residential.sort((a, b) => (a.aptOtherPerSqFt ?? 0) - (b.aptOtherPerSqFt ?? 0))[0];
  const dates = rows.map((r) => r.effectiveDate).filter((d): d is string => !!d).sort();
  return {
    village: village.districtCode === '16_1' ? village.mandalName : village.villageName,
    mandal: village.districtCode === '16_1' ? '' : village.mandalName,
    district: village.districtName,
    effectiveDate: dates[dates.length - 1] ?? null,
    baseAptPerSqFt: baseRow?.aptOtherPerSqFt ?? null,
    minAptPerSqFt: apt.length ? Math.min(...apt) : null,
    maxAptPerSqFt: apt.length ? Math.max(...apt) : null,
    minLandPerSqYd: land.length ? Math.min(...land) : null,
    maxLandPerSqYd: land.length ? Math.max(...land) : null,
    rows: rows.length,
    matchedBy,
  };
}

interface Context {
  villagesByDistrict: Map<string, (typeof igrVillages.$inferSelect)[]>;
  ratesByVillage: Map<string, RatesRow[]>;
  lakesByVillage: Map<string, (typeof hmdaLakes.$inferSelect)[]>;
  tiles: Set<string>;
}

async function loadContext(db: DB): Promise<Context> {
  const villages = await db.select().from(igrVillages).where(isNotNull(igrVillages.fetchedAt));
  const villagesByDistrict = new Map<string, (typeof igrVillages.$inferSelect)[]>();
  for (const v of villages) villagesByDistrict.set(v.districtCode, [...(villagesByDistrict.get(v.districtCode) ?? []), v]);
  const ratesByVillage = new Map<string, RatesRow[]>();
  for (const r of await db.select().from(igrRates)) ratesByVillage.set(r.villageId, [...(ratesByVillage.get(r.villageId) ?? []), r]);
  const lakesByVillage = new Map<string, (typeof hmdaLakes.$inferSelect)[]>();
  for (const l of await db.select().from(hmdaLakes)) {
    const k = normPlace(l.village);
    if (k) lakesByVillage.set(k, [...(lakesByVillage.get(k) ?? []), l]);
  }
  return { villagesByDistrict, ratesByVillage, lakesByVillage, tiles: await waterTilesFetched(db) };
}

function guidelineFor(r: ReraRegistryRow, ctx: Context): GuidelineMatch | null {
  const d = igrDistrict(r.district);
  if (!d) return null;
  const pool = ctx.villagesByDistrict.get(d.code) ?? [];
  if (d.code === '16_1') {
    const words = (r.locality ?? '').toUpperCase().split(/[^A-Z]+/).filter((w) => w.length >= 4);
    const hits = pool.filter((v) => words.includes(v.mandalName));
    if (hits.length === 0) return null;
    const rows = hits.flatMap((v) => ctx.ratesByVillage.get(v.id) ?? []);
    return summariseRates(rows, hits[0], 'locality');
  }
  const inMandal = pool.filter((v) => !r.mandal || looseMatch(v.mandalName, r.mandal));
  for (const [name, by] of [
    [r.village, 'village'],
    [r.locality, 'locality'],
  ] as const) {
    if (!name) continue;
    const v = inMandal.find((x) => normPlace(x.villageName) === normPlace(name)) ?? inMandal.find((x) => looseMatch(x.villageName, name));
    if (v) {
      const s = summariseRates(ctx.ratesByVillage.get(v.id) ?? [], v, by);
      if (s) return s;
    }
  }
  return null;
}

async function lakeScreenFor(db: DB, r: ReraRegistryRow, ctx: Context): Promise<LakeScreen> {
  const villageKeys = [normPlace(r.village), normPlace(r.locality)].filter(Boolean);
  const lakes = [...new Map(villageKeys.flatMap((k) => ctx.lakesByVillage.get(k) ?? []).map((l) => [l.lakeId, l])).values()].filter(
    (l) => !r.mandal || !l.mandal || looseMatch(l.mandal, r.mandal)
  );
  const projectSurvey = parseSurveyNumbers(r.surveyNumbers);
  const surveyMatches: LakeScreen['surveyMatches'] = [];
  for (const l of lakes) {
    const listed = (l.surveyNumbers ?? []).map((s) => ({ ...s, parsed: parseSurveyNumbers(s.number)[0] })).filter((s) => s.parsed);
    const hits = listed.filter((s) => projectSurvey.some((p) => surveyOverlap(p, s.parsed!)));
    if (hits.length)
      surveyMatches.push({
        lakeId: publicLakeId(l.lakeId),
        lakeName: l.name,
        surveyNumbers: hits.map((h) => h.number),
        zone: hits.some((h) => h.zone === 'ftl' || h.zone === 'both') ? 'ftl' : hits.some((h) => h.zone === 'buffer') ? 'buffer' : null,
        pdf: hmdaPdfUrl(l.surveyPdf),
      });
  }

  let nearest: LakeScreen['nearest'] = null;
  let nearby: LakeScreen['nearby'] = [];
  const haveTile = r.lat != null && r.lng != null && ctx.tiles.has(tileOf(r.lat, r.lng));
  if (haveTile) {
    const near = await waterNear(db, r.lat!, r.lng!, 1000);
    if (near[0]) nearest = { name: near[0].name, kind: near[0].kind, distanceM: near[0].distanceM, osmId: near[0].id };
    nearby = near.filter((n) => n.distanceM <= 500).slice(0, 3).map((n) => ({ name: n.name, distanceM: n.distanceM }));
  }

  const level: LakeScreen['level'] = surveyMatches.length
    ? 'survey_listed'
    : !haveTile
      ? 'unknown'
      : nearest && nearest.distanceM <= 50
        ? 'very_close'
        : nearest && nearest.distanceM <= 200
          ? 'nearby'
          : 'clear';

  return {
    checkedAt: new Date().toISOString(),
    level,
    nearest,
    nearby,
    surveyMatches,
    villageLakes: lakes.slice(0, 8).map((l) => ({ lakeId: publicLakeId(l.lakeId), lakeName: l.name, ftlPdf: hmdaPdfUrl(l.ftlPdf) })),
  };
}

export interface ScreenResult {
  processed: number;
  withGuideline: number;
  lakeLevels: Record<string, number>;
  remaining: number;
}

/** Re-screen registered projects not screened today, within a time budget. */
export async function screenRegistry(db: DB, opts: { budgetMs?: number; force?: boolean } = {}): Promise<ScreenResult> {
  const budgetMs = opts.budgetMs ?? 45_000;
  const started = Date.now();
  const ctx = await loadContext(db);
  const today = new Date().toISOString().slice(0, 10);
  const due = await db
    .select()
    .from(reraRegistry)
    .where(opts.force ? sql`true` : sql`coalesce(${reraRegistry.lakeScreen}->>'checkedAt', '') < ${today}`);
  const result: ScreenResult = { processed: 0, withGuideline: 0, lakeLevels: {}, remaining: due.length };
  for (const r of due) {
    if (Date.now() - started > budgetMs) break;
    const guideline = guidelineFor(r, ctx);
    const lakeScreen = await lakeScreenFor(db, r, ctx);
    await db.update(reraRegistry).set({ guideline, lakeScreen }).where(eq(reraRegistry.registrationNo, r.registrationNo));
    result.processed++;
    if (guideline) result.withGuideline++;
    result.lakeLevels[lakeScreen.level] = (result.lakeLevels[lakeScreen.level] ?? 0) + 1;
  }
  result.remaining = due.length - result.processed;
  return result;
}

/** Villages (normalised) that hold at least one registered project, for limiting survey-list reading. */
export async function registryVillages(db: DB): Promise<string[]> {
  const rows = await db.select({ village: reraRegistry.village, locality: reraRegistry.locality }).from(reraRegistry);
  return [...new Set(rows.flatMap((r) => [normPlace(r.village), normPlace(r.locality)]).filter(Boolean))];
}

