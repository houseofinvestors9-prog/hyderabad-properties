import { z } from 'zod';
import type { DbProjectStatus, DocumentType, ProjectRow, ProposedChanges, SourceId } from '../db/schema';
import { applyChanges, suggestStatus } from '../verdict';

export const DOCUMENT_TYPES = [
  'RERA_QUARTERLY_DISCLOSURE',
  'RERA_REGISTRATION',
  'SANCTION_ORDER',
  'OCCUPANCY_CERTIFICATE',
  'PENALTY_NOTICE',
  'FTL_BUFFER_CHECK',
  'GUIDELINE_RATE',
] as const satisfies readonly DocumentType[];

export const NoticeAnalysisSchema = z.object({
  projectId: z.string(),
  documentType: z.enum(DOCUMENT_TYPES),
  rawTitle: z.string(),
  whatChanged: z.string().min(5),
  whatItMeans: z.string().min(5),
  recommendedStatus: z.enum(['verified', 'caution', 'risk']),
  confidenceScore: z.number().min(0).max(1),
  eventDate: z.string().nullable().optional(),
  extractedData: z
    .object({
      reraStatus: z.enum(['Active', 'Pending', 'Not Found']).nullable().optional(),
      reraValidUntil: z.string().nullable().optional(),
      escrowAccount: z.string().nullable().optional(),
      lastQprFiled: z.string().nullable().optional(),
      buildingPlan: z.enum(['Approved', 'Pending']).nullable().optional(),
      permitNo: z.string().nullable().optional(),
      sanctionedFloors: z.number().int().nullable().optional(),
      sanctionedConfig: z.string().nullable().optional(),
      ocStatus: z.enum(['Issued', 'Applied', 'Not applied']).nullable().optional(),
      bufferClear: z.boolean().nullable().optional(),
      nearestLakeMeters: z.number().nullable().optional(),
      penaltyAmountInr: z.number().nullable().optional(),
    })
    .default({}),
});

export type NoticeAnalysis = z.infer<typeof NoticeAnalysisSchema>;

export interface AnalyzeInput {
  project: ProjectRow;
  rawTitle: string;
  rawText: string;
  sourceHint?: SourceId;
}

export interface AnalyzeResult {
  analysis: NoticeAnalysis;
  proposedChanges: ProposedChanges;
  analyzer: 'claude' | 'rules';
}

/** True when an Anthropic API key is configured for the AI reader. */
export function claudeEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** House voice: no dashes, no trade jargon. */
export function cleanCopy(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\bbrokerage\b/gi, 'advisory')
    .replace(/\bbroker\b/gi, 'advisor')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Shape Claude must return (structured outputs). Every field is required and nullable so the
 * constrained decoder accepts it; NoticeAnalysisSchema then applies the real limits.
 */
const ClaudeNoticeSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  rawTitle: z.string(),
  whatChanged: z.string().describe('One factual sentence on what changed in the record.'),
  whatItMeans: z.string().describe('One or two plain-English sentences on what this means for a home buyer.'),
  recommendedStatus: z.enum(['verified', 'caution', 'risk']),
  confidenceScore: z.number().describe('0 to 1'),
  eventDate: z.string().nullable().describe('ISO date (YYYY-MM-DD) of the order or disclosure, if stated.'),
  extractedData: z.object({
    reraStatus: z.enum(['Active', 'Pending', 'Not Found']).nullable(),
    reraValidUntil: z.string().nullable().describe('ISO date'),
    escrowAccount: z.string().nullable(),
    lastQprFiled: z.string().nullable(),
    buildingPlan: z.enum(['Approved', 'Pending']).nullable(),
    permitNo: z.string().nullable(),
    sanctionedFloors: z.number().int().nullable().describe('Total floors above ground including ground floor.'),
    sanctionedConfig: z.string().nullable().describe('Format like 2B+G+34'),
    ocStatus: z.enum(['Issued', 'Applied', 'Not applied']).nullable(),
    bufferClear: z.boolean().nullable(),
    nearestLakeMeters: z.number().nullable(),
    penaltyAmountInr: z.number().nullable(),
  }),
});

