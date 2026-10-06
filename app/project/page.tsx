import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
import { LiveDataProvider } from '@/components/live/LiveDataProvider';
import { getSnapshotSafe } from '@/lib/data/snapshot';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ id?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { id } = await searchParams;
  const snapshot = await getSnapshotSafe();
  const p = snapshot.projects.find((x) => x.id === id);
  if (!p) return { title: 'Project report · hyderabad.properties' };
  return {
    title: `${p.name}, ${p.location}: ${p.statusLabel} · hyderabad.properties`,
    description: `Independent check of ${p.name}: RERA ${p.reraStatus}, building plan ${p.buildingPlan}, lake buffer ${p.lakeBuffer}. Last verified ${p.lastVerifiedDate}.`,
    alternates: { canonical: `/project?id=${encodeURIComponent(p.id)}` },
  };
}

/** /project?id=<id>: the live, shareable report URL for one project. */
export default async function ProjectPage({ searchParams }: Props) {
  const { id } = await searchParams;
  const snapshot = await getSnapshotSafe();
  const exists = !!id && snapshot.projects.some((p) => p.id === id);
  return (
    <LiveDataProvider initial={snapshot}>
      <AppShell initialView={exists ? 'project' : 'check'} initialProjectId={exists ? id : undefined} />
    </LiveDataProvider>
  );
}
