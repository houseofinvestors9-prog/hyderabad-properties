import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DB } from '../db/client';
import { reraDocuments, reraRegistry, type PermitFacts } from '../db/schema';
import { sha256 } from './fetcher';

/**
 * Documents a builder uploaded to its TG-RERA project page: building permit or commencement
 * certificate, sanctioned plan, title report, encumbrance, mortgage deed, occupancy certificate.
 *
 * The page lists them with a "View" button that opens a plain GET link
 * (/PrintPreview/GetUserDocumentFileContent?...), the same link any visitor opens. We list every
 * document on each page read, and read the permit, commencement, occupancy and extension documents:
 * the permit is what the brochure is checked against (floors, blocks, site area), and HMDA and GHMC do
 * not publish their permit search on the open internet.
 */

const BASE = 'https://rerait.telangana.gov.in';
const GAP_MS = Number(process.env.RERA_REQUEST_GAP_MS ?? 1500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ListedDocument {
  docId: string;
  section: string;
  name: string;
  kind: (typeof reraDocuments.$inferInsert)['kind'];
  url: string;
}

export function documentKind(name: string): ListedDocument['kind'] {
  const n = name.toLowerCase();
  if (/occupan/.test(n)) return 'occupancy';
  if (/extension/.test(n)) return 'extension';
  if (/commencement|building permit|building permission|proceedings/.test(n)) return 'permit';
  if (/sanctioned|layout plan|approved plan|building plan/.test(n)) return 'plan';
  if (/title|ownership/.test(n)) return 'title';
  if (/encumbrance/.test(n)) return 'encumbrance';
  if (/mortgage/.test(n)) return 'mortgage';
  if (/quarter|progress|architect|engineer|chartered accountant|form 1|form 2|form 3/.test(n)) return 'progress';
  return 'other';
}

function decode(s: string) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse the "Uploaded Documents" tables of a TG-RERA project page. */
export function parseDocumentList(html: string): ListedDocument[] {
  const projectId = html.match(/id="ProjectID"[^>]*value="([^"]*)"/)?.[1] ?? html.match(/value="([^"]*)"[^>]*id="ProjectID"/)?.[1] ?? '';
  const userId = html.match(/var\s+GetUserID\s*=\s*"(\d+)"/)?.[1] ?? '';
  if (!projectId) return [];
  const division = projectId.split('/')[1] ?? '1';
  const out: ListedDocument[] = [];
  const seen = new Set<string>();
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const btn = row.match(/id="btnShow1_(\w+)_(\d+)"[\s\S]*?showFileDoc\(this\)/);
    if (!btn) continue;
    const [, section, docId] = btn;
    if (seen.has(docId)) continue;
    seen.add(docId);
    const name = decode(row.match(/<span title="([^"]*)"/)?.[1] ?? row.match(/name="Doc\.DocumentName"[^>]*value="([^"]*)"/)?.[1] ?? 'Document');
    const q = new URLSearchParams({
      ID: docId,
      Division: division,
      RoleID: '1',
      CurrentUserID: '0',
      CerUserID: userId,
      CerRoleID: '1',
      ProjectId: projectId,
    });
    out.push({ docId, section, name, kind: documentKind(name), url: `${BASE}/PrintPreview/GetUserDocumentFileContent?${q}` });
  }
  return out;
}

/** Upsert the documents listed on a project page. A changed link means a re-upload, so it is read again. */
export async function saveDocumentList(db: DB, registrationNo: string, docs: ListedDocument[]) {
  if (docs.length === 0) return;
  const now = new Date();
  await db
    .insert(reraDocuments)
    .values(docs.map((d) => ({ id: `${registrationNo}:${d.docId}`, registrationNo, ...d, lastSeenAt: now })))
    .onConflictDoUpdate({
      target: reraDocuments.id,
      set: { name: sql`excluded.name`, kind: sql`excluded.kind`, url: sql`excluded.url`, lastSeenAt: now },
    });
}

// ---------------------------------------------------------------------------
// Reading permits
// ---------------------------------------------------------------------------