function currentFacts(p: ProjectRow) {
  return {
    name: p.name,
    reraId: p.reraId,
    reraStatus: p.reraStatus,
    reraValidUntil: p.reraValidUntil,
    buildingPlan: p.buildingPlan,
    permitNo: p.permitNo,
    sanctionedConfig: p.sanctionedConfig,
    sanctionedFloors: p.sanctionedFloors,
    ocStatus: p.ocStatus,
    lakeBuffer: p.lakeBuffer,
    status: p.status,
  };
}

async function analyzeWithClaude(input: AnalyzeInput): Promise<NoticeAnalysis> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { betaZodOutputFormat } = await import('@anthropic-ai/sdk/helpers/beta/zod');
  const client = new Anthropic();
  const prompt = [
    'You are the regulatory desk of hyderabad.properties, an independent property safety service for Hyderabad home buyers and NRIs.',
    'Read the government record below (TG-RERA, TS-bPASS / HMDA / GHMC, HYDRAA lake FTL, or IGR) and fill in the structured analysis.',
    'Rules:',
    '- whatChanged: one factual sentence. Quote order numbers, dates and amounts exactly as written. No speculation.',
    '- whatItMeans: plain English for a first-time buyer. No legal or sales jargon. No dashes. Never use the words broker or brokerage.',
    '- recommendedStatus: verified only if RERA is active, the plan is sanctioned and the site is outside any lake buffer. caution for pending approvals, lapsed validity, penalties or show-cause notices. risk for buffer overlap, missing registration or demolition orders.',
    '- extractedData: only fill fields the document actually states. Use null otherwise.',
    '- confidenceScore: how sure you are that the document refers to this project and that your extraction is correct.',
    '',
    `projectId: ${input.project.id}`,
    `Current live record: ${JSON.stringify(currentFacts(input.project))}`,
    `Source: ${input.sourceHint ?? 'unknown'}`,
    `Document title: ${input.rawTitle}`,
    'Document text:',
    input.rawText.slice(0, 60_000),
  ].join('\n');

  const res = await client.beta.messages.parse({
    model: process.env.CLAUDE_MODEL ?? 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'medium', format: betaZodOutputFormat(ClaudeNoticeSchema) },
    // If Claude declines, the API retries on its default fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user', content: prompt }],
  });
  if (res.stop_reason === 'refusal') throw new Error(`Claude declined: ${res.stop_details?.category ?? 'unknown'}`);
  if (!res.parsed_output) throw new Error(`No structured output (stop_reason ${res.stop_reason})`);
  const parsed = NoticeAnalysisSchema.parse({ ...res.parsed_output, projectId: input.project.id });
  return parsed;
}

// ---------------------------------------------------------------------------
// Deterministic fallback, used when ANTHROPIC_API_KEY is absent or the call fails.
// ---------------------------------------------------------------------------

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

export function parseIndianDate(s: string): string | null {
  let m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  return null;
}

