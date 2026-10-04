import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, type DB } from '../db/client';
import {
  microMarkets,
  notifications,
  pendingUpdates,
  projectAlerts,
  projects,
  scrapeRuns,
  watchSubscriptions,
  type DbProjectStatus,
  type DocumentType,
  type PendingStatus,
  type ProjectRow,
  type ProposedChanges,
  type SourceId,
  type SourceUrls,
} from '../db/schema';
import { rowToAlert, rowToMarket, rowToProject } from '../db/mappers';
import type { LiveSnapshot, ProjectAlertItem } from '../mock-data';
import { alertTypeLabel, applyChanges, suggestScore, suggestStatus, DIFF_FIELDS } from '../verdict';
import { notifyWatchers } from '../notify';

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const db = await getDb();
  const [projRows, marketRows, alertRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.isLive, true)).orderBy(projects.name),
    db.select().from(microMarkets),
    db.select().from(projectAlerts).orderBy(desc(projectAlerts.publishedAt)).limit(100),
  ]);
  const names = new Map(projRows.map((p) => [p.id, p.name]));
  // Keep the original demo ordering stable: seed order first, then new projects.
  const order = ['aurelia-heights', 'lakeview-residency', 'skyline-crest', 'banyan-park', 'marina-greens', 'orchid-terraces'];
  projRows.sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.name.localeCompare(b.name);
  });
  const alerts = alertRows.filter((a) => names.has(a.projectId)).map((a) => rowToAlert(a, names.get(a.projectId)!));
  const latest = Math.max(0, ...projRows.map((p) => p.updatedAt.getTime()), ...alertRows.map((a) => a.publishedAt.getTime()));
  const verSum = projRows.reduce((s, p) => s + p.version, 0);
  return {
    projects: projRows.map(rowToProject),
    markets: marketRows.map(rowToMarket),
    alerts,
    version: `${latest}.${verSum}.${alertRows.length}`,
    generatedAt: new Date().toISOString(),
  };
}

export async function getProjectDetail(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.isLive, true))).limit(1);
  if (!row) return null;
  const alerts = await db
    .select()
    .from(projectAlerts)
    .where(eq(projectAlerts.projectId, id))
    .orderBy(desc(projectAlerts.publishedAt))
    .limit(20);
  const [market] = await db.select().from(microMarkets).where(eq(microMarkets.name, row.microMarket)).limit(1);
  return {
    project: rowToProject(row),
    market: market ? rowToMarket(market) : null,
    alerts: alerts.map((a) => rowToAlert(a, row.name)) as ProjectAlertItem[],
  };
}

// ---------------------------------------------------------------------------
// Watch subscriptions
// ---------------------------------------------------------------------------

export async function addWatch(projectId: string, channel: 'whatsapp' | 'email', contact: string) {
  const db = await getDb();
  const [row] = await db
    .insert(watchSubscriptions)
    .values({ projectId, channel, contact })
    .onConflictDoUpdate({ target: [watchSubscriptions.projectId, watchSubscriptions.contact], set: { channel } })
    .returning();
  return row;
}

export async function removeWatch(projectId: string, contact: string) {
  const db = await getDb();
  await db.delete(watchSubscriptions).where(and(eq(watchSubscriptions.projectId, projectId), eq(watchSubscriptions.contact, contact)));
}

// ---------------------------------------------------------------------------
// Pending update queue
// ---------------------------------------------------------------------------

export interface EnqueueInput {
  targetType: 'project' | 'market';
  projectId?: string;
  marketName?: string;
  source: SourceId;
  documentType: DocumentType;
  sourceUrl?: string;
  rawTitle: string;
  rawPayload: Record<string, unknown>;
  contentHash: string;
  proposedChanges: ProposedChanges;
  whatChanged: string;
  whatItMeans: string;
  recommendedStatus?: DbProjectStatus | null;
  confidenceScore: number;
  analyzer: 'claude' | 'rules' | 'structured';
}

