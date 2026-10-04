import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { projects, reraRegistry } from '../db/schema';
import { DRAFT_REPORTS } from './drafts';

/**
 * Write the drafted reports in lib/reports/drafts.ts to the database as hidden drafts.
 * A report someone has signed off is never overwritten: changes to a live report go through the Review Desk.
 */
export async function loadDraftReports() {
  const db = await getDb();
  const out: { id: string; result: 'inserted' | 'updated' | 'kept-signed-off' }[] = [];
  for (const d of DRAFT_REPORTS) {
    const [existing] = await db.select({ signedOffAt: projects.signedOffAt }).from(projects).where(eq(projects.id, d.id)).limit(1);
    if (existing?.signedOffAt) {
      out.push({ id: d.id, result: 'kept-signed-off' });
      continue;
    }
    const row = { ...d, isLive: false, signedOffBy: null, signedOffAt: null, updatedAt: new Date(), lastVerifiedAt: new Date() };
    if (existing) await db.update(projects).set(row).where(eq(projects.id, d.id));
    else await db.insert(projects).values(row);
    await db.update(reraRegistry).set({ projectId: d.id }).where(eq(reraRegistry.registrationNo, d.reraId));
    out.push({ id: d.id, result: existing ? 'updated' : 'inserted' });
  }
  return out;
}
