import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  doublePrecision,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Status vocabulary stored in the database.
 * The public UI uses safe | warning | risk; lib/db/mappers.ts translates.
 */
export type DbProjectStatus = 'verified' | 'caution' | 'risk';
export type ReraStatus = 'Active' | 'Pending' | 'Not Found';
export type BuildingPlanStatus = 'Approved' | 'Pending';
export type LakeBufferStatus = 'Clear' | 'Inside buffer zone';
export type PendingStatus = 'pending' | 'approved' | 'rejected' | 'flagged';
export type SourceId = 'TG_RERA' | 'TS_BPASS' | 'HYDRAA_FTL' | 'IGR' | 'MANUAL';
export type DocumentType =
  | 'RERA_QUARTERLY_DISCLOSURE'
  | 'RERA_REGISTRATION'
  | 'SANCTION_ORDER'
  | 'OCCUPANCY_CERTIFICATE'
  | 'PENALTY_NOTICE'
  | 'FTL_BUFFER_CHECK'
  | 'GUIDELINE_RATE';

export interface SourceUrls {
  rera?: string;
  bpass?: string;
}

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    developer: text('developer'),
    location: text('location').notNull(),
    microMarket: text('micro_market').notNull(),

    // TG-RERA
    reraId: text('rera_id').notNull(),
    reraStatus: text('rera_status').$type<ReraStatus>().notNull(),
    reraValidUntil: text('rera_valid_until'), // ISO date (YYYY-MM-DD)
    escrowAccount: text('escrow_account'),
    lastQprFiled: text('last_qpr_filed'), // e.g. "Q2 FY2026-27"

    // TS-bPASS / HMDA / GHMC
    buildingPlan: text('building_plan').$type<BuildingPlanStatus>().notNull(),
    permitNo: text('permit_no'),
    sanctionedFloors: integer('sanctioned_floors'),
    sanctionedConfig: text('sanctioned_config'), // e.g. "2B+G+34"
    ocStatus: text('oc_status'), // 'Issued' | 'Not applied' | 'Applied'

    // Lake FTL / buffer
    lakeBuffer: text('lake_buffer').$type<LakeBufferStatus>().notNull(),
    surveyNumbers: text('survey_numbers'),
    siteLat: doublePrecision('site_lat'),
    siteLng: doublePrecision('site_lng'),
    nearestLakeMeters: integer('nearest_lake_meters'),

    // Commercials
    ratePerSqFt: integer('rate_per_sq_ft').notNull(),
    priceRange: text('price_range').notNull(),
    config: text('config').notNull(),
    possessionYear: text('possession_year').notNull(),
    distanceToIT: text('distance_to_it').notNull(),

    // Verdict
    safetyScore: integer('safety_score').notNull(),
    status: text('status').$type<DbProjectStatus>().notNull(),
    summary: text('summary').notNull(),
    whySummary: text('why_summary').notNull(),
    keyConcerns: jsonb('key_concerns').$type<string[]>().notNull().default([]),

    sourceUrls: jsonb('source_urls').$type<SourceUrls>().notNull().default({}),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
    isLive: boolean('is_live').notNull().default(true),
  },
  (t) => [uniqueIndex('projects_slug_idx').on(t.slug)]
);

export const microMarkets = pgTable('micro_markets', {
  name: text('name').primaryKey(),
  minRate: integer('min_rate').notNull(),
  maxRate: integer('max_rate').notNull(),
  description: text('description').notNull(),
  // IGR (Registration & Stamps) guideline value per sq ft, from the sub-registrar benchmark
  guidelineRatePerSqFt: integer('guideline_rate_per_sq_ft'),
  guidelineSource: text('guideline_source'),
  guidelineUpdatedAt: timestamp('guideline_updated_at', { withTimezone: true }),
});

/** Field-level change a pending update proposes. Keys mirror the projects table. */
export type ProposedChanges = Partial<{
  reraStatus: ReraStatus;
  reraValidUntil: string;
  escrowAccount: string;
  lastQprFiled: string;
  buildingPlan: BuildingPlanStatus;
  permitNo: string;
  sanctionedFloors: number;
  sanctionedConfig: string;
  ocStatus: string;
  lakeBuffer: LakeBufferStatus;
  nearestLakeMeters: number;
  ratePerSqFt: number;
  addKeyConcern: string;
  guidelineRatePerSqFt: number;
}>;

