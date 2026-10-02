import { sql } from 'drizzle-orm';
import type { DB } from './client';
import { projects, microMarkets, projectAlerts } from './schema';
import { MOCK_PROJECTS, MICRO_MARKETS } from '../mock-data';
import { toDbStatus } from './mappers';
import { DEMO_DATA } from '../demo';

/**
 * Extra statutory facts for the seed projects that the original mock structure
 * did not carry. These are demo values for the six sample projects only.
 */
const SEED_FACTS: Record<
  string,
  {
    developer: string;
    reraValidUntil: string;
    escrowAccount: string;
    permitNo: string;
    sanctionedFloors: number;
    sanctionedConfig: string;
    ocStatus: string;
    surveyNumbers: string;
    siteLat: number;
    siteLng: number;
    nearestLakeMeters: number;
    lastQprFiled: string;
    verifiedHoursAgo: number;
  }
> = {
  'aurelia-heights': {
    developer: 'Aurelia Infra LLP',
    reraValidUntil: '2028-06-30',
    escrowAccount: 'Escrow A/c ending 4417',
    permitNo: 'HMDA/BP/2023/04112',
    sanctionedFloors: 35,
    sanctionedConfig: '2B+G+34',
    ocStatus: 'Not applied',
    surveyNumbers: 'Sy. No. 239, 240 Kokapet (V)',
    siteLat: 17.3934,
    siteLng: 78.3297,
    nearestLakeMeters: 640,
    lastQprFiled: 'Q1 FY2026-27',
    verifiedHoursAgo: 20,
  },
  'lakeview-residency': {
    developer: 'Lakeview Developers Pvt Ltd',
    reraValidUntil: '2026-12-31',
    escrowAccount: 'Not disclosed',
    permitNo: 'Pending',
    sanctionedFloors: 0,
    sanctionedConfig: 'Not sanctioned',
    ocStatus: 'Not applied',
    surveyNumbers: 'Sy. No. 112/A Narsingi (V)',
    siteLat: 17.3861,
    siteLng: 78.3588,
    nearestLakeMeters: 12,
    lastQprFiled: 'Q3 FY2025-26',
    verifiedHoursAgo: 8,
  },
  'skyline-crest': {
    developer: 'Skyline Crest Constructions',
    reraValidUntil: '2027-09-30',
    escrowAccount: 'Escrow A/c ending 9021',
    permitNo: 'GHMC/TP/2022/1187',
    sanctionedFloors: 30,
    sanctionedConfig: '3B+G+29',
    ocStatus: 'Applied',
    surveyNumbers: 'Sy. No. 83 Nanakramguda (V)',
    siteLat: 17.4156,
    siteLng: 78.3412,
    nearestLakeMeters: 910,
    lastQprFiled: 'Q1 FY2026-27',
    verifiedHoursAgo: 48,
  },
  'banyan-park': {
    developer: 'Banyan Homes Pvt Ltd',
    reraValidUntil: '2029-03-31',
    escrowAccount: 'Escrow A/c ending 3305',
    permitNo: 'HMDA/BP/2024/00981',
    sanctionedFloors: 32,
    sanctionedConfig: '2B+G+31',
    ocStatus: 'Not applied',
    surveyNumbers: 'Sy. No. 145, 146 Kokapet (V)',
    siteLat: 17.4012,
    siteLng: 78.3354,
    nearestLakeMeters: 420,
    lastQprFiled: 'Q1 FY2026-27',
    verifiedHoursAgo: 72,
  },
  'marina-greens': {
    developer: 'Marina Estates',
    reraValidUntil: '2026-09-30',
    escrowAccount: 'Escrow A/c ending 7764',
    permitNo: 'HMDA/BP/2022/03340',
    sanctionedFloors: 22,
    sanctionedConfig: 'B+G+21',
    ocStatus: 'Not applied',
    surveyNumbers: 'Sy. No. 371 Tellapur (V)',
    siteLat: 17.4697,
    siteLng: 78.2826,
    nearestLakeMeters: 48,
    lastQprFiled: 'Q4 FY2025-26',
    verifiedHoursAgo: 96,
  },
  'orchid-terraces': {
    developer: 'Orchid Spaces',
    reraValidUntil: '2027-03-31',
    escrowAccount: 'Escrow A/c ending 1208',
    permitNo: 'GHMC/TP/2021/2290',
    sanctionedFloors: 18,
    sanctionedConfig: 'B+G+17',
    ocStatus: 'Applied',
    surveyNumbers: 'Sy. No. 57 Uppal Kalan (V)',
    siteLat: 17.4018,
    siteLng: 78.5591,
    nearestLakeMeters: 780,
    lastQprFiled: 'Q1 FY2026-27',
    verifiedHoursAgo: 160,
  },
};

