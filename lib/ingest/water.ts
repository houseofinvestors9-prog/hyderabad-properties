import { and, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import type { DB } from '../db/client';
import { ingestState, reraRegistry, waterBodies } from '../db/schema';
import { distanceToPolygonMeters, type Ring } from './geo';

/**
 * Lakes, tanks and reservoirs as mapped on OpenStreetMap (© OpenStreetMap contributors, ODbL).
 *
 * OSM draws the water you can see, not the official Full Tank Level line, which is usually wider.
 * So this only measures "how far is the nearest mapped water from the project's map point". The
 * official FTL map from HMDA is what a reviewer checks before any report says more.
 *
 * Fetched in 0.1° tiles (about 11 km) around registered projects, refreshed every 60 days.
 */

const ENDPOINTS = (
  process.env.OVERPASS_URLS ??
  'https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass.private.coffee/api/interpreter'
).split(',');
const UA =
  process.env.INGEST_USER_AGENT ??
  'Mozilla/5.0 (compatible; hyderabad.properties-verifier/1.0; +https://hyderabad.properties)';
const TILE = 0.1;
const REFRESH_DAYS = 60;
const STATE_KEY = 'water_tiles';

type LngLat = [number, number];
interface OsmGeomPoint {
  lat: number;
  lon: number;
}
interface OsmElement {
  type: 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  geometry?: OsmGeomPoint[];
  members?: { type: string; role: string; geometry?: OsmGeomPoint[] }[];
}

export function tileOf(lat: number, lng: number): string {
  return `${Math.floor(lat / TILE)}:${Math.floor(lng / TILE)}`;
}

function tileBox(tile: string): [number, number, number, number] {
  const [a, b] = tile.split(':').map(Number);
  return [a * TILE, b * TILE, (a + 1) * TILE, (b + 1) * TILE];
}

const toLngLat = (g: OsmGeomPoint[]): LngLat[] => g.map((p) => [p.lon, p.lat]);

/** Join open member ways of a multipolygon into closed rings by matching endpoints. */
function joinRings(parts: LngLat[][]): LngLat[][] {
  const rings: LngLat[][] = [];
  const open = parts.filter((p) => p.length > 1).map((p) => [...p]);
  const same = (a: LngLat, b: LngLat) => a[0] === b[0] && a[1] === b[1];
  while (open.length) {
    let ring = open.shift()!;
    let grew = true;
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < open.length; i++) {
        const p = open[i];
        const end = ring[ring.length - 1];
        if (same(end, p[0])) ring = ring.concat(p.slice(1));
        else if (same(end, p[p.length - 1])) ring = ring.concat([...p].reverse().slice(1));
        else continue;
        open.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring.length >= 4 && same(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

/** Shoelace area in square metres (local projection), for ignoring tiny ponds and pools. */
function ringAreaSqm(ring: LngLat[]): number {
  const lat0 = (ring[0][1] * Math.PI) / 180;
  const k = 6_371_000;
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = [((ring[i][0] * Math.PI) / 180) * k * Math.cos(lat0), ((ring[i][1] * Math.PI) / 180) * k];
    const [x2, y2] = [((ring[i + 1][0] * Math.PI) / 180) * k * Math.cos(lat0), ((ring[i + 1][1] * Math.PI) / 180) * k];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
}

function toBody(el: OsmElement, tile: string) {
  const tags = el.tags ?? {};
  let polygons: LngLat[][][] = [];
  if (el.type === 'way' && el.geometry && el.geometry.length >= 4) {
    polygons = [[toLngLat(el.geometry)]];
  } else if (el.type === 'relation' && el.members) {
    const outer = joinRings(el.members.filter((m) => m.role !== 'inner' && m.geometry).map((m) => toLngLat(m.geometry!)));
    const inner = joinRings(el.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => toLngLat(m.geometry!)));
    // Inner rings are islands; keeping them with every outer ring is harmless for a distance check.
    polygons = outer.map((o) => [o, ...inner]);
  }
  if (polygons.length === 0) return null;
  const area = polygons.reduce((s, p) => s + ringAreaSqm(p[0]), 0);
  if (area < 2_000) return null; // swimming pools, fountains, small ponds
  const pts = polygons.flatMap((p) => p[0]);
  return {
    id: `${el.type}/${el.id}`,
    name: tags.name ?? tags['name:en'] ?? null,
    kind: tags.water ?? (tags.landuse === 'reservoir' ? 'reservoir' : tags.natural === 'water' ? 'water' : null),
    areaSqm: Math.round(area),
    minLat: Math.min(...pts.map((p) => p[1])),
    minLng: Math.min(...pts.map((p) => p[0])),
    maxLat: Math.max(...pts.map((p) => p[1])),
    maxLng: Math.max(...pts.map((p) => p[0])),
    rings: polygons,
    tile,
  };
}

async function overpass(query: string): Promise<OsmElement[]> {
  const errors: string[] = [];
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(100_000),
      });
      if (!res.ok) throw new Error(`responded ${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (err) {
      errors.push(`${new URL(url).host}: ${(err as Error).message}`);
    }
  }
  throw new Error(`Overpass unavailable (${errors.join('; ')})`);
}

export interface WaterResult {
  tilesDone: number;
  bodies: number;
  remaining: number;
  sampleErrors: string[];
}

/** Fetch due water tiles around registered projects, within a time budget. */
export async function syncWaterTiles(db: DB, opts: { budgetMs?: number } = {}): Promise<WaterResult> {
  const budgetMs = opts.budgetMs ?? 45_000;
  const started = Date.now();
  const points = await db
    .select({ lat: reraRegistry.lat, lng: reraRegistry.lng })
    .from(reraRegistry)
    .where(and(isNotNull(reraRegistry.lat), isNotNull(reraRegistry.lng)));
  // Each project's own tile plus neighbours, so a lake just across a tile edge is still found.
  const wanted = new Set<string>();
  for (const p of points) {
    for (const dLat of [-0.012, 0, 0.012])
      for (const dLng of [-0.012, 0, 0.012]) wanted.add(tileOf(p.lat! + dLat, p.lng! + dLng));
  }
  const [state] = await db.select().from(ingestState).where(eq(ingestState.key, STATE_KEY));
  const fetched = { ...((state?.value as Record<string, string>) ?? {}) };
  const cutoff = Date.now() - REFRESH_DAYS * 86_400_000;
  const due = [...wanted].filter((t) => !fetched[t] || Date.parse(fetched[t]) < cutoff).sort();

  const result: WaterResult = { tilesDone: 0, bodies: 0, remaining: due.length, sampleErrors: [] };
  for (const tile of due) {
    if (Date.now() - started > budgetMs) break;
    const [s, w, n, e] = tileBox(tile);
    const bbox = `${s},${w},${n},${e}`;
    try {
      const elements = await overpass(
        `[out:json][timeout:90];(way["natural"="water"](${bbox});relation["natural"="water"](${bbox});way["landuse"="reservoir"](${bbox});relation["landuse"="reservoir"](${bbox}););out tags geom;`
      );
      const bodies = elements.map((el) => toBody(el, tile)).filter((b): b is NonNullable<ReturnType<typeof toBody>> => !!b);
      await db.delete(waterBodies).where(eq(waterBodies.tile, tile));
      for (let i = 0; i < bodies.length; i += 100) {
        await db.insert(waterBodies).values(bodies.slice(i, i + 100)).onConflictDoNothing();
      }
      fetched[tile] = new Date().toISOString();
      result.tilesDone++;
      result.bodies += bodies.length;
    } catch (err) {
      if (result.sampleErrors.length < 5) result.sampleErrors.push(`${tile}: ${(err as Error).message}`);
      break; // Overpass is struggling; try again on the next run rather than hammering it.
    }
  }
  await db
    .insert(ingestState)
    .values({ key: STATE_KEY, value: fetched, updatedAt: new Date() })
    .onConflictDoUpdate({ target: ingestState.key, set: { value: fetched, updatedAt: new Date() } });
  result.remaining = due.length - result.tilesDone;
  return result;
}

export interface NearbyWater {
  id: string;
  name: string | null;
  kind: string | null;
  distanceM: number;
}

/** Mapped water bodies within `radiusM` of a point, nearest first. */
export async function waterNear(db: DB, lat: number, lng: number, radiusM = 1000): Promise<NearbyWater[]> {
  const dLat = radiusM / 111_000;
  const dLng = radiusM / (111_000 * Math.cos((lat * Math.PI) / 180));
  const candidates = await db
    .select()
    .from(waterBodies)
    .where(
      and(lte(waterBodies.minLat, lat + dLat), gte(waterBodies.maxLat, lat - dLat), lte(waterBodies.minLng, lng + dLng), gte(waterBodies.maxLng, lng - dLng))
    );
  const out: NearbyWater[] = [];
  for (const c of candidates) {
    let best = Infinity;
    for (const rings of c.rings) best = Math.min(best, distanceToPolygonMeters([lng, lat], { name: c.name ?? '', rings: rings as Ring[] }));
    if (best <= radiusM) out.push({ id: c.id, name: c.name, kind: c.kind, distanceM: Math.round(best) });
  }
  return out.sort((a, b) => a.distanceM - b.distanceM);
}

export async function waterTilesFetched(db: DB): Promise<Set<string>> {
  const [state] = await db.select().from(ingestState).where(inArray(ingestState.key, [STATE_KEY]));
  return new Set(Object.keys((state?.value as Record<string, string>) ?? {}));
}
