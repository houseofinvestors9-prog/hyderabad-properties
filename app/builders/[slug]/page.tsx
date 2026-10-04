import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RegistryShell } from '@/components/registry/RegistryShell';
import { builderBySlug } from '@/lib/builders';
import { registryForBuilder } from '@/lib/data/rera';
import type { ReraRegistryRow } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function bhk(r: ReraRegistryRow): string | null {
  const t = [...new Set((r.details?.unitTypes ?? []).map((x) => x.match(/^(\d(?:\.5)?)\s*BHK$/)?.[1]).filter(Boolean))].sort();
  return t.length ? `${t.join(', ')} BHK` : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = builderBySlug((await params).slug);
  if (!b) return { title: 'Builder not found · hyderabad.properties' };
  const title = `${b.name} projects in Hyderabad: TG-RERA status and completion dates`;
  const description = `Every project ${b.name} has registered with Telangana RERA, with units, flat types and completion dates as filed. Independent buyer checks from hyderabad.properties.`;
  return { title, description, alternates: { canonical: `/builders/${b.slug}` }, openGraph: { title, description } };
}

export default async function BuilderPage({ params }: Props) {
  const b = builderBySlug((await params).slug);
  if (!b) notFound();
  const projects = await registryForBuilder(b);
  const today = new Date().toISOString().slice(0, 10);
  const companies = [...new Set(projects.map((r) => r.promoter).filter(Boolean))];

  return (
    <RegistryShell>
      <nav className="text-[13px] text-[#838383] mb-6 flex flex-wrap gap-1.5">
        <Link href="/" className="hover:text-[#212121]">Home</Link>
        <span>/</span>
        <Link href="/builders" className="hover:text-[#212121]">Builders</Link>
      </nav>
      <h1 className="text-[34px] sm:text-[48px] leading-[1.08] font-medium tracking-tight">{b.name}</h1>
      <p className="mt-3 max-w-[720px] text-[16px] text-[#6b6b6b]">
        {projects.length} project{projects.length === 1 ? '' : 's'} registered with Telangana RERA, as filed by the builder. Open a
        project for its full record, the documents TG-RERA has published about it, and what to ask before you pay.
      </p>
      {b.markets?.length ? (
        <p className="mt-4 max-w-[720px] rounded-[12px] bg-[#f9f9f9] p-4 text-[14px] text-[#4a4a4a]">
          Disclosure: House of Investors, which owns hyderabad.properties, is paid to market some of this builder&apos;s projects.
          They are marked below. Every project on this page shows the same TG-RERA record, read the same way.
        </p>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-[16px] border border-[#eeeeee]">
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <thead className="bg-[#f9f9f9] text-[12px] uppercase tracking-wide text-[#838383]">
            <tr>
              <th className="px-4 py-3 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Area</th>
              <th className="px-4 py-3 font-semibold">Units</th>
              <th className="px-4 py-3 font-semibold">Completion as filed</th>
              <th className="px-4 py-3 font-semibold">Booked (builder reported)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {projects.map((r) => {
              const d = r.details;
              const due = d?.revisedCompletion ?? d?.proposedCompletion;
              const passed = !!due && due < today && !/complet/i.test(d?.projectStatus ?? '');
              const booked = d?.totalUnits && d.bookedUnits && d.totalUnits >= 10 ? Math.round((d.bookedUnits / d.totalUnits) * 100) : null;
              return (
                <tr key={r.registrationNo} className="align-top">
                  <td className="px-4 py-3">
                    <Link href={`/rera/${r.slug}`} className="font-medium text-[#212121] underline underline-offset-2 hover:no-underline">
                      {r.name}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-[#838383]">
                      {r.registrationNo}
                      {b.markets?.includes(r.registrationNo) ? ' · marketed by House of Investors' : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[#4a4a4a]">{r.locality ?? r.mandal ?? r.district ?? '—'}</td>
                  <td className="px-4 py-3 text-[#4a4a4a]">
                    {d?.totalUnits ? d.totalUnits.toLocaleString('en-IN') : '—'}
                    {bhk(r) ? <span className="block text-[12px] text-[#838383]">{bhk(r)}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-[#4a4a4a]">
                    {fmtDate(due) ?? '—'}
                    {d?.revisedCompletion && d.proposedCompletion && d.revisedCompletion > d.proposedCompletion ? (
                      <span className="block text-[12px] text-[#838383]">revised from {fmtDate(d.proposedCompletion)}</span>
                    ) : null}
                    {passed ? <span className="block text-[12px] text-[#838383]">date on file has passed</span> : null}
                  </td>
                  <td className="px-4 py-3 text-[#4a4a4a]">{booked != null ? `${booked}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-[720px] text-[13px] text-[#838383]">
        Figures are reproduced from each project&apos;s TG-RERA page as filed by the builder; a dash means the builder has not filed it
        or we have not read the page yet. Registered companies on this page: {companies.join('; ') || '—'}. A verdict appears only
        after a person on our team has checked a project.{' '}
        <Link href={`/corrections?page=${encodeURIComponent(`/builders/${b.slug}`)}`} className="underline hover:text-[#212121]">
          Report an error
        </Link>
      </p>
    </RegistryShell>
  );
}