/** Insert a pending update. Returns null if the same document was already queued. */
export async function enqueuePendingUpdate(input: EnqueueInput, db?: DB) {
  db ??= await getDb();
  const [row] = await db
    .insert(pendingUpdates)
    .values({
      targetType: input.targetType,
      projectId: input.projectId ?? null,
      marketName: input.marketName ?? null,
      source: input.source,
      documentType: input.documentType,
      sourceUrl: input.sourceUrl ?? null,
      rawTitle: input.rawTitle,
      rawPayload: input.rawPayload,
      contentHash: input.contentHash,
      proposedChanges: input.proposedChanges,
      aiSummaryWhatChanged: input.whatChanged,
      aiSummaryWhatItMeans: input.whatItMeans,
      recommendedStatus: input.recommendedStatus ?? null,
      confidenceScore: input.confidenceScore,
      analyzer: input.analyzer,
    })
    .onConflictDoNothing({ target: pendingUpdates.contentHash })
    .returning();
  return row ?? null;
}

export async function listQueue(statuses: PendingStatus[] = ['pending', 'flagged'], limit = 100) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(pendingUpdates)
    .where(inArray(pendingUpdates.status, statuses))
    .orderBy(desc(pendingUpdates.createdAt))
    .limit(limit);

  const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as string[];
  const marketNames = [...new Set(rows.map((r) => r.marketName).filter(Boolean))] as string[];
  const [projRows, marketRows, subCounts] = await Promise.all([
    projectIds.length ? db.select().from(projects).where(inArray(projects.id, projectIds)) : Promise.resolve([] as ProjectRow[]),
    marketNames.length ? db.select().from(microMarkets).where(inArray(microMarkets.name, marketNames)) : Promise.resolve([]),
    projectIds.length
      ? db
          .select({ projectId: watchSubscriptions.projectId, n: sql<number>`count(*)::int` })
          .from(watchSubscriptions)
          .where(inArray(watchSubscriptions.projectId, projectIds))
          .groupBy(watchSubscriptions.projectId)
      : Promise.resolve([] as { projectId: string; n: number }[]),
  ]);
  const pMap = new Map(projRows.map((p) => [p.id, p]));
  const mMap = new Map(marketRows.map((m) => [m.name, m]));
  const sMap = new Map(subCounts.map((s) => [s.projectId, s.n]));

  return rows.map((r) => {
    const live = r.projectId ? pMap.get(r.projectId) ?? null : null;
    const market = r.marketName ? mMap.get(r.marketName) ?? null : null;
    let diff: { key: string; label: string; current: unknown; proposed: unknown; changed: boolean }[] = [];
    let suggested: { status: DbProjectStatus; score: number } | null = null;
    if (live) {
      const next = applyChanges(live, r.proposedChanges);
      diff = DIFF_FIELDS.map(({ key, label }) => ({
        key,
        label,
        current: live[key],
        proposed: next[key],
        changed: live[key] !== next[key],
      }));
      if (r.proposedChanges.addKeyConcern) {
        diff.push({ key: 'keyConcerns', label: 'New concern', current: '', proposed: r.proposedChanges.addKeyConcern, changed: true });
      }
      const status = r.recommendedStatus ?? suggestStatus(next);
      suggested = { status, score: suggestScore(live.safetyScore, status, live.status) };
    } else if (market) {
      diff = [
        { key: 'guidelineRatePerSqFt', label: 'IGR guideline / sq ft', current: market.guidelineRatePerSqFt, proposed: r.proposedChanges.guidelineRatePerSqFt, changed: true },
        { key: 'marketRange', label: 'Market range / sq ft', current: `${market.minRate} to ${market.maxRate}`, proposed: `${market.minRate} to ${market.maxRate}`, changed: false },
      ];
    }
    return {
      update: {
        ...r,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      },
      live: live
        ? { id: live.id, name: live.name, location: live.location, status: live.status, safetyScore: live.safetyScore, summary: live.summary, version: live.version }
        : null,
      market: market ? { name: market.name } : null,
      watchers: r.projectId ? sMap.get(r.projectId) ?? 0 : 0,
      diff,
      suggested,
    };
  });
}