async function pdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: (Array.isArray(text) ? text.join('\n') : text).slice(0, 200_000), pages: totalPages };
}

async function extractFacts(input: { text: string } | { pdf: Buffer }, docName: string): Promise<PermitFacts> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { betaZodOutputFormat } = await import('@anthropic-ai/sdk/helpers/beta/zod');
  const { z } = await import('zod');
  const Schema = z.object({
    documentType: z.enum(['building_permit', 'commencement', 'occupancy', 'extension', 'other']),
    authority: z.string().nullable(),
    fileNo: z.string().nullable(),
    issuedOn: z.string().nullable(),
    validUntil: z.string().nullable(),
    blocks: z.array(z.object({ name: z.string(), basements: z.number().nullable(), floorsAboveGround: z.number().nullable() })),
    siteAreaSqm: z.number().nullable(),
    units: z.number().nullable(),
    surveyNumbers: z.string().nullable(),
    conditionsOfNote: z.array(z.string()),
  });
  const instructions = [
    `This document was uploaded by a builder to its Telangana RERA project page under "${docName}".`,
    'Fill in only what the document states. Use null when it does not say.',
    '- documentType: building_permit for a building permission letter or proceedings, commencement for a commencement certificate, occupancy for an occupancy certificate, extension for a RERA or permit extension, else other.',
    '- authority: the issuing body (HMDA, GHMC, DTCP, a municipality, TG-RERA).',
    '- issuedOn, validUntil: ISO dates (YYYY-MM-DD).',
    '- blocks: one entry per tower, block or building. floorsAboveGround counts the ground floor plus upper floors (Ground + 50 upper floors = 51); stilt or podium levels count as floors. Ignore clubhouses unless they are the only building.',
    '- siteAreaSqm: the plot or site extent in square metres (convert from sq yards x 0.836 or acres x 4046.86 if that is all it gives).',
    '- conditionsOfNote: up to five short, plain-English conditions a home buyer should know (for example a mortgaged area released only after the occupancy certificate, a road-widening surrender, a lake or nala setback, a pending NOC). Leave empty if none.',
  ].join('\n');
  const content =
    'pdf' in input
      ? [
          { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: input.pdf.toString('base64') } },
          { type: 'text' as const, text: instructions },
        ]
      : [{ type: 'text' as const, text: `${instructions}\n\nDocument text:\n${input.text.slice(0, 40_000)}` }];

  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: process.env.CLAUDE_MODEL ?? 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low', format: betaZodOutputFormat(Schema) },
    // If Claude declines, the API retries on its default fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user', content }],
  });
  if (res.stop_reason === 'refusal') throw new Error(`Claude declined: ${res.stop_details?.category ?? 'unknown'}`);
  if (!res.parsed_output) throw new Error(`No structured output (stop_reason ${res.stop_reason})`);
  return res.parsed_output;
}

export interface DocumentReadResult {
  processed: number;
  read: number;
  errors: number;
  remaining: number;
  sampleErrors: string[];
}

const READ_KINDS = ['permit', 'occupancy', 'extension'] as const;