export const pendingUpdates = pgTable(
  'pending_updates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetType: text('target_type').$type<'project' | 'market'>().notNull().default('project'),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    marketName: text('market_name').references(() => microMarkets.name, { onDelete: 'cascade' }),
    source: text('source').$type<SourceId>().notNull(),
    documentType: text('document_type').$type<DocumentType>().notNull(),
    sourceUrl: text('source_url'),
    rawTitle: text('raw_title').notNull(),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull().default({}),
    contentHash: text('content_hash').notNull(),
    proposedChanges: jsonb('proposed_changes').$type<ProposedChanges>().notNull().default({}),
    aiSummaryWhatChanged: text('ai_summary_what_changed').notNull(),
    aiSummaryWhatItMeans: text('ai_summary_what_it_means').notNull(),
    recommendedStatus: text('recommended_status').$type<DbProjectStatus>(),
    confidenceScore: real('confidence_score').notNull().default(0),
    analyzer: text('analyzer').notNull().default('rules'), // 'gemini' | 'rules'
    status: text('status').$type<PendingStatus>().notNull().default('pending'),
    reviewerNote: text('reviewer_note'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pending_updates_status_idx').on(t.status),
    uniqueIndex('pending_updates_hash_idx').on(t.contentHash),
  ]
);

export const projectAlerts = pgTable(
  'project_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // ISO date of the regulatory event
    type: text('type').notNull(), // human label e.g. "Penalty added"
    documentType: text('document_type').$type<DocumentType>(),
    source: text('source').$type<SourceId>(),
    sourceUrl: text('source_url'),
    whatChanged: text('what_changed').notNull(),
    whatItMeans: text('what_it_means').notNull(),
    statusAfter: text('status_after').$type<DbProjectStatus>(),
    pendingUpdateId: uuid('pending_update_id'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_alerts_project_idx').on(t.projectId, t.publishedAt)]
);

export const watchSubscriptions = pgTable(
  'watch_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    channel: text('channel').$type<'whatsapp' | 'email'>().notNull(),
    contact: text('contact').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('watch_project_contact_idx').on(t.projectId, t.contact)]
);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertId: uuid('alert_id').references(() => projectAlerts.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id'),
  channel: text('channel').$type<'whatsapp' | 'email'>().notNull(),
  contact: text('contact').notNull(),
  status: text('status').$type<'sent' | 'logged' | 'failed'>().notNull(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Last seen content hash per source page, used for change detection. */
export const sourceSnapshots = pgTable(
  'source_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: text('project_id'),
    source: text('source').$type<SourceId>().notNull(),
    url: text('url').notNull(),
    contentHash: text('content_hash').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('source_snapshots_url_idx').on(t.source, t.url)]
);

export const scrapeRuns = pgTable('scrape_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  trigger: text('trigger').notNull(), // 'cron' | 'admin' | 'cli'
  mode: text('mode').notNull(), // 'live' | 'simulate'
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  stats: jsonb('stats').$type<Record<string, number>>().notNull().default({}),
  errors: jsonb('errors').$type<string[]>().notNull().default([]),
});

export type ProjectRow = typeof projects.$inferSelect;
export type MicroMarketRow = typeof microMarkets.$inferSelect;
export type PendingUpdateRow = typeof pendingUpdates.$inferSelect;
export type ProjectAlertRow = typeof projectAlerts.$inferSelect;
export type WatchSubscriptionRow = typeof watchSubscriptions.$inferSelect;

export type LeadSource = 'booking' | 'shortlist' | 'report' | 'concierge' | 'newsletter' | 'project_request';

/**
 * People who asked us for something: a call, a shortlist, a full report.
 * Each row is also forwarded to LEAD_WEBHOOK_URL (the CRM) when it is set.
 */
export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').$type<LeadSource>().notNull(),
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    projectId: text('project_id'),
    projectName: text('project_name'),
    preferences: jsonb('preferences').$type<Record<string, unknown>>(),
    message: text('message'),
    slot: text('slot'),
    pagePath: text('page_path'),
    utm: jsonb('utm').$type<Record<string, string>>(),
    consent: boolean('consent').notNull().default(false),
    forwardStatus: text('forward_status').$type<'sent' | 'logged' | 'failed'>().notNull().default('logged'),
    forwardError: text('forward_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('leads_created_idx').on(t.createdAt), index('leads_email_idx').on(t.email), index('leads_phone_idx').on(t.phone)]
);

export type ProjectRequestStatus = 'new' | 'researching' | 'added' | 'rejected';

/**
 * Projects buyers searched for that we have not checked yet.
 * The team works this list on the Review Desk so coverage grows with demand.
 */
export const projectRequests = pgTable(
  'project_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectName: text('project_name').notNull(),
    nameKey: text('name_key').notNull(),
    developer: text('developer'),
    area: text('area'),
    reraNumber: text('rera_number'),
    stage: text('stage'),
    searchedQuery: text('searched_query'),
    requesterName: text('requester_name'),
    requesterEmail: text('requester_email'),
    requesterPhone: text('requester_phone'),
    leadId: uuid('lead_id'),
    status: text('status').$type<ProjectRequestStatus>().notNull().default('new'),
    addedProjectId: text('added_project_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_requests_name_idx').on(t.nameKey), index('project_requests_status_idx').on(t.status, t.createdAt)]
);
