import { and, count, eq, gt, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { rateLimitHits } from '@/lib/db/schema';

/**
 * Database-backed rate limit for the public forms. Hostinger runs several app processes,
 * so an in-memory counter would let four times the limit through.
 */

export type Limit = { key: string | null | undefined; max: number; windowMinutes: number };

export function clientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
}

/** Digits only, last 10, so "+91 98765 43210" and "9876543210" share one counter. */
export function phoneKey(phone: string | null | undefined): string | null {
  const d = (phone ?? '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-10) : null;
}

/**
 * Returns a 429 response when any limit is exceeded, otherwise records the hit and returns null.
 * A database error never blocks a real buyer: the request goes through and the error is logged.
 */
export async function rateLimit(bucket: string, limits: Limit[]): Promise<NextResponse | null> {
  const active = limits.filter((l): l is Limit & { key: string } => !!l.key);
  if (active.length === 0) return null;
  try {
    const db = await getDb();
    for (const l of active) {
      const since = new Date(Date.now() - l.windowMinutes * 60_000);
      const [{ n }] = await db
        .select({ n: count() })
        .from(rateLimitHits)
        .where(and(eq(rateLimitHits.bucket, bucket), eq(rateLimitHits.key, l.key), gt(rateLimitHits.createdAt, since)));
      if (n >= l.max) {
        return NextResponse.json(
          { error: 'Too many requests from here. Please try again a little later, or call us.' },
          { status: 429, headers: { 'retry-after': String(l.windowMinutes * 60) } }
        );
      }
    }
    await db.insert(rateLimitHits).values(active.map((l) => ({ bucket, key: l.key })));
    // Keep the table small: about one request in fifty clears rows older than a day.
    if (Math.random() < 0.02) {
      await db.delete(rateLimitHits).where(lt(rateLimitHits.createdAt, new Date(Date.now() - 24 * 60 * 60_000)));
    }
  } catch (err) {
    console.error('[rate-limit] check failed, letting the request through', err);
  }
  return null;
}
