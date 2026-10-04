import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/reports { id, action: 'publish' | 'unpublish', signer } (admin only, via middleware) */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string; action?: string; signer?: string } | null;
  if (!body?.id || (body.action !== 'publish' && body.action !== 'unpublish')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const db = await getDb();
  if (body.action === 'publish') {
    const signer = body.signer?.trim().slice(0, 80);
    if (!signer) return NextResponse.json({ error: 'Add the name to show on the report.' }, { status: 400 });
    const now = new Date();
    await db
      .update(projects)
      .set({ isLive: true, signedOffBy: signer, signedOffAt: now, lastVerifiedAt: now, updatedAt: now })
      .where(eq(projects.id, body.id));
  } else {
    await db.update(projects).set({ isLive: false, updatedAt: new Date() }).where(eq(projects.id, body.id));
  }
  return NextResponse.json({ ok: true });
}
