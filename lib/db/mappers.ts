import type { ProjectSafetyItem, MicroMarketLive, ProjectAlertItem } from '../mock-data';
import type { DbProjectStatus, ProjectRow, MicroMarketRow, ProjectAlertRow } from './schema';
import { marketedByOwner } from '../builders';

type UiStatus = ProjectSafetyItem['status'];

export function toDbStatus(s: UiStatus): DbProjectStatus {
  return s === 'safe' ? 'verified' : s === 'warning' ? 'caution' : 'risk';
}

export function toUiStatus(s: DbProjectStatus): UiStatus {
  return s === 'verified' ? 'safe' : s === 'caution' ? 'warning' : 'risk';
}

export function statusLabel(s: UiStatus): ProjectSafetyItem['statusLabel'] {
  return s === 'safe' ? 'Looks Safe' : s === 'warning' ? 'Needs a Closer Look' : 'High Risk';
}

const IST = 'Asia/Kolkata';

/** "Today at 9:30 AM", "Yesterday at 4:15 PM", "3 days ago", "12 Sep 2026" (IST). */
export function relativeVerified(date: Date, now: Date = new Date()): string {
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: IST });
  const time = date.toLocaleTimeString('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86400_000));
  const k = dayKey(date);
  if (k === today) return `Today at ${time}`;
  if (k === yesterday) return `Yesterday at ${time}`;
  const days = Math.round((now.getTime() - date.getTime()) / 86400_000);
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' });
}

export function rowToProject(r: ProjectRow): ProjectSafetyItem {
  const status = toUiStatus(r.status);
  return {
    id: r.id,
    name: r.name,
    location: r.location,
    microMarket: r.microMarket,
    reraNumber: r.reraId,
    lastVerifiedDate: relativeVerified(r.lastVerifiedAt),
    reraStatus: r.reraStatus,
    buildingPlan: r.buildingPlan,
    lakeBuffer: r.lakeBuffer,
    priceRange: r.priceRange,
    ratePerSqFt: r.ratePerSqFt,
    config: r.config,
    possessionYear: r.possessionYear,
    distanceToIT: r.distanceToIT,
    status,
    statusLabel: statusLabel(status),
    score: r.safetyScore,
    summary: r.summary,
    whySummary: r.whySummary,
    keyConcerns: r.keyConcerns.length ? r.keyConcerns : undefined,
    developer: r.developer,
    reraValidUntil: r.reraValidUntil,
    escrowAccount: r.escrowAccount,
    lastQprFiled: r.lastQprFiled,
    permitNo: r.permitNo,
    sanctionedFloors: r.sanctionedFloors,
    sanctionedConfig: r.sanctionedConfig,
    ocStatus: r.ocStatus,
    surveyNumbers: r.surveyNumbers,
    nearestLakeMeters: r.nearestLakeMeters,
    siteLat: r.siteLat,
    siteLng: r.siteLng,
    questions: r.questions,
    sources: r.sources,
    signedOffBy: r.signedOffBy,
    signedOffAt: r.signedOffAt?.toISOString() ?? null,
    marketedByOwner: marketedByOwner(r.reraId),
    lastVerifiedAt: r.lastVerifiedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    version: r.version,
  };
}

export function rowToMarket(r: MicroMarketRow): MicroMarketLive {
  return {
    name: r.name,
    minRate: r.minRate,
    maxRate: r.maxRate,
    description: r.description,
    guidelineRatePerSqFt: r.guidelineRatePerSqFt,
    guidelineUpdatedAt: r.guidelineUpdatedAt?.toISOString() ?? null,
  };
}

export function rowToAlert(r: ProjectAlertRow, projectName: string): ProjectAlertItem {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName,
    date: r.date,
    type: r.type,
    whatChanged: r.whatChanged,
    whatItMeans: r.whatItMeans,
    source: r.source,
    sourceUrl: r.sourceUrl,
    publishedAt: r.publishedAt.toISOString(),
  };
}
