import type { Metadata } from 'next';
import Link from 'next/link';
import { RegistryShell } from '@/components/registry/RegistryShell';
import { listRegistry, registryDistricts } from '@/lib/data/rera';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ district?: string; q?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { district } = await searchParams;
  const where = district ?? 'Hyderabad and Telangana';
  return {
    title: `TG-RERA registered projects in ${where} · hyderabad.properties`,
    description: `Every project registered with Telangana RERA in ${where}: builder, status, completion date, approvals and location, from the public record.`,
    alternates: { canonical: district ? `/rera?district=${encodeURIComponent(district)}` : '/rera' },
  };
}

export default async function RegistryIndex({ searchParams }: Props) {
  const { district, q, page } = await searchParams;
  const [list, districts] = await Promise.all([
    listRegistry({ district, q, page: Number(page) || 1 }),
    registryDistricts(),
  ]);
  const href = (p: number) => `/rera?${new URLSearchParams({ ...(district ? { district } : {}), page: String(p) })}`;

  return (
    <RegistryShell>
      <h1 className="text-[34px] sm:text-[48px] leading-[1.08] font-medium tracking-tight">
        TG-RERA registered projects{district ? <> in {district}</> : null}
      </h1>
      <p className="mt-3 max-w-[720px] text-[17px] text-[#6b6b6b]">
        The public record for every project registered with Telangana RERA: builder, status, completion date, approving authority
        and location. Search by project, builder, area or RERA number.
      </p>

      <form action="/rera" className="mt-8 flex gap-2 max-w-[640px]">
        <input
          name="q"
          defaultValue={q}
          placeholder="e.g. Kokapet, My Home, P02400…"
          className="flex-1 min-w-0 px-5 min-h-[52px] rounded-full border border-[#e5e5e5] text-[15px] focus:outline-none focus:border-[#212121]"
        />
        <button className="rounded-full bg-[#212121] text-white px-6 font-medium text-[15px]">Search</button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/rera" className={`rounded-full px-4 py-2 text-[13px] border ${!district && !q ? 'bg-[#212121] text-white border-[#212121]' : 'border-[#e5e5e5] text-[#4a4a4a]'}`}>
          All
        </Link>
        {districts.slice(0, 14).map((d) => (
          <Link
            key={d.district}
            href={`/rera?district=${encodeURIComponent(d.district)}`}
            className={`rounded-full px-4 py-2 text-[13px] border ${district === d.district ? 'bg-[#212121] text-white border-[#212121]' : 'border-[#e5e5e5] text-[#4a4a4a] hover:border-[#212121]'}`}
          >
            {d.district} <span className="opacity-60">{d.n}</span>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-[14px] text-[#838383]">
        {q ? `${list.total} result${list.total === 1 ? '' : 's'} for “${q}”` : `${list.total.toLocaleString('en-IN')} projects`}
      </p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.rows.map((n) => (
          <Link key={n.slug} href={`/rera/${n.slug}`} className="rounded-[16px] border border-[#eeeeee] p-5 hover:border-[#212121] transition-colors">
            <p className="font-medium text-[16px]">{n.name}</p>
            <p className="mt-1 text-[13px] text-[#838383]">{[n.promoter, n.locality ?? n.mandal, n.district].filter(Boolean).join(' · ')}</p>
            <p className="mt-3 text-[12px] text-[#a3a3a3]">
              {n.registrationNo}
              {n.projectStatus ? ` · ${n.projectStatus}` : ''}
            </p>
          </Link>
        ))}
      </div>
      {list.rows.length === 0 && (
        <p className="mt-6 text-[15px] text-[#4a4a4a]">
          Nothing matched. <Link href={`/?view=check&q=${encodeURIComponent(q ?? '')}`} className="underline">Ask us to check it</Link> and we will add it.
        </p>
      )}

      {list.pages > 1 && (
        <div className="mt-10 flex items-center gap-3 text-[14px]">
          {list.page > 1 && <Link href={href(list.page - 1)} className="rounded-full border border-[#e5e5e5] px-4 py-2">Previous</Link>}
          <span className="text-[#838383]">Page {list.page} of {list.pages}</span>
          {list.page < list.pages && <Link href={href(list.page + 1)} className="rounded-full border border-[#e5e5e5] px-4 py-2">Next</Link>}
        </div>
      )}
    </RegistryShell>
  );
}
