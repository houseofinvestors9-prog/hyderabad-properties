import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/account/LoginForm';
import { RegistryShell } from '@/components/registry/RegistryShell';
import { currentUser, loginAvailable } from '@/lib/buyer-auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Log in · hyderabad.properties',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string }> };

/** Only same-site paths, so the login link cannot send people elsewhere. */
function safeNext(next?: string): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
}

export default async function LoginPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);

  return (
    <RegistryShell>
      <div className="max-w-[440px] mx-auto py-6 sm:py-12">
        <h1 className="text-[34px] sm:text-[42px] leading-[1.1] font-medium tracking-tight">Log in with WhatsApp</h1>
        <p className="mt-3 text-[16px] text-[#6b6b6b]">
          Save projects, get alerts when a project&apos;s RERA record or orders change, and see the status of the checks you asked
          for. Logging in is optional; every report stays free without it.
        </p>
        <div className="mt-8">
          {loginAvailable() ? (
            <LoginForm next={next} />
          ) : (
            <p className="rounded-[14px] bg-[#f9f9f9] p-5 text-[15px] text-[#4a4a4a]">
              WhatsApp login is being set up. Everything on the site works without an account in the meantime.
            </p>
          )}
        </div>
        <p className="mt-8 text-[13px] leading-relaxed text-[#838383]">
          By logging in you agree that House of Investors, which runs hyderabad.properties, may contact you on this number about
          the projects you look at. We never sell your details or pass them to brokers. Reply STOP on WhatsApp at any time.
        </p>
      </div>
    </RegistryShell>
  );
}
