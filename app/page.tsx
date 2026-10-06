import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
import type { ViewType } from '@/components/TopBar';
import { LiveDataProvider } from '@/components/live/LiveDataProvider';
import { getSnapshotSafe } from '@/lib/data/snapshot';
import { DEMO_DATA } from '@/lib/demo';

export const dynamic = 'force-dynamic';

// Commute times are still sample figures, so that view only opens on demo builds.
const VIEWS: ViewType[] = ['home', 'check', 'concierge', 'booking', 'cost', 'watching', ...(DEMO_DATA ? ['commute' as const] : [])];

export const metadata: Metadata = { alternates: { canonical: '/' } };

type Props = { searchParams: Promise<{ view?: string; q?: string }> };

/** /?view=check&q=… opens a view directly (used by the TG-RERA record pages). */
export default async function Page({ searchParams }: Props) {
  const { view, q } = await searchParams;
  const snapshot = await getSnapshotSafe();
  const initialView = VIEWS.includes(view as ViewType) ? (view as ViewType) : q ? 'check' : 'home';
  return (
    <LiveDataProvider initial={snapshot}>
      <AppShell initialView={initialView} initialQuery={q?.slice(0, 80)} />
    </LiveDataProvider>
  );
}
