import type { Metadata } from 'next';
import Link from 'next/link';
import { RegistryShell } from '@/components/registry/RegistryShell';
import { listOrders } from '@/lib/data/rera';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Documents published by TG-RERA · hyderabad.properties',
  description: 'Orders and public notices as published by Telangana RERA, with links to the originals.',
  // A plain index of the regulator's own list; kept out of search results.
  robots: { index: false, follow: true },
};

const KIND: Record<string, string> = { suo_motu: 'Suo motu order', penalty: 'Penalty order', notice: 'Public notice', rejection: 'Registration rejected', other: 'Order' };

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default async function OrdersPage() {
  const orders = await listOrders();
  return (
    <RegistryShell>
      <h1 className="text-[34px] sm:text-[48px] leading-[1.08] font-medium tracking-tight">Documents published by TG-RERA</h1>
      <p className="mt-3 max-w-[720px] text-[17px] text-[#6b6b6b]">
        Orders and public notices as published by Telangana RERA, in their own words, with links to the originals. We do not
        summarise or comment on them. Each reflects the position on its date and may since have been complied with, varied
        or appealed.
      </p>
      <p className="mt-8 text-[14px] text-[#838383]">{orders.length} published</p>
      <ul className="mt-3 divide-y divide-[#f0f0f0] border-y border-[#f0f0f0]">
        {orders.map((o) => (
          <li key={o.id} className="py-5 grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-2 sm:gap-6">
            <div className="text-[13px] text-[#838383]">
              <p>{fmtDate(o.orderDate)}</p>
              <p className="mt-1">{KIND[o.kind]}</p>
            </div>
            <div className="min-w-0">
              <a href={o.pdfUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-[16px] font-medium underline underline-offset-2 hover:no-underline">
                {o.title}
              </a>
              {o.projects.length > 0 && (
                <p className="mt-2 text-[14px] text-[#4a4a4a]">
                  Cites the registration of:{' '}
                  {o.projects.map((p, i) => (
                    <span key={p.slug}>
                      {i > 0 && ', '}
                      <Link href={`/rera/${p.slug}`} className="underline underline-offset-2">{p.name}</Link>
                    </span>
                  ))}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </RegistryShell>
  );
}
