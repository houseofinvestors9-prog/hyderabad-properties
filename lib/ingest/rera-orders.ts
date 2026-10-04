import { eq, inArray, isNull, or } from 'drizzle-orm';
import type { DB } from '../db/client';
import { enqueuePendingUpdate } from '../data/repo';
import { analyzeNotice } from '../ai/analyze-notice';
import { projects, reraOrders, reraRegistry, type ReraOrderRow } from '../db/schema';
import { sha256 } from './fetcher';

/**
 * TG-RERA orders and public notices.
 *
 * Two public lists on rera.telangana.gov.in (no captcha): suo motu and penalty orders, and public notices
 * (notices to allottees, rejected registrations). Each row links a PDF. We read the PDF text, pull the case
 * number, penalty amount, RERA numbers and quoted project names, and match the order to registered projects
 * and to the builder. Orders against individuals are kept but never show the person's name.
 */

const SITE = 'https://rera.telangana.gov.in';
const LISTINGS: { listing: ReraOrderRow['listing']; url: string }[] = [
  { listing: 'orders', url: `${SITE}/SUOMOTU-TG-RERA-15121976ORDERS` },
  { listing: 'public_notices', url: `${SITE}/PublicNoticesReports-TG-RERA-15121976PublicNotices_Reports` },
];
const UA =
  process.env.INGEST_USER_AGENT ??
  'Mozilla/5.0 (compatible; hyderabad.properties-verifier/1.0; +https://hyderabad.properties)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchBuf(url: string): Promise<{ type: string; buf: Uint8Array }> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8' },
    signal: AbortSignal.timeout(45_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${url.split('?')[0]} responded ${res.status}`);
  return { type: res.headers.get('content-type') ?? '', buf: new Uint8Array(await res.arrayBuffer()) };
}

function cell(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '');
}

function isoDate(s: string | null | undefined): string | null {
  const m = s?.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

interface ListedOrder {
  id: string;
  listing: ReraOrderRow['listing'];
  title: string;
  orderDate: string | null;
  pdfUrl: string;
}

export function parseListing(html: string, listing: ReraOrderRow['listing']): ListedOrder[] {
  const body = html.match(/id="pdflistgrid"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  const out: ListedOrder[] = [];
  for (const tr of body.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const tds = [...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    const href = tr[0].match(/href="([^"]*ShowPdf\?pdffilename=([^"&]+))"/i);
    if (tds.length < 3 || !href) continue;
    out.push({
      id: href[2],
      listing,
      title: cell(tds[1]),
      orderDate: isoDate(cell(tds[2])),
      pdfUrl: new URL(href[1], SITE).toString(),
    });
  }
  return out;
}

const ORG = /\b(m\/s|pvt|private|limited|ltd|llp|constructions?|developers?|builders?|infra\w*|projects?|properties|estates?|homes|realty|realtors|ventures?|group|groups|society|holdings|corporation|company|associates|enterprises|capital|housing|avenues?|spaces?|solutions)\b/i;
const SUFFIX = /\b(m\/s\.?|pvt\.?|private|limited|ltd\.?|llp|india|company|co\.?|the)\b/gi;

/** Comparable builder name: "M/s My Home Constructions Pvt. Ltd." -> "my home constructions". */
export function builderKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const k = name
    .toLowerCase()
    .replace(SUFFIX, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return k.length >= 3 ? k : null;
}

function kindOf(title: string, listing: ReraOrderRow['listing']): ReraOrderRow['kind'] {
  if (/suo\s*-?\s*motu/i.test(title)) return 'suo_motu';
  if (/penal/i.test(title)) return 'penalty';
  if (/reject/i.test(title)) return 'rejection';
  if (listing === 'public_notices' || /notice/i.test(title)) return 'notice';
  return 'other';
}

/** "Suo Motu order on M/s Prestige Estates Projects Limited" -> "Prestige Estates Projects Limited", companies only. */
export function respondentFrom(title: string): string | null {
  if (/attention of|rejection of application/i.test(title)) return null;
  const m = title.match(/\b(?:on|of|against|for allottees of)\s+(?:m\/s\.?\s*)?(.+)$/i);
  if (!m) return null;
  const name = m[1].replace(/^(the\s+)?attention of.*$/i, '').trim();
  if (!name || /^case no/i.test(name)) return null;
  return ORG.test(title) ? name.replace(/\.$/, '') : null;
}

const AMOUNT = String.raw`(?:Rs\.?|₹|INR)\s*([\d,]{4,}(?:\.\d+)?)`;

/**
 * Penalties as the order states them. Only two wordings count: "(consolidated) penalty of ₹X" and
 * "liable for penalty under Section N … Accordingly, ₹X". Payment receipts, project costs and "up to 5%"
 * ceilings are ignored. A stated consolidated total wins; otherwise each distinct amount is kept, not summed.
 */
export function parsePenalties(text: string): { total: number | null; amounts: number[] } {
  const t = text.replace(/\s+/g, ' ').replace(/Page \d+ of \d+/gi, ' ');
  const toNum = (s: string) => Math.round(Number(s.replace(/,/g, '')));
  let consolidated: number | null = null;
  const amounts: number[] = [];
  const add = (n: number) => {
    if (Number.isFinite(n) && n >= 1000 && !amounts.includes(n)) amounts.push(n);
  };
  for (const m of t.matchAll(new RegExp(String.raw`(consolidated\s+)?penalty\s+of\s+` + AMOUNT, 'gi'))) {
    const n = toNum(m[2]);
    if (m[1]) consolidated = n;
    else add(n);
  }
  for (const m of t.matchAll(new RegExp(String.raw`liable for (?:a )?penalty under Sections?[^.]{0,80}\.\s*Accordingly,\s*` + AMOUNT, 'gi'))) {
    add(toNum(m[1]));
  }
  if (consolidated) return { total: consolidated, amounts: amounts.length ? amounts : [consolidated] };
  return { total: amounts.length === 1 ? amounts[0] : null, amounts };
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

async function readPdf(url: string): Promise<string> {
  const { buf, type } = await fetchBuf(url);
  if (!type.includes('pdf') && !(buf[0] === 0x25 && buf[1] === 0x50)) throw new Error(`Not a PDF (${type || 'unknown type'})`);
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join('\n') : text).slice(0, 400_000);
}

interface Matchable {
  registrationNo: string;
  applicationNo: string | null;
  name: string;
  promoter: string | null;
}

/**
 * Projects an order cites, by TG-RERA registration or certificate number only. We do not link orders to
 * projects by name or by builder: that would be our inference, not the regulator's.
 */
export function matchOrder(text: string, _respondentKey: string | null, registry: Matchable[]) {
  const numbers = [...new Set([...text.matchAll(/\b(P0\d{9,12}|REA0\d{9,12})\b/g)].map((m) => m[1]))];
  const byNumber = registry.filter((r) => numbers.includes(r.registrationNo) || (r.applicationNo && numbers.includes(r.applicationNo)));
  return { numbers, regNos: [...new Set(byNumber.map((r) => r.registrationNo))] };
}

export interface OrdersResult {
  listed: number;
  added: number;
  read: number;
  errors: number;
  matchedProjects: number;
  queuedForReview: number;
  remaining: number;
  rematched: number;
  sampleErrors: string[];
}

/** Refresh both lists, then read new PDFs until the time budget runs out. Call again while `remaining` > 0. */
export async function syncReraOrders(db: DB, opts: { budgetMs?: number } = {}): Promise<OrdersResult> {
  const budget = opts.budgetMs ?? 45_000;
  const started = Date.now();
  const out: OrdersResult = { listed: 0, added: 0, read: 0, errors: 0, matchedProjects: 0, queuedForReview: 0, remaining: 0, rematched: 0, sampleErrors: [] };

  for (const l of LISTINGS) {
    const { buf } = await fetchBuf(l.url);
    const rows = parseListing(Buffer.from(buf).toString('utf8'), l.listing);
    out.listed += rows.length;
    for (const r of rows) {
      const respondent = respondentFrom(r.title);
      const inserted = await db
        .insert(reraOrders)
        .values({
          ...r,
          kind: kindOf(r.title, r.listing),
          respondent,
          respondentKey: builderKey(respondent),
        })
        .onConflictDoNothing()
        .returning({ id: reraOrders.id });
      out.added += inserted.length;
    }
    await sleep(1000);
  }

  const due = await db.select().from(reraOrders).where(isNull(reraOrders.fetchedAt));
  const registry = await db
    .select({ registrationNo: reraRegistry.registrationNo, applicationNo: reraRegistry.applicationNo, name: reraRegistry.name, promoter: reraRegistry.promoter, projectId: reraRegistry.projectId })
    .from(reraRegistry);

  for (const o of due) {
    if (Date.now() - started > budget - 10_000) break;
    try {
      const text = await readPdf(o.pdfUrl);
      const caseNo = text.match(/(?:SUO\s*MOTU\s*)?CASE\s*NO\.?\s*:?\s*([A-Z0-9/ .-]{3,30}?\d{4})/i)?.[1]?.trim() ?? null;
      const { numbers, regNos } = matchOrder(text, o.respondentKey, registry);
      const penalties = parsePenalties(text);
      await db
        .update(reraOrders)
        .set({
          text,
          caseNo,
          penaltyInr: penalties.total,
          penaltiesInr: penalties.amounts,
          mentionedNumbers: numbers,
          registrationNos: regNos,
          fetchedAt: new Date(),
          error: null,
        })
        .where(eq(reraOrders.id, o.id));
      out.read++;
      out.matchedProjects += regNos.length;
      out.queuedForReview += await queueForCheckedProjects(db, { ...o, text }, numbers, regNos, registry);
    } catch (err) {
      out.errors++;
      const msg = String((err as Error).message ?? err).slice(0, 200);
      if (out.sampleErrors.length < 5) out.sampleErrors.push(`${o.id} ${msg}`);
      // Mark as read with the error so a broken PDF does not block the queue; retried when the error is cleared.
      await db.update(reraOrders).set({ error: msg, fetchedAt: new Date() }).where(eq(reraOrders.id, o.id));
    }
    await sleep(1500);
  }

  out.remaining = (await db.select({ id: reraOrders.id }).from(reraOrders).where(isNull(reraOrders.fetchedAt))).length;

  // Re-match every read order: the registry grows and gains promoter names after orders were first read.
  if (out.remaining === 0 && Date.now() - started < budget - 5_000) {
    const read = await db.select({ id: reraOrders.id, text: reraOrders.text, respondentKey: reraOrders.respondentKey, registrationNos: reraOrders.registrationNos }).from(reraOrders);
    for (const o of read) {
      if (!o.text) continue;
      const { numbers, regNos } = matchOrder(o.text, o.respondentKey, registry);
      if (JSON.stringify(regNos) !== JSON.stringify(o.registrationNos)) {
        await db.update(reraOrders).set({ registrationNos: regNos, mentionedNumbers: numbers }).where(eq(reraOrders.id, o.id));
        out.rematched++;
      }
    }
  }
  return out;
}

/** Orders naming a project we have already checked go to the Review Desk, like any other notice. */
async function queueForCheckedProjects(
  db: DB,
  order: ReraOrderRow & { text: string },
  numbers: string[],
  regNos: string[],
  registry: { registrationNo: string; projectId: string | null }[]
): Promise<number> {
  const linked = registry.filter((r) => regNos.includes(r.registrationNo) && r.projectId).map((r) => r.projectId!);
  const checked = await db
    .select()
    .from(projects)
    .where(or(numbers.length ? inArray(projects.reraId, numbers) : undefined, linked.length ? inArray(projects.id, linked) : undefined) ?? eq(projects.id, '__none__'));
  let queued = 0;
  for (const project of checked) {
    const { analysis, proposedChanges, analyzer } = await analyzeNotice({ project, rawTitle: order.title, rawText: order.text, sourceHint: 'TG_RERA' });
    const row = await enqueuePendingUpdate(
      {
        targetType: 'project',
        projectId: project.id,
        source: 'TG_RERA',
        documentType: analysis.documentType,
        sourceUrl: order.pdfUrl,
        rawTitle: order.title,
        rawPayload: { excerpt: order.text.slice(0, 4000), eventDate: order.orderDate, analysis },
        contentHash: sha256(`TG_RERA_ORDER:${order.id}:${project.id}`),
        proposedChanges,
        whatChanged: analysis.whatChanged,
        whatItMeans: analysis.whatItMeans,
        recommendedStatus: analysis.recommendedStatus,
        confidenceScore: analysis.confidenceScore,
        analyzer,
      },
      db
    );
    if (row) queued++;
  }
  return queued;
}