/** Read due permit, occupancy and extension documents within a time budget. Call until `remaining` is 0. */
export async function readPermitDocuments(db: DB, opts: { budgetMs?: number } = {}): Promise<DocumentReadResult> {
  const budgetMs = opts.budgetMs ?? 45_000;
  const started = Date.now();
  const result: DocumentReadResult = { processed: 0, read: 0, errors: 0, remaining: 0, sampleErrors: [] };
  if (!process.env.ANTHROPIC_API_KEY) {
    result.sampleErrors.push('ANTHROPIC_API_KEY is not set; permits are listed but not read.');
    return result;
  }
  const { getBuffer } = await import('./rera-registry');
  const due = await db
    .select()
    .from(reraDocuments)
    .where(and(inArray(reraDocuments.kind, [...READ_KINDS]), isNull(reraDocuments.readAt)))
    .orderBy(asc(reraDocuments.firstSeenAt));
  for (const doc of due) {
    if (Date.now() - started > budgetMs) break;
    result.processed++;
    try {
      const { body, type } = await getBuffer(doc.url, `${BASE}/PrintPreview/PrintPreview`);
      if (!type.includes('pdf') && !(body[0] === 0x25 && body[1] === 0x50)) throw new Error(`Not a PDF (${type || 'unknown type'})`);
      const hash = sha256(body.toString('base64'));
      const { text, pages } = await pdfText(body);
      // A scanned permit has little or no text layer; send the PDF itself if it is small enough.
      const useText = text.replace(/\s+/g, '').length > 400;
      if (!useText && (body.length > 20_000_000 || pages > 60)) throw new Error('Scanned document too large to read automatically');
      const facts = await extractFacts(useText ? { text } : { pdf: body }, doc.name);
      await db
        .update(reraDocuments)
        .set({ contentHash: hash, pages, textChars: text.length, facts, readAt: new Date(), readError: null })
        .where(eq(reraDocuments.id, doc.id));
      result.read++;
    } catch (err) {
      result.errors++;
      const message = String((err as Error).message ?? err).slice(0, 300);
      if (result.sampleErrors.length < 5) result.sampleErrors.push(`${doc.registrationNo} ${doc.name}: ${message}`);
      await db.update(reraDocuments).set({ readAt: new Date(), readError: message }).where(eq(reraDocuments.id, doc.id));
    }
    await sleep(GAP_MS);
  }
  result.remaining = due.length - result.processed;
  return result;
}

/** Documents for one project, newest first, for the public record page. */
export async function documentsFor(db: DB, registrationNo: string) {
  return db.select().from(reraDocuments).where(eq(reraDocuments.registrationNo, registrationNo)).orderBy(asc(reraDocuments.kind), asc(reraDocuments.name));
}

/**
 * Compare a permit with what the builder filed on TG-RERA. Returns plain-English lines for the
 * record page. Only facts both sources state are compared.
 */
export function compareWithFiling(
  filing: { maxSlabs?: number | null; buildings?: number | null; landAreaSqm?: number | null; planApprovalNo?: string | null },
  permits: PermitFacts[]
): string[] {
  const out: string[] = [];
  const permit = permits.find((p) => p.documentType === 'building_permit' || p.documentType === 'commencement');
  if (!permit) return out;
  const permitMax = Math.max(0, ...permit.blocks.map((b) => b.floorsAboveGround ?? 0));
  if (permitMax && filing.maxSlabs && Math.abs(permitMax - filing.maxSlabs) >= 2) {
    out.push(
      `The uploaded building permit allows up to ${permitMax} floors above ground, but the RERA filing shows ${filing.maxSlabs}. Ask the builder which is current.`
    );
  }
  const permitBlocks = permit.blocks.filter((b) => !/club/i.test(b.name)).length;
  if (permitBlocks && filing.buildings && permitBlocks !== filing.buildings) {
    out.push(`The permit lists ${permitBlocks} residential blocks; the RERA filing lists ${filing.buildings}.`);
  }
  if (permit.siteAreaSqm && filing.landAreaSqm && Math.abs(permit.siteAreaSqm - filing.landAreaSqm) / filing.landAreaSqm > 0.1) {
    out.push(
      `The permit is for ${Math.round(permit.siteAreaSqm).toLocaleString('en-IN')} sq m of land; the RERA filing shows ${Math.round(filing.landAreaSqm).toLocaleString('en-IN')} sq m.`
    );
  }
  const norm = (s: string | null | undefined) => (s ?? '').replace(/[^0-9A-Z]/gi, '').replace(/^0+/, '').toUpperCase();
  if (permit.fileNo && filing.planApprovalNo && norm(permit.fileNo) !== norm(filing.planApprovalNo) && !norm(permit.fileNo).includes(norm(filing.planApprovalNo).slice(0, 8))) {
    out.push(`The permit's file number (${permit.fileNo}) differs from the plan approval number on the RERA filing (${filing.planApprovalNo}).`);
  }
  return out;
}

export { reraRegistry };
