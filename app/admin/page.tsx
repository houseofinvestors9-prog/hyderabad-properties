import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AdminReviewView } from '@/components/admin/AdminReviewView';
import { ProjectRequestsPanel } from '@/components/admin/ProjectRequestsPanel';
import { getAdminStats, listProjectSources, listQueue, recentNotifications } from '@/lib/data/repo';
import { listProjectRequests } from '@/lib/project-requests';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Review Desk · hyderabad.properties',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const user = (await headers()).get('x-admin-user') ?? 'admin';
  const [items, stats, sources, notifications, requests] = await Promise.all([
    listQueue(['pending', 'flagged']),
    getAdminStats(),
    listProjectSources(),
    recentNotifications(10),
    listProjectRequests(),
  ]);
  return (
    <>
    <AdminReviewView
      user={user}
      initialItems={JSON.parse(JSON.stringify(items))}
      initialStats={JSON.parse(JSON.stringify(stats))}
      initialSources={sources}
      initialNotifications={JSON.parse(JSON.stringify(notifications))}
      geminiEnabled={!!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'}
    />
    <ProjectRequestsPanel initialRequests={JSON.parse(JSON.stringify(requests))} />
    </>
  );
}
