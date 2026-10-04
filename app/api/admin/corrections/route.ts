import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { corrections } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/corrections { id, status: 'open' | 'resolved' } (admin only, via middleware) */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!body?.id || (body.status !== 'open' && body.status !== 'resolved')) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const db = await getDb();
  await db
    .update(corrections)
    .set({ status: body.status, resolvedAt: body.status === 'resolved' ? new Date() : null })
    .where(eq(corrections.id, body.id));
  return NextResponse.json({ ok: true });
}
