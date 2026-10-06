import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { corrections } from '@/lib/db/schema';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  pageUrl: z.string().trim().max(300).optional(),
  fromRole: z.enum(['buyer', 'builder', 'other']).default('other'),
  name: z.string().trim().max(120).optional(),
  organisation: z.string().trim().max(160).optional(),
  contact: z.string().trim().min(5, 'Add an email or phone number so we can reply.').max(160),
  message: z.string().trim().min(10, 'Tell us what is wrong.').max(4000),
  website: z.string().max(0).optional(), // honeypot
});

/** POST /api/corrections: someone asks us to correct or remove something on a page. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  const { website: _hp, ...row } = parsed.data;
  const limited = await rateLimit('corrections', [{ key: clientIp(req), max: 5, windowMinutes: 60 }]);
  if (limited) return limited;
  const db = await getDb();
  await db.insert(corrections).values(row);
  return NextResponse.json({ ok: true });
}
