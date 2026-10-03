import { NextResponse } from 'next/server';
import { registryOverview } from '@/lib/data/rera';

export const dynamic = 'force-dynamic';

/** GET /api/rera/overview: registry counts, areas and newest registrations for the home page. */
export async function GET() {
  try {
    return NextResponse.json(await registryOverview(), { headers: { 'cache-control': 'public, max-age=300' } });
  } catch {
    return NextResponse.json({ total: 0, read: 0, flagged: 0, areas: [], recent: [] });
  }
}
