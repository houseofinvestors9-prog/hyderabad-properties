import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureLead } from '@/lib/leads';
import { badRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const Body = z
  .object({
    source: z.enum(['booking', 'shortlist', 'report', 'concierge', 'newsletter']),
    name: optionalText(120),
    email: optionalText(160),
    phone: optionalText(24),
    projectId: optionalText(120),
    projectName: optionalText(160),
    preferences: z.record(z.string(), z.unknown()).optional(),
    message: optionalText(2000),
    slot: optionalText(120),
    pagePath: optionalText(300),
    utm: z.record(z.string(), z.string().max(200)).optional(),
    consent: z.literal(true, { message: 'Please agree to be contacted.' }),
    // Honeypot: real people never fill this hidden field.
    website: z.string().max(0).optional(),
  })
  .refine((b) => b.email || b.phone, { message: 'Add an email or a phone number.' });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s-]{8,18}$/;

/** POST /api/leads: someone asked for a call, a shortlist or a full report. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Invalid request';
    return badRequest(first, parsed.error.flatten());
  }
  const { website: _honeypot, ...lead } = parsed.data;
  if (lead.email && !EMAIL.test(lead.email)) return badRequest('Enter a valid email address.');
  if (lead.phone && !PHONE.test(lead.phone)) return badRequest('Enter a valid phone number.');

  try {
    const id = await captureLead(lead);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('[leads] capture failed', err);
    return NextResponse.json({ error: 'We could not save your request. Please try again.' }, { status: 500 });
  }
}