function parseRupees(s: string): number | null {
  const m = s.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d+)?)\s*(lakh|lakhs|crore|cr)?/i);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ''));
  const unit = m[2]?.toLowerCase();
  if (unit?.startsWith('lakh')) n *= 100_000;
  if (unit === 'crore' || unit === 'cr') n *= 10_000_000;
  return Math.round(n);
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export function analyzeWithRules(input: AnalyzeInput): NoticeAnalysis {
  const text = `${input.rawTitle}\n${input.rawText}`;
  const lower = text.toLowerCase();
  const body = input.rawText.toLowerCase(); // decisions are read from the document body, never the title we generated
  const p = input.project;
  const ex: NoticeAnalysis['extractedData'] = {};
  let documentType: DocumentType = 'RERA_QUARTERLY_DISCLOSURE';
  let whatChanged = '';
  let whatItMeans = '';
  let confidence = 0.62;

  const config = text.match(/\b(\d?B\s*\+\s*(?:G|S)\s*\+\s*\d{1,2})\b/i);
  if (config) {
    ex.sanctionedConfig = config[1].replace(/\s+/g, '').toUpperCase();
    const top = Number(config[1].split('+').pop());
    ex.sanctionedFloors = top + 1;
  }
  const permit = text.match(/(?:permit|permission|B\.?P\.?)\s*(?:order)?\s*(?:no\.?|number)\s*[:\-]?\s*([A-Z0-9/\-]{6,})/i);
  if (permit) ex.permitNo = permit[1];
  const validity = text.match(/valid(?:ity)?\s*(?:up\s*to|upto|till|until|extended\s*(?:up\s*)?to)\s*[:\-]?\s*([0-9A-Za-z ,./-]{8,20})/i);
  const validDate = validity ? parseIndianDate(validity[1]) : null;
  const eventDate = parseIndianDate(text);

  if (/penalt|show.?cause|fine of|levied/.test(lower)) {
    documentType = 'PENALTY_NOTICE';
    const amt = parseRupees(text);
    if (amt) ex.penaltyAmountInr = amt;
    const reason = /quarterly|qpr|progress report/.test(lower)
      ? 'late quarterly progress filing'
      : /advertis/.test(lower)
      ? 'advertising without registration details'
      : /escrow|70%|withdraw/.test(lower)
      ? 'escrow withdrawal irregularities'
      : 'non-compliance';
    whatChanged = `TG-RERA issued a ${/show.?cause/.test(lower) ? 'show-cause notice' : 'penalty'}${amt ? ` of ${formatInr(amt)}` : ''} on ${p.name} for ${reason}.`;
    whatItMeans = /escrow|withdraw/.test(lower)
      ? 'The regulator is questioning how buyer money is being used. Ask the builder for the latest escrow statement before paying the next instalment.'
      : 'This is a compliance mark on the builder, not a cancellation. Approvals stand, but ask for proof the penalty has been paid and filings are current.';
    confidence = 0.7;
  } else if (/occupancy certificate|\boc\b issued|occupancy\s+granted/.test(lower)) {
    documentType = 'OCCUPANCY_CERTIFICATE';
    ex.ocStatus = /appl(ied|ication)/.test(lower) && !/issued|granted/.test(lower) ? 'Applied' : 'Issued';
    whatChanged = ex.ocStatus === 'Issued' ? `The municipal authority issued the occupancy certificate for ${p.name}.` : `${p.name} has applied for its occupancy certificate.`;
    whatItMeans = ex.ocStatus === 'Issued'
      ? 'The building passed final inspection. Water, power and registration can proceed in your name.'
      : 'The builder says construction is complete. Wait for the certificate before taking possession.';
    confidence = 0.72;
  } else if (/full tank level|\bftl\b|buffer|hydraa|water ?body|nala/.test(lower)) {
    documentType = 'FTL_BUFFER_CHECK';
    const inside = /(inside|within|encroach|overlap|falls in)/.test(lower) && !/(outside|no overlap|clear of|beyond)/.test(lower);
    ex.bufferClear = !inside;
    const meters = text.match(/(\d{1,4})\s*(?:m|metres|meters)\b/i);
    if (meters) ex.nearestLakeMeters = Number(meters[1]);
    whatChanged = inside
      ? `Survey overlay shows part of ${p.name} inside the lake FTL or its 30 metre buffer.`
      : `Survey overlay confirms ${p.name} sits outside the lake FTL and its 30 metre buffer.`;
    whatItMeans = inside
      ? 'Buildings inside a lake buffer cannot be regularised and face demolition. Do not pay any advance until this is cleared in writing.'
      : 'No lake or stormwater conflict on the plot. One major demolition risk is ruled out.';
    confidence = 0.66;
  } else if (
    /(building permi(t|ssion)|sanction(ed)? (order|plan)|permit order)/.test(body) &&
    /(sanctioned|granted|approved|issued|reject|refus|revoked|cancel|pending|under scrutiny|shortfall|awaiting)/.test(body)
  ) {
    documentType = 'SANCTION_ORDER';
    const rejected = /(reject|refus|revoked|cancel)/.test(body);
    const pending = /(pending|under scrutiny|shortfall|awaiting)/.test(body);
    ex.buildingPlan = rejected || pending ? 'Pending' : 'Approved';
    whatChanged = rejected
      ? `The building permission application for ${p.name} was rejected or revoked.`
      : pending
      ? `The revised building permission for ${p.name} is still pending.`
      : `Building permission${ex.permitNo ? ` ${ex.permitNo}` : ''} was granted for ${p.name}${ex.sanctionedConfig ? ` at ${ex.sanctionedConfig}` : ''}.`;
    whatItMeans = ex.buildingPlan === 'Approved'
      ? `Floors up to the sanctioned count are legally cleared. Check that your flat sits within ${ex.sanctionedConfig ?? 'the sanctioned floors'}.`
      : 'Some or all floors do not have final permission yet. Avoid units on unsanctioned floors.';
    confidence = 0.68;
  } else if (/lapse|expired|revok|de-?register/.test(lower)) {
    documentType = 'RERA_REGISTRATION';
    ex.reraStatus = /revok|de-?register|not found/.test(lower) ? 'Not Found' : 'Pending';
    whatChanged = `TG-RERA registration for ${p.name} (${p.reraId}) ${ex.reraStatus === 'Not Found' ? 'was revoked' : 'has lapsed and is awaiting extension'}.`;
    whatItMeans = 'Sale agreements should not be registered until the registration is restored. Pause payments and ask for the extension order.';
    confidence = 0.7;
  } else if (/extension|extended|registration certificate|form.?c\b/.test(lower)) {
    documentType = 'RERA_REGISTRATION';
    ex.reraStatus = 'Active';
    if (validDate) ex.reraValidUntil = validDate;
    whatChanged = `TG-RERA ${/extension|extended/.test(lower) ? 'extended' : 'confirmed'} the registration of ${p.name}${validDate ? ` until ${prettyDate(validDate)}` : ''}.`;
    whatItMeans = 'The project is legally allowed to sell and build. Track the new completion date against your agreement.';
    confidence = 0.7;
  } else if (!/(quarterly|\bqpr\b|progress report|form.?b\b)/.test(body)) {
    documentType = 'RERA_QUARTERLY_DISCLOSURE';
    whatChanged = `The ${input.sourceHint === 'TS_BPASS' ? 'TS-bPASS' : 'TG-RERA'} record for ${p.name} changed, but no decisive order was found in the text.`;
    whatItMeans = 'Nothing for buyers yet. A reviewer should read the excerpt before anything is published.';
    confidence = 0.3;
  } else {
    documentType = 'RERA_QUARTERLY_DISCLOSURE';
    const q = text.match(/\bQ([1-4])\s*(?:of\s*)?(?:FY\s*)?(\d{4}(?:-\d{2,4})?)/i);
    if (q) ex.lastQprFiled = `Q${q[1]} FY${q[2]}`;
    const pct = text.match(/(\d{1,3})\s*%\s*(?:of\s+)?(?:construction|work|progress|complete)/i);
    whatChanged = `${p.name} filed its quarterly progress report${ex.lastQprFiled ? ` for ${ex.lastQprFiled}` : ''}${pct ? `, reporting ${pct[1]}% construction progress` : ''}.`;
    whatItMeans = 'Routine disclosure. The builder is keeping the regulator updated, which is what you want to see.';
    confidence = 0.55;
  }

  if (validDate && !ex.reraValidUntil && documentType.startsWith('RERA')) ex.reraValidUntil = validDate;
  const escrow = text.match(/escrow[^.\n]{0,40}?(?:a\/c|account)\s*(?:no\.?)?\s*[:\-]?\s*[X*\d ]*?(\d{4})\b/i);
  if (escrow) ex.escrowAccount = `Escrow A/c ending ${escrow[1]}`;

  const changes = extractedToChanges(ex, p, documentType);
  const recommendedStatus = suggestStatus(applyChanges(p, changes));

  return {
    projectId: p.id,
    documentType,
    rawTitle: input.rawTitle,
    whatChanged,
    whatItMeans,
    recommendedStatus,
    confidenceScore: confidence,
    eventDate,
    extractedData: ex,
  };
}

