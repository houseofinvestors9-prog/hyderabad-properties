import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { registryVillages, screenRegistry } from '@/lib/ingest/area-screen';
import { readSurveyLists, syncHmdaLakeList } from '@/lib/ingest/hmda-lakes';
import { syncIgrRates, syncIgrVillageList } from '@/lib/ingest/igr-rates';
import { syncWaterTiles } from '@/lib/ingest/water';
import { unauthorized } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Area data for every registered project. Call with `Authorization: Bearer $CRON_SECRET`.
 *   ?step=lakes          refresh HMDA's list of notified lakes (one request)
 *   ?step=lake-surveys   read HMDA survey-number lists for lakes in project villages (Claude); repeat until remaining is 0
 *   ?step=water          fetch OpenStreetMap water around projects; repeat until remaining is 0
 *   ?step=igr-villages   list villages whose guideline values we keep; repeat until remaining is 0
 *   ?step=igr-rates      read guideline values for due villages; repeat until remaining is 0
 *   ?step=screen         match lakes and guideline values to each project; repeat until remaining is 0
 */
async function handle(req: Request) {
  if (!isCronAuthorized(req.headers.get('authorization'))) return unauthorized();
  const url = new URL(req.url);
  const step = url.searchParams.get('step') ?? 'screen';
  const budgetMs = Math.min(Number(url.searchParams.get('budgetMs') ?? 45_000), 100_000);
  const db = await getDb();
  try {
    switch (step) {
      case 'lakes':
        return NextResponse.json({ step, ...(await syncHmdaLakeList(db)) });
      case 'lake-surveys':
        return NextResponse.json({ step, ...(await readSurveyLists(db, await registryVillages(db), { budgetMs })) });
      case 'water':
        return NextResponse.json({ step, ...(await syncWaterTiles(db, { budgetMs })) });
      case 'igr-villages':
        return NextResponse.json({ step, ...(await syncIgrVillageList(db, { budgetMs })) });
      case 'igr-rates':
        return NextResponse.json({ step, ...(await syncIgrRates(db, { budgetMs })) });
      case 'screen':
        return NextResponse.json({ step, ...(await screenRegistry(db, { budgetMs, force: url.searchParams.get('force') === '1' })) });
      default:
        return NextResponse.json({ error: `Unknown step "${step}"` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ step, error: String((err as Error).message ?? err) }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
