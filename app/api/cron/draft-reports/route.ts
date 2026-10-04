import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { loadDraftReports } from '@/lib/reports/load';

export const dynamic = 'force-dynamic';

/** POST /api/cron/draft-reports: load drafted reports as hidden drafts for sign-off. Bearer CRON_SECRET. */
export async function POST(req: Request) {
  if (!isCronAuthorized(req.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ reports: await loadDraftReports() });
}
