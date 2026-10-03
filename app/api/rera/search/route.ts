import { NextResponse } from 'next/server';
import { searchRegistry } from '@/lib/data/rera';

export const dynamic = 'force-dynamic';

/** GET /api/rera/search?q=… Registered TG-RERA projects matching a name, builder, area or RERA number. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').slice(0, 80);
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  return NextResponse.json({ results: await searchRegistry(q) });
}
