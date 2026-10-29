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
    /** Questions a buyer should put to the builder in writing, from the check. */
    questions: jsonb('questions').$type<string[]>().notNull().default([]),
    /** Every source the report relies on, shown on the report. */
    sources: jsonb('sources').$type<{ label: string; url: string }[]>().notNull().default([]),
    /** Name of the person who signed the report off, shown publicly; null while it is a draft. */
    signedOffBy: text('signed_off_by'),
    signedOffAt: timestamp('signed_off_at', { withTimezone: true }),
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
    analyzer: text('analyzer').notNull().default('rules'), // 'claude' | 'rules' | 'structured' (older rows may say 'gemini')
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

export type LeadSource = 'booking' | 'shortlist' | 'report' | 'concierge' | 'newsletter' | 'project_request' | 'signup';

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
    /** Set when the lead came from a logged-in buyer. */
    userId: uuid('user_id'),
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

/** Facts read from a project's TG-RERA page. Companies and projects only, never individuals. */
export interface ReraDetails {
  /** 'Individual' promoters are never named on our pages. */
  promoterType?: 'Individual' | 'Organisation' | null;
  promoterWebsite?: string | null;
  authority?: string | null;
  planApprovalNo?: string | null;
  projectStatus?: string | null;
  projectType?: string | null;
  approvedDate?: string | null; // ISO
  proposedCompletion?: string | null; // ISO
  revisedCompletion?: string | null; // ISO
  litigation?: string | null; // 'Yes' | 'No'
  landAreaSqm?: number | null;
  affectedAreaSqm?: number | null; // lost to road widening, lake FTL or nala widening
  netAreaSqm?: number | null;
  builtUpAreaSqm?: number | null;
  buildings?: number | null;
  maxSlabs?: number | null;
  basements?: number | null;
  totalUnits?: number | null;
  bookedUnits?: number | null;
  unitTypes?: string[];
  workDonePercent?: number | null;
  hasExtension?: boolean;
  lastModified?: string | null; // ISO, as shown on the RERA search result
}

export interface ReraChange {
  at: string; // ISO timestamp we noticed it
  field: keyof ReraDetails | 'promoter' | 'name';
  from: unknown;
  to: unknown;
}

/**
 * Every project registered with TG-RERA, from the authority's public map feed plus its public
 * project page. Shown as "official record, not yet checked"; a checked report lives in `projects`.
 */
export const reraRegistry = pgTable(
  'rera_registry',
  {
    registrationNo: text('registration_no').primaryKey(),
    applicationNo: text('application_no'),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    promoter: text('promoter'),
    locality: text('locality'),
    street: text('street'),
    village: text('village'),
    mandal: text('mandal'),
    district: text('district'),
    pinCode: text('pin_code'),
    surveyNumbers: text('survey_numbers'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    detailUrl: text('detail_url'),
    details: jsonb('details').$type<ReraDetails>(),
    detailHash: text('detail_hash'),
    detailFetchedAt: timestamp('detail_fetched_at', { withTimezone: true }),
    detailError: text('detail_error'),
    changes: jsonb('changes').$type<ReraChange[]>().notNull().default([]),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('rera_registry_slug_idx').on(t.slug),
    index('rera_registry_district_idx').on(t.district),
    index('rera_registry_detail_idx').on(t.detailFetchedAt),
  ]
);

export type ReraRegistryRow = typeof reraRegistry.$inferSelect;

/**
 * Orders and public notices published by TG-RERA (suo motu orders, penalty orders, notices to allottees,
 * rejections), read from the PDFs and matched to registered projects and builders.
 */
export const reraOrders = pgTable(
  'rera_orders',
  {
    id: text('id').primaryKey(), // the PDF file name on the RERA site
    listing: text('listing').$type<'orders' | 'public_notices'>().notNull(),
    kind: text('kind').$type<'suo_motu' | 'penalty' | 'notice' | 'rejection' | 'other'>().notNull(),
    title: text('title').notNull(),
    orderDate: text('order_date'), // ISO
    pdfUrl: text('pdf_url').notNull(),
    caseNo: text('case_no'),
    /** Company or firm the order is against. Null when it is an individual. */
    respondent: text('respondent'),
    respondentKey: text('respondent_key'),
    /** Consolidated penalty, or the only one. Null when the order imposes several without a total. */
    penaltyInr: integer('penalty_inr'),
    /** Each distinct penalty amount the order imposes, in order of appearance. */
    penaltiesInr: jsonb('penalties_inr').$type<number[]>().notNull().default([]),
    /** Registration numbers of registry projects this order names, by number or quoted project name. */
    registrationNos: jsonb('registration_nos').$type<string[]>().notNull().default([]),
    mentionedNumbers: jsonb('mentioned_numbers').$type<string[]>().notNull().default([]),
    text: text('text'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }),
    error: text('error'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rera_orders_date_idx').on(t.orderDate), index('rera_orders_respondent_idx').on(t.respondentKey)]
);

export type ReraOrderRow = typeof reraOrders.$inferSelect;

// ---------------------------------------------------------------------------
// Buyer accounts: optional WhatsApp login (one-time code sent through Gallabox)
// ---------------------------------------------------------------------------

/** A buyer who logged in with a WhatsApp number. The phone is the identity; there are no passwords. */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(), // E.164, e.g. +919876543210
    name: text('name'),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_phone_idx').on(t.phone)]
);

export type UserRow = typeof users.$inferSelect;

/** One-time login codes. Only a hash is stored; each code has an expiry and an attempt limit. */
export const loginCodes = pgTable(
  'login_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    ip: text('ip'),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('login_codes_phone_idx').on(t.phone, t.createdAt), index('login_codes_ip_idx').on(t.ip, t.createdAt)]
);

/** Buyer sessions. The cookie holds a random token; only its hash is stored. */
export const userSessions = pgTable(
  'user_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('user_sessions_user_idx').on(t.userId)]
);

/** Projects a buyer saved: a TG-RERA record (registration number) or a checked report (project id). */
export const savedProjects = pgTable(
  'saved_projects',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<'rera' | 'project'>().notNull(),
    ref: text('ref').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('saved_projects_pk').on(t.userId, t.kind, t.ref)]
);

/** Correction or takedown requests about a published page, from buyers or builders. Reviewed on the Review Desk. */
export const corrections = pgTable(
  'corrections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pageUrl: text('page_url'),
    fromRole: text('from_role').$type<'buyer' | 'builder' | 'other'>().notNull().default('other'),
    name: text('name'),
    organisation: text('organisation'),
    contact: text('contact').notNull(),
    message: text('message').notNull(),
    status: text('status').$type<'open' | 'resolved'>().notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('corrections_status_idx').on(t.status, t.createdAt)]
);

/** One row per public form submission, used to rate-limit the open endpoints across all app processes. */
export const rateLimitHits = pgTable(
  'rate_limit_hits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bucket: text('bucket').notNull(),
    key: text('key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rate_limit_hits_lookup_idx').on(t.bucket, t.key, t.createdAt)]
);
