import type { Metadata } from 'next';
import { CorrectionForm } from '@/components/corrections/CorrectionForm';
import { RegistryShell } from '@/components/registry/RegistryShell';

export const metadata: Metadata = {
  title: 'Ask for a correction · hyderabad.properties',
  description: 'Tell us if something on hyderabad.properties is wrong or out of date.',
  alternates: { canonical: '/corrections' },
};

type Props = { searchParams: Promise<{ page?: string }> };

export default async function CorrectionsPage({ searchParams }: Props) {
  const { page } = await searchParams;
  return (
    <RegistryShell>
      <div className="max-w-[640px]">
        <h1 className="text-[34px] sm:text-[44px] leading-[1.1] font-medium tracking-tight">Ask for a correction</h1>
        <p className="mt-3 text-[16px] text-[#6b6b6b]">
          Our pages reproduce public records from Telangana RERA and other authorities, with the date we read them. If something is
          wrong, out of date or has changed since, tell us. Builders are welcome to send documents. A person on our team reviews
          every request and replies within three working days; where a record has changed, we update the page.
        </p>
        <div className="mt-8">
          <CorrectionForm pageUrl={page?.slice(0, 300) ?? ''} />
        </div>
      </div>
    </RegistryShell>
  );
}
