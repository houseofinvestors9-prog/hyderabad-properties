import { NextResponse } from 'next/server';
import { verifyLoginCode } from '@/lib/buyer-auth';
import { captureLead } from '@/lib/leads';

export const dynamic = 'force-dynamic';

/** POST /api/auth/verify { phone, code }: checks the code, starts a session, and on first login sends a lead. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { phone?: string; code?: string; next?: string } | null;
  const r = await verifyLoginCode(String(body?.phone ?? ''), String(body?.code ?? '').trim(), req.headers.get('user-agent'));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  if (r.isNew) {
    // A verified WhatsApp number is the strongest lead the site gets. The login page states the consent.
    await captureLead({
      source: 'signup',
      phone: r.user.phone,
      consent: true,
      userId: r.user.id,
      pagePath: typeof body?.next === 'string' ? body.next.slice(0, 300) : '/login',
      message: 'Logged in with WhatsApp on hyderabad.properties',
    }).catch((err) => console.error('[login] signup lead not stored', err));
  }
  return NextResponse.json({ ok: true, isNew: r.isNew });
}