export type QueueItem = Awaited<ReturnType<typeof listQueue>>[number];

export async function getAdminStats() {
  const db = await getDb();
  const [counts] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${pendingUpdates.status} = 'pending')::int`,
      flagged: sql<number>`count(*) filter (where ${pendingUpdates.status} = 'flagged')::int`,
      approved7d: sql<number>`count(*) filter (where ${pendingUpdates.status} = 'approved' and ${pendingUpdates.reviewedAt} > now() - interval '7 days')::int`,
      rejected7d: sql<number>`count(*) filter (where ${pendingUpdates.status} = 'rejected' and ${pendingUpdates.reviewedAt} > now() - interval '7 days')::int`,
    })
    .from(pendingUpdates);
  const [lastRun] = await db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.startedAt)).limit(1);
  const [{ watchers }] = await db.select({ watchers: sql<number>`count(*)::int` }).from(watchSubscriptions);
  return {
    ...counts,
    watchers,
    lastRun: lastRun
      ? { ...lastRun, startedAt: lastRun.startedAt.toISOString(), finishedAt: lastRun.finishedAt?.toISOString() ?? null }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Approve & push live
// ---------------------------------------------------------------------------

export class QueueConflictError extends Error {}

export interface ApproveInput {
  id: string;
  reviewer: string;
  whatChanged?: string;
  whatItMeans?: string;
  status?: DbProjectStatus;
  score?: number;
  summary?: string;
  fieldOverrides?: ProposedChanges;
  notify?: boolean;
}

export async function approveUpdate(input: ApproveInput) {
  const db = await getDb();

  const result = await db.transaction(async (tx) => {
    // Claim the row. The status guard makes double clicks and concurrent reviewers safe.
    const [pu] = await tx
      .update(pendingUpdates)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: input.reviewer,
        ...(input.whatChanged ? { aiSummaryWhatChanged: input.whatChanged } : {}),
        ...(input.whatItMeans ? { aiSummaryWhatItMeans: input.whatItMeans } : {}),
      })
      .where(and(eq(pendingUpdates.id, input.id), inArray(pendingUpdates.status, ['pending', 'flagged'])))
      .returning();
    if (!pu) throw new QueueConflictError('This update was already reviewed or does not exist.');

    const changes: ProposedChanges = { ...pu.proposedChanges, ...(input.fieldOverrides ?? {}) };

    if (pu.targetType === 'market') {
      if (!pu.marketName || !changes.guidelineRatePerSqFt) throw new Error('Market update has no guideline rate.');
      await tx
        .update(microMarkets)
        .set({ guidelineRatePerSqFt: changes.guidelineRatePerSqFt, guidelineSource: pu.sourceUrl ?? 'IGR', guidelineUpdatedAt: new Date() })
        .where(eq(microMarkets.name, pu.marketName));
      return { kind: 'market' as const, marketName: pu.marketName, pu };
    }

    const [current] = await tx.select().from(projects).where(eq(projects.id, pu.projectId!)).for('update');
    if (!current) throw new Error('Project no longer exists.');

    const next = applyChanges(current, changes);
    const status = input.status ?? pu.recommendedStatus ?? suggestStatus(next);
    const score = Math.max(0, Math.min(100, Math.round(input.score ?? suggestScore(current.safetyScore, status, current.status))));
    const now = new Date();

    const [updated] = await tx
      .update(projects)
      .set({
        reraStatus: next.reraStatus,
        reraValidUntil: next.reraValidUntil,
        escrowAccount: next.escrowAccount,
        lastQprFiled: next.lastQprFiled,
        buildingPlan: next.buildingPlan,
        permitNo: next.permitNo,
        sanctionedFloors: next.sanctionedFloors,
        sanctionedConfig: next.sanctionedConfig,
        ocStatus: next.ocStatus,
        lakeBuffer: next.lakeBuffer,
        nearestLakeMeters: next.nearestLakeMeters,
        ratePerSqFt: next.ratePerSqFt,
        keyConcerns: next.keyConcerns,
        status,
        safetyScore: score,
        ...(input.summary?.trim() ? { summary: input.summary.trim() } : {}),
        lastVerifiedAt: now,
        updatedAt: now,
        version: sql`${projects.version} + 1`,
      })
      .where(eq(projects.id, current.id))
      .returning();

    const [alert] = await tx
      .insert(projectAlerts)
      .values({
        projectId: current.id,
        date: typeof pu.rawPayload.eventDate === 'string' ? pu.rawPayload.eventDate : now.toISOString().slice(0, 10),
        type: alertTypeLabel(pu.documentType, changes, status, current.status),
        documentType: pu.documentType,
        source: pu.source,
        sourceUrl: pu.sourceUrl,
        whatChanged: input.whatChanged ?? pu.aiSummaryWhatChanged,
        whatItMeans: input.whatItMeans ?? pu.aiSummaryWhatItMeans,
        statusAfter: status,
        pendingUpdateId: pu.id,
        publishedAt: now,
      })
      .returning();

    return { kind: 'project' as const, project: updated, alert, pu };
  });

  if (result.kind === 'project') {
    const delivery = input.notify === false ? null : await notifyWatchers(db, result.project, result.alert);
    return {
      kind: 'project' as const,
      projectId: result.project.id,
      projectUrl: `/project?id=${encodeURIComponent(result.project.id)}`,
      status: result.project.status,
      score: result.project.safetyScore,
      version: result.project.version,
      alertId: result.alert.id,
      delivery,
    };
  }
  return { kind: 'market' as const, marketName: result.marketName };
}

export async function rejectUpdate(id: string, action: 'reject' | 'flag', reviewer: string, note?: string) {
  const db = await getDb();
  const [row] = await db
    .update(pendingUpdates)
    .set({
      status: action === 'reject' ? 'rejected' : 'flagged',
      reviewedBy: reviewer,
      reviewedAt: new Date(),
      reviewerNote: note ?? null,
    })
    .where(and(eq(pendingUpdates.id, id), inArray(pendingUpdates.status, action === 'reject' ? ['pending', 'flagged'] : ['pending'])))
    .returning();
  if (!row) throw new QueueConflictError('This update was already reviewed or does not exist.');
  return row;
}

// ---------------------------------------------------------------------------
// Admin project source configuration
// ---------------------------------------------------------------------------

export async function listProjectSources() {
  const db = await getDb();
  const rows = await db.select().from(projects).orderBy(projects.name);
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    reraId: p.reraId,
    permitNo: p.permitNo,
    sourceUrls: p.sourceUrls,
    siteLat: p.siteLat,
    siteLng: p.siteLng,
    surveyNumbers: p.surveyNumbers,
  }));
}

export async function updateProjectSources(
  id: string,
  patch: { sourceUrls?: SourceUrls; siteLat?: number | null; siteLng?: number | null; surveyNumbers?: string | null }
) {
  const db = await getDb();
  const [row] = await db
    .update(projects)
    .set({
      ...(patch.sourceUrls ? { sourceUrls: patch.sourceUrls } : {}),
      ...(patch.siteLat !== undefined ? { siteLat: patch.siteLat } : {}),
      ...(patch.siteLng !== undefined ? { siteLng: patch.siteLng } : {}),
      ...(patch.surveyNumbers !== undefined ? { surveyNumbers: patch.surveyNumbers } : {}),
    })
    .where(eq(projects.id, id))
    .returning();
  return row ?? null;
}

export async function recentNotifications(limit = 20) {
  const db = await getDb();
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
}

/** The id of a checked report if it is live, for linking from the TG-RERA record page. */
export async function liveReportId(id: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, id), eq(projects.isLive, true))).limit(1);
  return row?.id ?? null;
}