/** Turn extracted data into field changes, keeping only values that differ from the live record. */
export function extractedToChanges(ex: NoticeAnalysis['extractedData'], p: ProjectRow, documentType: DocumentType): ProposedChanges {
  const c: ProposedChanges = {};
  if (ex.reraStatus && ex.reraStatus !== p.reraStatus) c.reraStatus = ex.reraStatus;
  if (ex.reraValidUntil && ex.reraValidUntil !== p.reraValidUntil) c.reraValidUntil = ex.reraValidUntil;
  if (ex.escrowAccount && ex.escrowAccount !== p.escrowAccount) c.escrowAccount = ex.escrowAccount;
  if (ex.lastQprFiled && ex.lastQprFiled !== p.lastQprFiled) c.lastQprFiled = ex.lastQprFiled;
  if (ex.buildingPlan && ex.buildingPlan !== p.buildingPlan) c.buildingPlan = ex.buildingPlan;
  if (ex.permitNo && ex.permitNo !== p.permitNo) c.permitNo = ex.permitNo;
  if (ex.sanctionedFloors && ex.sanctionedFloors !== p.sanctionedFloors) c.sanctionedFloors = ex.sanctionedFloors;
  if (ex.sanctionedConfig && ex.sanctionedConfig !== p.sanctionedConfig) c.sanctionedConfig = ex.sanctionedConfig;
  if (ex.ocStatus && ex.ocStatus !== p.ocStatus) c.ocStatus = ex.ocStatus;
  if (ex.bufferClear !== undefined && ex.bufferClear !== null) {
    const lb = ex.bufferClear ? 'Clear' : 'Inside buffer zone';
    if (lb !== p.lakeBuffer) c.lakeBuffer = lb;
  }
  if (ex.nearestLakeMeters != null && ex.nearestLakeMeters !== p.nearestLakeMeters) c.nearestLakeMeters = Math.round(ex.nearestLakeMeters);
  if (documentType === 'PENALTY_NOTICE') {
    c.addKeyConcern = ex.penaltyAmountInr
      ? `TG-RERA penalty of ${formatInr(ex.penaltyAmountInr)} on record`
      : 'Open TG-RERA penalty or show-cause notice on record';
  }
  return c;
}

export async function analyzeNotice(input: AnalyzeInput): Promise<AnalyzeResult> {
  let analysis: NoticeAnalysis;
  let analyzer: 'claude' | 'rules' = 'rules';
  if (claudeEnabled() && process.env.AI_ANALYZER !== 'rules') {
    try {
      analysis = await analyzeWithClaude(input);
      analyzer = 'claude';
    } catch (err) {
      console.error('[analyze-notice] Claude failed, using rules fallback:', err);
      analysis = analyzeWithRules(input);
    }
  } else {
    analysis = analyzeWithRules(input);
  }

  analysis.whatChanged = cleanCopy(analysis.whatChanged);
  analysis.whatItMeans = cleanCopy(analysis.whatItMeans);
  const proposedChanges = extractedToChanges(analysis.extractedData, input.project, analysis.documentType);

  // The model can be optimistic; never recommend a status better than the deterministic floor.
  const floor = suggestStatus(applyChanges(input.project, proposedChanges));
  const rank: Record<DbProjectStatus, number> = { risk: 0, caution: 1, verified: 2 };
  if (rank[analysis.recommendedStatus] > rank[floor]) analysis.recommendedStatus = floor;

  return { analysis, proposedChanges, analyzer };
}
