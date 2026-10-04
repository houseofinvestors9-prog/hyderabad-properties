import { NextResponse } from 'next/server';
import { requestLoginCode } from '@/lib/buyer-auth';

export const dynamic = 'force-dynamic';

/** POST /api/auth/request-code { phone }: sends a 6-digit login code on WhatsApp. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  const r = await requestLoginCode(String(body?.phone ?? ''), ip);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, ...(r.devCode ? { devCode: r.devCode } : {}) });
}