/** Approximate IGR guideline values (sq ft) for the seed micro-markets. Demo values. */
const SEED_GUIDELINE: Record<string, number> = {
  Neopolis: 7600,
  Kokapet: 6900,
  'Financial District': 7200,
  'Narsingi / Tellapur': 5200,
  Somajiguda: 8100,
  'LB Nagar / Uppal': 4300,
};

export async function seedIfEmpty(db: DB): Promise<boolean> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(projects);
  if (count > 0) return false;

  await db.insert(microMarkets).values(
    MICRO_MARKETS.map((m) => ({
      name: m.name,
      minRate: m.minRate,
      maxRate: m.maxRate,
      description: m.description,
      guidelineRatePerSqFt: SEED_GUIDELINE[m.name] ?? null,
      guidelineSource: 'Seed value. Replace via IGR sync.',
      guidelineUpdatedAt: new Date(),
    }))
  ).onConflictDoNothing();

  // Area price ranges are fine anywhere. The sample projects are not: production starts empty
  // and fills only from approved records.
  if (!DEMO_DATA) return true;

  const now = Date.now();
  await db.insert(projects).values(
    MOCK_PROJECTS.map((p) => {
      const f = SEED_FACTS[p.id];
      return {
        id: p.id,
        slug: p.id,
        name: p.name,
        developer: f?.developer ?? null,
        location: p.location,
        microMarket: p.microMarket,
        reraId: p.reraNumber,
        reraStatus: p.reraStatus,
        reraValidUntil: f?.reraValidUntil ?? null,
        escrowAccount: f?.escrowAccount ?? null,
        lastQprFiled: f?.lastQprFiled ?? null,
        buildingPlan: p.buildingPlan,
        permitNo: f?.permitNo ?? null,
        sanctionedFloors: f?.sanctionedFloors ?? null,
        sanctionedConfig: f?.sanctionedConfig ?? null,
        ocStatus: f?.ocStatus ?? null,
        lakeBuffer: p.lakeBuffer,
        surveyNumbers: f?.surveyNumbers ?? null,
        siteLat: f?.siteLat ?? null,
        siteLng: f?.siteLng ?? null,
        nearestLakeMeters: f?.nearestLakeMeters ?? null,
        ratePerSqFt: p.ratePerSqFt,
        priceRange: p.priceRange,
        config: p.config,
        possessionYear: p.possessionYear,
        distanceToIT: p.distanceToIT,
        safetyScore: p.score,
        status: toDbStatus(p.status),
        summary: p.summary,
        whySummary: p.whySummary,
        keyConcerns: p.keyConcerns ?? [],
        sourceUrls: {},
        lastVerifiedAt: new Date(now - (f?.verifiedHoursAgo ?? 24) * 3600_000),
        updatedAt: new Date(now - (f?.verifiedHoursAgo ?? 24) * 3600_000),
      };
    })
  );

  await db.insert(projectAlerts).values({
    projectId: 'lakeview-residency',
    date: new Date(now - 9 * 86400_000).toISOString().slice(0, 10),
    type: 'Buffer flag',
    documentType: 'FTL_BUFFER_CHECK',
    source: 'HYDRAA_FTL',
    whatChanged: 'Survey overlay places part of the plot inside the 30 metre lake buffer.',
    whatItMeans: 'Construction inside a lake buffer cannot be regularised. Do not pay a token advance until this is resolved.',
    statusAfter: 'risk',
    publishedAt: new Date(now - 9 * 86400_000),
  });

  return true;
}
