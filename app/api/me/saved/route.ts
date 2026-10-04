import { NextResponse } from 'next/server';
import { currentUser, setSaved } from '@/lib/buyer-auth';

export const dynamic = 'force-dynamic';

/** POST /api/me/saved { kind: 'rera' | 'project', ref, saved: boolean } */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Log in to save projects.' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { kind?: string; ref?: string; saved?: boolean } | null;
  if (!body || (body.kind !== 'rera' && body.kind !== 'project') || !body.ref || body.ref.length > 80) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  await setSaved(user.id, body.kind, body.ref, body.saved !== false);
  return NextResponse.json({ ok: true });
}
