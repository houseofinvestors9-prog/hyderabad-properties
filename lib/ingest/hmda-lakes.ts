import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { DB } from '../db/client';
import { hmdaLakes } from '../db/schema';

/**
 * HMDA Lake Protection Committee list (lakes.hmda.gov.in).
 *
 * The public page lists every notified lake (about 3,000) in one table: district, mandal, village,
 * lake name and ID, notification dates, and buttons for the FTL map, the cadastral map and the list of
 * survey numbers inside the FTL and buffer zone. Each button is a postback that only redirects to a
 * static file under /hmdalake/, and the file names sit in the page's own view state, so one GET gives
 * us every link. No captcha, no form submissions.
 *
 * The survey-number lists are scanned, often handwritten tables. Claude reads them (readSurveyLists),
 * only for lakes in villages where a registered project sits, and every match is shown as
 * "listed by HMDA, check the official map", never as a verdict.
 */

const BASE = 'https://lakes.hmda.gov.in';
const UA =
  process.env.INGEST_USER_AGENT ??
  'Mozilla/5.0 (compatible; hyderabad.properties-verifier/1.0; +https://hyderabad.properties)';
const GAP_MS = Number(process.env.HMDA_REQUEST_GAP_MS ?? 1500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function hmdaPdfUrl(file: string | null | undefined): string | null {
  return file ? `${BASE}/hmdalake/${encodeURIComponent(file)}` : null;
}

function text(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isoDate(s: string): string | null {
  const m = s.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Letters shared in order between two names, as a share of the longer one. Cheap and good enough for picking a file. */
function similarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  const dp = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++)
      dp[i][j] = x[i - 1] === y[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[x.length][y.length] / Math.max(x.length, y.length);
}

export interface HmdaLakeRow {
  lakeId: string;
  name: string;
  district: string | null;
  mandal: string | null;
  village: string | null;
  preliminaryNotified: string | null;
  finalNotified: string | null;
  ftlPdf: string | null;
  cadastralPdf: string | null;
  surveyPdf: string | null;
}

/** Parse the lakes page: table rows plus the PDF file names held in the view state. */
export function parseLakesPage(html: string): HmdaLakeRow[] {
  const vsMatch = html.match(/id="__VIEWSTATE" value="([^"]*)"/);
  const viewState = vsMatch ? Buffer.from(vsMatch[1], 'base64').toString('latin1') : '';
  const files = [...new Set(viewState.match(/[\x20-\x7e]{3,200}?\.pdf/g) ?? [])];

  // File names start with the lake ID ("1025_Erra Cheruvu_SyNo.pdf", "871Yelameru Kunta_FTL.pdf");
  // the view state may put one length byte in front, so allow a match at position 0 or 1.
  function pick(lakeId: string, lakeName: string, suffix: string): string | null {
    const key = lakeId.replace(/\//g, '-');
    let best: { file: string; score: number } | null = null;
    for (const f of files) {
      if (!f.toLowerCase().endsWith(suffix)) continue;
      for (const i of [0, 1]) {
        if (f.slice(i, i + key.length) !== key) continue;
        const next = f[i + key.length];
        if (!next || /[\d/-]/.test(next)) continue;
        const file = f.slice(i);
        const namePart = file.slice(key.length, -suffix.length).replace(/^_/, '');
        const score = similarity(namePart, lakeName);
        if (!best || score > best.score) best = { file, score };
      }
    }
    return best && best.score >= 0.5 ? best.file : null;
  }

  const out: HmdaLakeRow[] = [];
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(text);
    if (cells.length < 11 || !/^\d+$/.test(cells[0])) continue;
    const [, district, mandal, village, name, lakeId, pre, fin] = cells;
    if (!lakeId || !name) continue;
    out.push({
      lakeId,
      name,
      district: district || null,
      mandal: mandal || null,
      village: village || null,
      preliminaryNotified: isoDate(pre),
      finalNotified: isoDate(fin),
      ftlPdf: pick(lakeId, name, '_ftl.pdf'),
      cadastralPdf: pick(lakeId, name, '_cadastral.pdf'),
      surveyPdf: row.includes('btn_bufferzone') ? pick(lakeId, name, '_syno.pdf') : null,
    });
  }
  return out;
}

export interface LakeListResult {
  listed: number;
  added: number;
  withSurveyList: number;
}

/** Refresh the list of notified lakes (one request). Lake IDs repeat across districts, so the key adds the village. */
export async function syncHmdaLakeList(db: DB): Promise<LakeListResult> {
  const res = await fetch(`${BASE}/`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`lakes.hmda.gov.in responded ${res.status}`);
  const rows = parseLakesPage(await res.text());
  if (rows.length < 500) throw new Error(`Only ${rows.length} lakes parsed; the page layout may have changed.`);

  const seen = new Map<string, HmdaLakeRow>();
  for (const r of rows) {
    const key = `${r.lakeId}@${norm(r.village ?? r.mandal ?? '')}`;
    if (!seen.has(key)) seen.set(key, r);
  }
  const existing = new Set((await db.select({ id: hmdaLakes.lakeId }).from(hmdaLakes)).map((r) => r.id));
  const now = new Date();
  let added = 0;
  const values = [...seen.entries()].map(([key, r]) => {
    if (!existing.has(key)) added++;
    return { ...r, lakeId: key, lastSeenAt: now };
  });
  for (let i = 0; i < values.length; i += 200) {
    await db
      .insert(hmdaLakes)
      .values(values.slice(i, i + 200))
      .onConflictDoUpdate({
        target: hmdaLakes.lakeId,
        set: {
          name: sql`excluded.name`,
          district: sql`excluded.district`,
          mandal: sql`excluded.mandal`,
          village: sql`excluded.village`,
          preliminaryNotified: sql`excluded.preliminary_notified`,
          finalNotified: sql`excluded.final_notified`,
          ftlPdf: sql`excluded.ftl_pdf`,
          cadastralPdf: sql`excluded.cadastral_pdf`,
          surveyPdf: sql`excluded.survey_pdf`,
          lastSeenAt: sql`excluded.last_seen_at`,
        },
      });
  }
  return { listed: values.length, added, withSurveyList: values.filter((v) => v.surveyPdf).length };
}

/** HMDA keys look like "1025@gummadidala"; the public ID is the part before "@". */
export function publicLakeId(key: string): string {
  return key.split('@')[0];
}

// ---------------------------------------------------------------------------
// Survey-number lists (scanned PDFs), read by Claude
// ---------------------------------------------------------------------------

export interface SurveyReadResult {
  processed: number;
  read: number;
  errors: number;
  remaining: number;
  sampleErrors: string[];
}

async function readSurveyPdf(pdf: Buffer, lakeName: string) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { betaZodOutputFormat } = await import('@anthropic-ai/sdk/helpers/beta/zod');
  const { z } = await import('zod');
  const Schema = z.object({
    village: z.string().nullable(),
    rows: z.array(
      z.object({
        surveyNumber: z.string(),
        zone: z.enum(['ftl', 'buffer', 'both']).nullable(),
      })
    ),
    legible: z.boolean(),
  });
  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: process.env.CLAUDE_MODEL ?? 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low', format: betaZodOutputFormat(Schema) },
    // If Claude declines, the API retries on its default fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } },
          {
            type: 'text',
            text: [
              `This is an official HMDA statement of revenue survey numbers falling in the FTL area and buffer zone of the lake "${lakeName}". Pages may be rotated and partly handwritten.`,
              'List every survey number in the table exactly as written (keep sub-divisions such as 340/2 or 24A/1). For each, set zone to ftl if it only has FTL extent, buffer if it only has buffer extent, both if it has both, or null if you cannot tell.',
              'Set village to the village named in the heading. Set legible to false if you could not read most of the survey numbers. Do not guess numbers you cannot read; leave them out.',
            ].join('\n'),
          },
        ],
      },
    ],
  });
  if (res.stop_reason === 'refusal') throw new Error(`Claude declined: ${res.stop_details?.category ?? 'unknown'}`);
  if (!res.parsed_output) throw new Error(`No structured output (stop_reason ${res.stop_reason})`);
  return res.parsed_output;
}

