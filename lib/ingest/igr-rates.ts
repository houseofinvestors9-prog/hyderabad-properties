import { and, asc, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { DB } from '../db/client';
import { igrRates, igrVillages, ingestState, reraRegistry } from '../db/schema';

/**
 * Government guideline values ("unit rates") from Telangana Registration & Stamps:
 * registration.telangana.gov.in/UnitRateMV. Stamp duty is charged on the higher of the agreement
 * value and this rate, so it is the floor of every buyer's true cost.
 *
 * The public search is plain lookups (district -> mandal -> village -> rates, no captcha). Hyderabad
 * district has no villages; it is searched by locality name instead. We read:
 *   - every village of the HMDA-core districts (Rangareddy, Medchal-Malkajgiri, Sangareddy),
 *   - for other districts, only the mandals where a registered project sits,
 *   - for Hyderabad district, the localities matching each registered project's locality.
 * Rates are re-read every 90 days; the current table took effect on 5 June 2026.
 */

const BASE = 'https://registration.telangana.gov.in/UnitRateMV';
const UA =
  process.env.INGEST_USER_AGENT ??
  'Mozilla/5.0 (compatible; hyderabad.properties-verifier/1.0; +https://hyderabad.properties)';
const GAP_MS = Number(process.env.IGR_REQUEST_GAP_MS ?? 1500);
const REFRESH_DAYS = 90;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** IGRS district codes, keyed by our normalised district name (RERA spellings included). */
const DISTRICTS: Record<string, { code: string; name: string }> = {
  rangareddy: { code: '15_1', name: 'RANGAREDDY' },
  medchalmalkajgiri: { code: '15_2', name: 'MEDCHAL-MALKAJGIRI' },
  vikarabad: { code: '15_3', name: 'VIKARABAD' },
  hyderabad: { code: '16_1', name: 'HYDERABAD' },
  medak: { code: '17_1', name: 'MEDAK' },
  sangareddy: { code: '17_2', name: 'SANGAREDDY' },
  siddipet: { code: '17_3', name: 'SIDDIPET' },
  nizamabad: { code: '18_1', name: 'NIZAMABAD' },
  kamareddy: { code: '18_2', name: 'KAMAREDDY' },
  adilabad: { code: '19_1', name: 'ADILABAD' },
  nirmal: { code: '19_2', name: 'NIRMAL' },
  mancherial: { code: '19_3', name: 'MANCHERIAL' },
  karimnagar: { code: '20_1', name: 'KARIMNAGAR' },
  jagtial: { code: '20_2', name: 'JAGTIAL' },
  rajannasircilla: { code: '20_3', name: 'RAJANNA SIRCILLA' },
  peddapalli: { code: '20_4', name: 'PEDDAPALLI' },
  hanumakonda: { code: '21_1', name: 'HANUMAKONDA' },
  warangalurban: { code: '21_1', name: 'HANUMAKONDA' },
  warangal: { code: '21_2', name: 'WARANGAL' },
  warangalrural: { code: '21_2', name: 'WARANGAL' },
  jangoan: { code: '21_3', name: 'JANGOAN' },
  jangaon: { code: '21_3', name: 'JANGOAN' },
  khammam: { code: '22_1', name: 'KHAMMAM' },
  bhadradrikothagudem: { code: '22_2', name: 'BHADRADRI KOTHAGUDEM' },
  nalgonda: { code: '23_1', name: 'NALGONDA' },
  suryapet: { code: '23_2', name: 'SURYAPET' },
  yadadribhuvanagiri: { code: '23_3', name: 'YADADRI BHUVANAGIRI' },
  yadadribhongir: { code: '23_3', name: 'YADADRI BHUVANAGIRI' },
  mahabubnagar: { code: '14_1', name: 'MAHABUBNAGAR' },
  jogulambagadwal: { code: '14_2', name: 'JOGULAMBA GADWAL' },
  nagarkurnool: { code: '14_3', name: 'NAGARKURNOOL' },
  wanaparthy: { code: '14_4', name: 'WANAPARTHY' },
  narayanpet: { code: '14_5', name: 'NARAYANPET' },
};
const FULL_DISTRICTS = new Set(['15_1', '15_2', '17_2']);
const HYDERABAD = '16_1';
const HYD_DIVISIONS = ['1600001', '1600002', '1600003'];

export const normPlace = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function igrDistrict(name: string | null | undefined) {
  return DISTRICTS[normPlace(name)] ?? null;
}

/** Mandal names drift between portals ("Serilingampally" vs "SRILINGAMPALLE"); compare loosely. */
export function looseMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normPlace(a).replace(/[aeiouy]/g, '').replace(/(.)\1+/g, '$1');
  const y = normPlace(b).replace(/[aeiouy]/g, '').replace(/(.)\1+/g, '$1');
  if (!x || !y) return false;
  if (x === y) return true;
  const [s, l] = x.length < y.length ? [x, y] : [y, x];
  return s.length >= 4 && l.startsWith(s);
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${url.split('?')[0]} responded ${res.status}`);
  return res.text();
}

/** "01/ABDULLAPURMET##02/AMANGAL##" -> [["01","ABDULLAPURMET"], ...] */
function pairs(s: string): [string, string][] {
  return s
    .split('##')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf('/');
      return [p.slice(0, i), p.slice(i + 1).trim()] as [string, string];
    })
    .filter(([a, b]) => a && b);
}

export interface VillageListResult {
  units: number;
  done: number;
  villages: number;
  remaining: number;
  sampleErrors: string[];
}

type Unit = { key: string; districtCode: string; districtName: string; kind: 'mandal' | 'hyd'; code: string; name: string };

async function loadState<T>(db: DB, key: string): Promise<T | null> {
  const [row] = await db.select().from(ingestState).where(eq(ingestState.key, key));
  return (row?.value as T) ?? null;
}

async function saveState(db: DB, key: string, value: unknown) {
  await db
    .insert(ingestState)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: ingestState.key, set: { value, updatedAt: new Date() } });
}

/**
 * Build the list of villages (and Hyderabad localities) whose rates we keep. Resumable: each call works
 * for about `budgetMs`, remembers which mandals it has listed, and returns `remaining`. Call until 0.
 */
export async function syncIgrVillageList(db: DB, opts: { budgetMs?: number } = {}): Promise<VillageListResult> {
  const budgetMs = opts.budgetMs ?? 45_000;
  const started = Date.now();
  const over = () => Date.now() - started > budgetMs;
  const cutoff = Date.now() - REFRESH_DAYS * 86_400_000;
  const result: VillageListResult = { units: 0, done: 0, villages: 0, remaining: 0, sampleErrors: [] };

  const reg = await db
    .select({ district: reraRegistry.district, mandal: reraRegistry.mandal, locality: reraRegistry.locality })
    .from(reraRegistry);
  const byDistrict = new Map<string, { mandals: Set<string>; localities: Set<string> }>();
  for (const r of reg) {
    const d = igrDistrict(r.district);
    if (!d) continue;
    const entry = byDistrict.get(d.code) ?? { mandals: new Set<string>(), localities: new Set<string>() };
    if (r.mandal) entry.mandals.add(r.mandal);
    if (r.locality) entry.localities.add(r.locality);
    byDistrict.set(d.code, entry);
  }
  for (const code of FULL_DISTRICTS) if (!byDistrict.has(code)) byDistrict.set(code, { mandals: new Set(), localities: new Set() });

  // Mandal lists per district, cached for the refresh period.
  const lists = (await loadState<Record<string, { at: string; mandals: [string, string][] }>>(db, 'igr_mandal_lists')) ?? {};
  const units: Unit[] = [];
  for (const [code, entry] of byDistrict) {
    const districtName = Object.values(DISTRICTS).find((d) => d.code === code)?.name ?? code;
    if (code === HYDERABAD) {
      const words = new Set<string>();
      for (const l of entry.localities) {
        const w = l
          .toUpperCase()
          .split(/[^A-Z]+/)
          .find((x) => x.length >= 4 && !['ROAD', 'NEAR', 'OPPOSITE', 'COLONY', 'NAGAR'].includes(x));
        if (w) words.add(w);
      }
      for (const w of words) units.push({ key: `${code}|${w}`, districtCode: code, districtName, kind: 'hyd', code: w, name: w });
      continue;
    }
    let cached = lists[code];
    if (!cached || Date.parse(cached.at) < cutoff) {
      if (over()) {
        result.remaining++;
        continue;
      }
      try {
        cached = { at: new Date().toISOString(), mandals: pairs(await getText(`${BASE}/getMandalListByDistCode?districtcode=${code}`)) };
        lists[code] = cached;
      } catch (err) {
        if (result.sampleErrors.length < 5) result.sampleErrors.push(`${districtName}: ${(err as Error).message}`);
        continue;
      }
      await sleep(GAP_MS);
    }
    const keep = FULL_DISTRICTS.has(code) ? cached.mandals : cached.mandals.filter(([, m]) => [...entry.mandals].some((x) => looseMatch(x, m)));
    for (const [mCode, mName] of keep) units.push({ key: `${code}|${mCode}`, districtCode: code, districtName, kind: 'mandal', code: mCode, name: mName });
  }
  await saveState(db, 'igr_mandal_lists', lists);

  const doneAt = (await loadState<Record<string, string>>(db, 'igr_units_done')) ?? {};
  result.units = units.length;
  for (const u of units) {
    if (doneAt[u.key] && Date.parse(doneAt[u.key]) >= cutoff) continue;
    if (over()) {
      result.remaining++;
      continue;
    }
    const rows: (typeof igrVillages.$inferInsert)[] = [];
    try {
      if (u.kind === 'hyd') {
        // Hyderabad has no villages: search localities by the word, in each of its three divisions.
        for (const div of HYD_DIVISIONS) {
          const txt = await getText(`${BASE}/getLocationDetails?codes=${encodeURIComponent(`${u.districtCode}~${u.code}~$~$~${div}`)}`);
          await sleep(GAP_MS);
          if (txt === 'Malicious' || txt === 'Special') continue;
          for (const [locCode, locName] of pairs(txt).slice(0, 25)) {
            rows.push({
              id: `${u.districtCode}|${div}|${locCode}/${locName}`,
              districtCode: u.districtCode,
              districtName: u.districtName,
              mandalCode: div,
              mandalName: u.code, // the search word, used to match projects later
              villageCode: `${locCode}/${locName}`,
              villageName: locName,
            });
          }
        }
      } else {
        const villages = pairs(await getText(`${BASE}/getVillageListByDistCode?districtcode=${u.districtCode}&mandalcode=${u.code}&sType=U`));
        await sleep(GAP_MS);
        for (const [vCode, vName] of villages) {
          rows.push({
            id: `${u.districtCode}|${u.code}|${vCode}`,
            districtCode: u.districtCode,
            districtName: u.districtName,
            mandalCode: u.code,
            mandalName: u.name,
            villageCode: vCode,
            villageName: vName,
          });
        }
      }
      if (rows.length) await db.insert(igrVillages).values(rows).onConflictDoNothing();
      result.villages += rows.length;
      doneAt[u.key] = new Date().toISOString();
      result.done++;
    } catch (err) {
      if (result.sampleErrors.length < 5) result.sampleErrors.push(`${u.districtName} ${u.name}: ${(err as Error).message}`);
      doneAt[u.key] = new Date().toISOString(); // a portal 404 for one mandal should not block the rest
    }
    await saveState(db, 'igr_units_done', doneAt);
  }
  return result;
}

const num = (s: string | undefined) => {
  const n = Number((s ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

function cellText(c: string) {
  return c.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** Parse the rates table. Columns: S.No, Ward-Block, Locality, Land/sq yd, Apt ground, Apt first, Apt other, Class, Effective date. */
export function parseRatesPage(html: string) {
  const out: Omit<typeof igrRates.$inferInsert, 'villageId'>[] = [];
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const c = (row.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(cellText);
    if (c.length < 9 || !/^\d+\.$/.test(c[0])) continue;
    const date = c[8].match(/(\d{2})\/(\d{2})\/(\d{4})/);
    out.push({
      wardBlock: c[1] || null,
      locality: c[2],
      landPerSqYd: num(c[3]),
      aptGroundPerSqFt: num(c[4]),
      aptFirstPerSqFt: num(c[5]),
      aptOtherPerSqFt: num(c[6]),
      classification: c[7] || null,
      effectiveDate: date ? `${date[3]}-${date[2]}-${date[1]}` : null,
    });
  }
  return out;
}

async function fetchRates(v: typeof igrVillages.$inferSelect): Promise<string> {
  const hyd = v.districtCode === HYDERABAD;
  const locName = hyd ? v.villageName : '';
  const fields: Record<string, string> = {
    encodestr: '',
    locName,
    rValue: 'U',
    tFlag: hyd ? 'L' : '',
    mndlName: hyd ? '' : v.mandalName,
    vlgName: hyd ? '' : v.villageName,
    RateType: 'U',
    search_by: 'A',
    districtId: v.districtCode,
    ...(hyd ? { divCode: v.mandalCode, radio1: 'l', locality: v.villageCode } : { mandalCode: v.mandalCode, villageCode: v.villageCode }),
  };
  // The page sends the same form again as base64 JSON in "encodestr"; the server expects both.
  fields.encodestr = Buffer.from(JSON.stringify({ ...fields, encodestr: '' })).toString('base64');
  const res = await fetch(`${BASE}/unitRateMV`, {
    method: 'POST',
    headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`unitRateMV responded ${res.status}`);
  return res.text();
}

export interface RatesResult {
  processed: number;
  rows: number;
  errors: number;
  remaining: number;
  sampleErrors: string[];
}

/** Read rates for due villages within a time budget. Call until `remaining` is 0. */
export async function syncIgrRates(db: DB, opts: { budgetMs?: number } = {}): Promise<RatesResult> {
  const budgetMs = opts.budgetMs ?? 45_000;
  const started = Date.now();
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 86_400_000);
  const due = await db
    .select()
    .from(igrVillages)
    .where(or(isNull(igrVillages.fetchedAt), lt(igrVillages.fetchedAt, cutoff)))
    .orderBy(asc(igrVillages.fetchedAt), asc(igrVillages.id));
  // Villages that hold a registered project first, so the pages buyers open get rates soonest.
  const reg = await db.select({ village: reraRegistry.village, locality: reraRegistry.locality }).from(reraRegistry);
  const wanted = new Set(reg.flatMap((r) => [normPlace(r.village), normPlace(r.locality)]).filter(Boolean));
  const first = (v: (typeof due)[number]) => (wanted.has(normPlace(v.villageName)) || v.districtCode === HYDERABAD ? 0 : 1);
  due.sort((a, b) => first(a) - first(b));
  const result: RatesResult = { processed: 0, rows: 0, errors: 0, remaining: due.length, sampleErrors: [] };
  for (const v of due) {
    if (Date.now() - started > budgetMs) break;
    result.processed++;
    try {
      const rates = parseRatesPage(await fetchRates(v));
      await db.delete(igrRates).where(eq(igrRates.villageId, v.id));
      if (rates.length) await db.insert(igrRates).values(rates.map((r) => ({ ...r, villageId: v.id })));
      await db.update(igrVillages).set({ fetchedAt: new Date(), rowCount: rates.length, error: null }).where(eq(igrVillages.id, v.id));
      result.rows += rates.length;
    } catch (err) {
      result.errors++;
      const message = String((err as Error).message ?? err).slice(0, 300);
      if (result.sampleErrors.length < 5) result.sampleErrors.push(`${v.villageName}: ${message}`);
      await db.update(igrVillages).set({ fetchedAt: new Date(), error: message }).where(eq(igrVillages.id, v.id));
    }
    await sleep(GAP_MS);
  }
  result.remaining = due.length - result.processed;
  return result;
}

export async function villagesWithRates(db: DB, districtCodes: string[]) {
  if (districtCodes.length === 0) return [];
  return db
    .select()
    .from(igrVillages)
    .where(and(inArray(igrVillages.districtCode, districtCodes), isNotNull(igrVillages.fetchedAt)));
}
