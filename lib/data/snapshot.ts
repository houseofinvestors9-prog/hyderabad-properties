import { getLiveSnapshot } from './repo';
import { MICRO_MARKETS, MOCK_PROJECTS, type LiveSnapshot } from '../mock-data';
import { DEMO_DATA } from '../demo';

/**
 * Live snapshot from the database. If the database is unreachable, development falls back to the
 * demo projects; production shows no projects rather than made-up ones.
 */
export async function getSnapshotSafe(): Promise<LiveSnapshot> {
  try {
    return await getLiveSnapshot();
  } catch (err) {
    console.error('[snapshot] database unavailable, serving bundled data:', err);
    return {
      projects: DEMO_DATA ? MOCK_PROJECTS : [],
      markets: MICRO_MARKETS,
      alerts: [],
      version: 'fallback',
      generatedAt: new Date().toISOString(),
    };
  }
}
