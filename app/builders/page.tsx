import type { Metadata } from 'next';
import Link from 'next/link';
import { RegistryShell } from '@/components/registry/RegistryShell';
import { BUILDERS } from '@/lib/builders';
import { registryForBuilder } from '@/lib/data/rera';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hyderabad builders and their TG-RERA projects · hyderabad.properties',
  description: 'Every project registered with Telangana RERA by Hyderabad’s leading builders, with status, units and completion dates as filed.',
  alternates: { canonical: '/builders' },
};

export default async function BuildersPage() {
  const rows = await Promise.all(BUILDERS.map(async (b) => ({ b, projects: await registryForBuilder(b) })));
  return (
    <RegistryShell>
      <h1 className="text-[34px] sm:text-[48px] leading-[1.08] font-medium tracking-tight">Builders</h1>
      <p className="mt-3 max-w-[680px] text-[16px] text-[#6b6b6b]">
        Projects each builder has registered with Telangana RERA, with the status, units and completion dates they filed. A project
        appears here when the record names the builder&apos;s company or the project carries its name.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ b, projects }) => {
          const units = projects.reduce((n, r) => n + (r.details?.totalUnits ?? 0), 0);
          const areas = [...new Set(projects.map((r) => r.locality).filter(Boolean))].slice(0, 3);
          return (
            <li key={b.slug}>
              <Link href={`/builders/${b.slug}`} className="block h-full rounded-[16px] border border-[#eeeeee] p-6 hover:border-[#212121]">
                <p className="text-[18px] font-medium">{b.name}</p>
                <p className="mt-1 text-[14px] text-[#4a4a4a]">
                  {projects.length} registered project{projects.length === 1 ? '' : 's'}
                  {units ? ` · ${units.toLocaleString('en-IN')} units` : ''}
                </p>
                {areas.length > 0 && <p className="mt-2 text-[13px] text-[#838383]">{areas.join(', ')}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </RegistryShell>
  );
}
