import type { Metadata } from 'next';
import Link from 'next/link';
import { RegistryShell } from '@/components/registry/RegistryShell';

export const metadata: Metadata = {
  title: 'Page not found · hyderabad.properties',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <RegistryShell>
      <div className="max-w-[560px] py-6 sm:py-12">
        <p className="font-mono text-[12px] uppercase tracking-wider text-[#838383]">404</p>
        <h1 className="mt-3 text-[34px] sm:text-[42px] leading-[1.1] font-medium tracking-tight">We could not find that page</h1>
        <p className="mt-4 text-[16px] text-[#6b6b6b] leading-relaxed">
          The link may be old, or the project may be listed under a different name. Search for it below, or look it up in the
          TG-RERA registry.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/?view=check"
            className="rounded-full bg-[#212121] text-white text-[15px] font-semibold px-6 py-3 hover:bg-black transition-colors"
          >
            Check a project
          </Link>
          <Link
            href="/rera"
            className="rounded-full border border-[#eeeeee] hover:border-[#212121] text-[#212121] text-[15px] font-semibold px-6 py-3 transition-colors"
          >
            All RERA projects
          </Link>
          <Link
            href="/"
            className="rounded-full border border-[#eeeeee] hover:border-[#212121] text-[#212121] text-[15px] font-semibold px-6 py-3 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </RegistryShell>
  );
}
