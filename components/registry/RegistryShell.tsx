import Link from 'next/link';
import { BrandMark } from '@/components/TopBar';

/** Header and footer for the server-rendered TG-RERA record pages. */
export function RegistryShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#f0f0f0]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold">
            <BrandMark />
            hyderabad.properties
          </Link>
          <nav className="flex items-center gap-2 sm:gap-6 text-[14px]">
            <Link href="/rera" className="hidden sm:inline text-[#4a4a4a] hover:text-[#212121]">
              All RERA projects
            </Link>
            <Link href="/?view=check" className="whitespace-nowrap rounded-full bg-[#212121] text-white px-4 sm:px-5 py-2.5 font-medium">
              Check a project
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-8 sm:py-12">{children}</main>
      <footer className="border-t border-[#f0f0f0] mt-10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 text-[13px] text-[#838383] space-y-2">
          <p>
            Project facts on these pages come from Telangana RERA&apos;s public records, as filed by each builder. A verdict appears
            only after a person on our team has checked the project.
          </p>
          <p>hyderabad.properties is owned and operated by House of Investors.</p>
        </div>
      </footer>
    </div>
  );
}