/**
 * Read the survey-number PDFs of lakes in the given villages (normalised names), within a time budget.
 * Restricting to villages that have a registered project keeps the reading cost proportional to what we publish.
 */
export async function readSurveyLists(db: DB, villages: string[], opts: { budgetMs?: number } = {}): Promise<SurveyReadResult> {
  const budgetMs = opts.budgetMs ?? 45_000;
  const started = Date.now();
  const result: SurveyReadResult = { processed: 0, read: 0, errors: 0, remaining: 0, sampleErrors: [] };
  if (!process.env.ANTHROPIC_API_KEY) {
    result.sampleErrors.push('ANTHROPIC_API_KEY is not set; survey lists are not read.');
    return result;
  }
  const wanted = new Set(villages.map(norm).filter(Boolean));
  const due = (
    await db
      .select({ lakeId: hmdaLakes.lakeId, name: hmdaLakes.name, village: hmdaLakes.village, surveyPdf: hmdaLakes.surveyPdf })
      .from(hmdaLakes)
      .where(and(isNotNull(hmdaLakes.surveyPdf), isNull(hmdaLakes.surveyReadAt)))
      .orderBy(asc(hmdaLakes.lakeId))
  ).filter((l) => wanted.has(norm(l.village ?? '')));

  for (const lake of due) {
    if (Date.now() - started > budgetMs) break;
    result.processed++;
    try {
      const res = await fetch(hmdaPdfUrl(lake.surveyPdf)!, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`PDF responded ${res.status}`);
      const pdf = Buffer.from(await res.arrayBuffer());
      const parsed = await readSurveyPdf(pdf, lake.name);
      await db
        .update(hmdaLakes)
        .set({
          surveyNumbers: parsed.legible ? parsed.rows.map((r) => ({ number: r.surveyNumber.trim(), zone: r.zone })) : [],
          surveyVillage: parsed.village,
          surveyReadAt: new Date(),
          surveyError: parsed.legible ? null : 'Not legible enough to read reliably; check the PDF by hand.',
        })
        .where(eq(hmdaLakes.lakeId, lake.lakeId));
      result.read++;
    } catch (err) {
      result.errors++;
      const message = String((err as Error).message ?? err).slice(0, 300);
      if (result.sampleErrors.length < 5) result.sampleErrors.push(`${lake.lakeId}: ${message}`);
      await db.update(hmdaLakes).set({ surveyError: message, surveyReadAt: new Date() }).where(eq(hmdaLakes.lakeId, lake.lakeId));
    }
    await sleep(GAP_MS);
  }
  result.remaining = Math.max(0, due.length - result.processed);
  return result;
}

/** Lakes notified in any of these villages (normalised names). */
export async function lakesInVillages(db: DB, villages: string[]) {
  const keys = [...new Set(villages.map(norm).filter(Boolean))];
  if (keys.length === 0) return [];
  const rows = await db.select().from(hmdaLakes).where(inArray(sql`regexp_replace(lower(${hmdaLakes.village}), '[^a-z0-9]', '', 'g')`, keys));
  return rows;
}

export { norm as normalisePlaceName };
