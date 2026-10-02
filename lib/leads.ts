import { eq } from 'drizzle-orm';
import { getDb } from './db/client';
import { leads, type LeadSource } from './db/schema';

export interface LeadInput {
  source: LeadSource;
  name?: string;
  email?: string;
  phone?: string;
  projectId?: string;
  projectName?: string;
  preferences?: Record<string, unknown>;
  message?: string;
  slot?: string;
  pagePath?: string;
  utm?: Record<string, string>;
  consent: boolean;
}

const SOURCE_LABEL: Record<LeadInput['source'], string> = {
  booking: 'expert call booking',
  shortlist: 'shortlist request',
  report: 'free check request',
  concierge: 'assistant chat',
  newsletter: 'newsletter',
  project_request: 'missing project request',
};

/**
 * Body for the CRM, shaped for the House of Investors Lead Engine's hyderabad.properties door
 * (https://hoi-lead-flow.base44.app/functions/webhookHP). It reads flat fields:
 * name, phone, email, message, page, form, utm_*, gclid. Our own project ids mean
 * nothing there, so the project goes in the message, never in project_id.
 * Any other webhook (Zapier, Make) gets the same flat body plus the original fields.
 */
export function crmBody(id: string, createdAt: string, input: LeadInput) {
  const prefs = input.preferences
    ? Object.entries(input.preferences)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(', ')
    : '';
  const message = [
    `hyderabad.properties ${SOURCE_LABEL[input.source]}`,
    input.projectName && `Project: ${input.projectName}`,
    input.slot && `Call slot: ${input.slot}`,
    prefs && `Answers: ${prefs}`,
    input.message,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    // Flat fields the Lead Engine reads
    name: input.name,
    phone: input.phone,
    email: input.email,
    message,
    page: `hyderabad.properties${input.pagePath ?? ''}`,
    form: `hyderabad.properties: ${SOURCE_LABEL[input.source]}`,
    ...(input.utm ?? {}),
    // Kept for other webhooks and for tracing back to our leads table
    site: 'hyderabad.properties',
    hp_lead_id: id,
    hp_created_at: createdAt,
    hp_source: input.source,
    hp_project_id: input.projectId,
    hp_project_name: input.projectName,
  };
}

/**
 * Forward a lead to the CRM. LEAD_WEBHOOK_URL can be the Lead Engine door above or
 * any HTTPS endpoint. Without it the lead is only stored here, so forms work end to
 * end in development.
 *
 * Leads without a phone number are kept here and not forwarded: the Lead Engine
 * cannot put a lead on the calling rota without one and would only park it for review.
 */
async function forwardLead(id: string, createdAt: string, input: LeadInput): Promise<'sent' | 'logged'> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url || !input.phone) return 'logged';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.LEAD_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.LEAD_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify(crmBody(id, createdAt, input)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Lead webhook ${res.status}: ${(await res.text()).slice(0, 200)}`);
  // The Lead Engine answers 200 even when it parks a payload, and says so in the body.
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (body && body.ok === false) throw new Error(`Lead webhook queued for review: ${body.error ?? 'unknown reason'}`);
  return 'sent';
}

/** Store the lead first, then try to forward it. A failed forward never loses the lead. */
export async function captureLead(input: LeadInput) {
  const db = await getDb();
  const [row] = await db.insert(leads).values(input).returning();

  try {
    const status = await forwardLead(row.id, row.createdAt.toISOString(), input);
    await db.update(leads).set({ forwardStatus: status }).where(eq(leads.id, row.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[leads] forward failed', row.id, message);
    await db.update(leads).set({ forwardStatus: 'failed', forwardError: message }).where(eq(leads.id, row.id));
  }

  return row.id;
}
