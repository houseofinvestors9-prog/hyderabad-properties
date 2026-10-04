import { NextResponse } from 'next/server';
import { currentUser, listSaved, loginAvailable, updateProfile } from '@/lib/buyer-auth';

export const dynamic = 'force-dynamic';

/** GET /api/me: the logged-in buyer and what they saved, or { user: null }. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null, loginAvailable: loginAvailable() });
  const saved = await listSaved(user.id);
  return NextResponse.json({
    user: { phone: user.phone, name: user.name, email: user.email },
    saved: saved.map((s) => ({ kind: s.kind, ref: s.ref })),
    loginAvailable: true,
  });
}

/** PATCH /api/me { name?, email? } */
export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Log in first.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string };
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const u = await updateProfile(user.id, body);
  return NextResponse.json({ user: { phone: u.phone, name: u.name, email: u.email } });
}
