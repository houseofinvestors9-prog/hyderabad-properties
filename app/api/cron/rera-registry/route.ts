import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { syncRegistryDetails, syncRegistryFeed } from '@/lib/ingest/rera-registry';
import { syncReraOrders } from '@/lib/ingest/rera-orders';
import { unauthorized } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * TG-RERA registry sync. Call with `Authorization: Bearer $CRON_SECRET`.
 *   ?step=feed      refresh the list of registered projects (one request to the RERA map feed)
 *   ?step=details   read due project pages for about 45 seconds; repeat until `remaining` is 0
 *   ?step=orders    refresh TG-RERA orders and public notices, read new PDFs; repeat until `remaining` is 0
 */
async function handle(req: Request) {
  if (!isCronAuthorized(req.headers.get('authorization'))) return unauthorized();
  const url = new URL(req.url);
  const step = url.searchParams.get('step') ?? 'details';
  const db = await getDb();
  try {
    if (step === 'feed') return NextResponse.json({ step, ...(await syncRegistryFeed(db)) });
    if (step === 'orders') return NextResponse.json({ step, ...(await syncReraOrders(db)) });
    const budgetMs = Math.min(Number(url.searchParams.get('budgetMs') ?? 45_000), 100_000);
    return NextResponse.json({ step: 'details', ...(await syncRegistryDetails(db, { budgetMs })) });
  } catch (err) {
    return NextResponse.json({ step, error: String((err as Error).message ?? err) }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
