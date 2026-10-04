import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, inArray } from 'drizzle-orm';
import { LogoutButton, ProfileForm } from '@/components/account/AccountActions';
import { RegistryShell } from '@/components/registry/RegistryShell';
import { currentUser, listSaved } from '@/lib/buyer-auth';
import { getDb } from '@/lib/db/client';
import { projectRequests, reraRegistry } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your account · hyderabad.properties',
  robots: { index: false, follow: false },
};

const STATUS: Record<string, string> = { new: 'Received', researching: 'We are checking it', added: 'Report live', rejected: 'Could not check' };

function fmt(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/account');

  const db = await getDb();
  const saved = await listSaved(user.id);
  const reraRefs = saved.filter((s) => s.kind === 'rera').map((s) => s.ref);
  const records = reraRefs.length ? await db.select().from(reraRegistry).where(inArray(reraRegistry.registrationNo, reraRefs)) : [];
  const byNo = new Map(records.map((r) => [r.registrationNo, r]));
  const local = user.phone.replace(/^\+91/, '');
  const requests = await db
    .select()
    .from(projectRequests)
    .where(inArray(projectRequests.requesterPhone, [user.phone, local, `91${local}`, `0${local}`]))
    .orderBy(desc(projectRequests.createdAt))
    .limit(20);

  return (
    <RegistryShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] sm:text-[44px] leading-[1.1] font-medium tracking-tight">Your account</h1>
          <p className="mt-2 text-[15px] text-[#6b6b6b]">Logged in with WhatsApp {user.phone.replace(/^\+91/, '+91 ')}</p>
        </div>
        <LogoutButton />
      </div>

      <section className="mt-10">
        <h2 className="text-[20px] font-medium">Your details</h2>
        <p className="mt-1 text-[14px] text-[#838383]">So our team knows who they are speaking to. Both are optional.</p>
        <div className="mt-4">
          <ProfileForm name={user.name ?? ''} email={user.email ?? ''} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[20px] font-medium">Saved projects</h2>
        {saved.length === 0 ? (
          <p className="mt-3 text-[15px] text-[#6b6b6b]">
            Nothing saved yet. Press <strong>Save</strong> on any project page and it shows up here, with every change we see on
            its RERA record. <Link href="/rera" className="underline">Browse RERA projects</Link>
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {saved.map((s) => {
              const r = s.kind === 'rera' ? byNo.get(s.ref) : undefined;
              if (!r) return null;
              const lastChange = r.changes[r.changes.length - 1];
              return (
                <Link key={s.ref} href={`/rera/${r.slug}`} className="rounded-[16px] border border-[#eeeeee] p-5 hover:border-[#212121] transition-colors">
                  <p className="font-medium text-[16px]">{r.name}</p>
                  <p className="mt-1 text-[13px] text-[#838383]">{[r.promoter, r.locality ?? r.mandal].filter(Boolean).join(' · ')}</p>
                  <p className="mt-3 text-[13px] text-[#4a4a4a]">
                    {lastChange ? `Record changed ${fmt(lastChange.at)}` : `No change since you saved it`}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-[20px] font-medium">Checks you asked for</h2>
        {requests.length === 0 ? (
          <p className="mt-3 text-[15px] text-[#6b6b6b]">None yet. Ask for a full check from any project page.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#f0f0f0] border-y border-[#f0f0f0]">
            {requests.map((q) => (
              <li key={q.id} className="py-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[15px] font-medium">{q.projectName}</span>
                <span className="text-[14px] text-[#6b6b6b]">
                  {STATUS[q.status] ?? q.status} · asked {fmt(q.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </RegistryShell>
  );
}
