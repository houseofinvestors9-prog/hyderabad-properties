import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AdminReviewView } from '@/components/admin/AdminReviewView';
import { ProjectRequestsPanel } from '@/components/admin/ProjectRequestsPanel';
import { getAdminStats, listProjectSources, listQueue, recentNotifications } from '@/lib/data/repo';
import { listProjectRequests } from '@/lib/project-requests';
import { claudeEnabled } from '@/lib/ai/analyze-notice';
import { registryStats } from '@/lib/data/rera';
import { CorrectionsPanel } from '@/components/admin/CorrectionsPanel';
import { getDb } from '@/lib/db/client';
import { corrections } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Review Desk · hyderabad.properties',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const user = (await headers()).get('x-admin-user') ?? 'admin';
  const [items, stats, sources, notifications, requests, registry] = await Promise.all([
    listQueue(['pending', 'flagged']),
    getAdminStats(),
    listProjectSources(),
    recentNotifications(10),
    listProjectRequests(),
    registryStats(),
  ]);
  const openCorrections = await (await getDb()).select().from(corrections).where(eq(corrections.status, 'open')).orderBy(desc(corrections.createdAt));
  const when = (v: string | null) => (v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : 'never');
  return (
    <>
    <AdminReviewView
      user={user}
      initialItems={JSON.parse(JSON.stringify(items))}
      initialStats={JSON.parse(JSON.stringify(stats))}
      initialSources={sources}
      initialNotifications={JSON.parse(JSON.stringify(notifications))}
      claudeEnabled={claudeEnabled()}
    />
    <ProjectRequestsPanel initialRequests={JSON.parse(JSON.stringify(requests))} />
    <CorrectionsPanel initial={JSON.parse(JSON.stringify(openCorrections))} />
    <section className="max-w-[1200px] mx-auto px-4 sm:px-8 pb-12">
      <div className="rounded-[16px] border border-[#eeeeee] p-6">
        <h2 className="text-[18px] font-medium">TG-RERA registry</h2>
        <p className="mt-2 text-[14px] text-[#4a4a4a]">
          {registry.total.toLocaleString('en-IN')} registered projects from the RERA map feed · {registry.read.toLocaleString('en-IN')} project pages read
          {registry.errors ? ` · ${registry.errors} could not be read (retried next day)` : ''}
        </p>
        <p className="mt-1 text-[13px] text-[#838383]">
          Feed refreshed {when(registry.lastFeed)} · last page read {when(registry.lastRead)} · refreshes weekly.{' '}
          <a href="/rera" className="underline">Browse the public pages</a>
        </p>
      </div>
    </section>
    </>
  );
}
