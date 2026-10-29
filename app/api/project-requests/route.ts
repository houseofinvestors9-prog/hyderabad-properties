import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createProjectRequest } from '@/lib/project-requests';
import { clientIp, phoneKey, rateLimit } from '@/lib/rate-limit';
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
    projectName: z.string().trim().min(2, 'Add the project name.').max(160),
    area: z.string().trim().min(2, 'Add the area or locality.').max(120),
    developer: optionalText(160),
    reraNumber: optionalText(40),
    stage: optionalText(40),
    searchedQuery: optionalText(200),
    requesterName: optionalText(120),
    requesterEmail: optionalText(160),
    requesterPhone: optionalText(24),
    consent: z.literal(true, { message: 'Please agree to be contacted.' }),
    website: z.string().max(0).optional(), // honeypot
  })
  .refine((b) => b.requesterEmail || b.requesterPhone, {
    message: 'Add a phone number or email so we can tell you when the report is ready.',
  });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s-]{8,18}$/;

/** POST /api/project-requests: a buyer asks us to check a project we don't have yet. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request', parsed.error.flatten());
  const { consent: _consent, website: _honeypot, ...input } = parsed.data;
  if (input.requesterEmail && !EMAIL.test(input.requesterEmail)) return badRequest('Enter a valid email address.');
  if (input.requesterPhone && !PHONE.test(input.requesterPhone)) return badRequest('Enter a valid phone number.');

  const ip = clientIp(req);
  const limited = await rateLimit('project-requests', [
    { key: ip, max: 5, windowMinutes: 60 },
    { key: phoneKey(input.requesterPhone), max: 5, windowMinutes: 24 * 60 },
  ]);
  if (limited) return limited;

  try {
    const id = await createProjectRequest(input);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('[project-requests] create failed', err);
    return NextResponse.json({ error: 'We could not save your request. Please try again.' }, { status: 500 });
  }
}
