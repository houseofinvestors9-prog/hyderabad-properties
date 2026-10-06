import type { Metadata } from 'next';
import Link from 'next/link';
import { RegistryShell } from '@/components/registry/RegistryShell';

export const metadata: Metadata = {
  title: 'Privacy policy · hyderabad.properties',
  description: 'What hyderabad.properties collects, why, who sees it, how long we keep it and how to have it deleted.',
  alternates: { canonical: '/privacy' },
};

// DRAFT, awaiting founder sign-off. Fill every value in [square brackets] before this goes live.
const POLICY = {
  updated: '[date of sign-off]',
  legalEntity: '[House of Investors registered company name]',
  address: '[registered office address, Hyderabad]',
  privacyEmail: 'admin@hoinvestors.com',
  whatsapp: '[HOI WhatsApp number]',
  grievanceOfficer: '[name and role]',
  leadRetentionMonths: 24,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[22px] sm:text-[24px] leading-tight font-medium text-[#212121]">{title}</h2>
      <div className="space-y-3 text-[16px] text-[#4a4a4a] leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <RegistryShell>
      <article className="max-w-[720px] py-6 sm:py-12 space-y-10">
        <header className="space-y-3">
          <h1 className="text-[34px] sm:text-[48px] leading-[1.08] font-medium tracking-tight">Privacy policy</h1>
          <p className="text-[15px] text-[#838383]">Last updated {POLICY.updated}</p>
          <p className="text-[16px] text-[#4a4a4a] leading-relaxed">
            This page explains what we collect when you use hyderabad.properties, why we collect it, who sees it, how long we keep
            it and how you can have it corrected or deleted. It follows India&apos;s Digital Personal Data Protection Act, 2023.
          </p>
        </header>

        <Section title="Who we are">
          <p>
            hyderabad.properties is owned and operated by House of Investors ({POLICY.legalEntity}, {POLICY.address}). We decide
            how your personal data is used, so under the law we are the &ldquo;data fiduciary&rdquo;.
          </p>
          <p>
            House of Investors is a real estate advisory. When a buyer we introduced buys a home, the builder pays us a fee. The
            project checks on this site are free, and we run the same checks on the projects we market ourselves.
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            <strong>What you give us.</strong> When you ask for a call, a site visit, a shortlist or a check of a project, we collect
            your name, phone or WhatsApp number, email if you give it, your message, the project you asked about and any
            preferences you chose (budget, area, flat size). If you ask us to correct a page, we collect your name, organisation and
            contact details. If you ask to watch a project, we collect the phone number or email you want alerts on.
          </p>
          <p>
            <strong>When you log in.</strong> Your WhatsApp number. The one-time code we send expires in 10 minutes and is stored
            only in scrambled (hashed) form. Logging in sets one cookie that keeps you signed in for up to 90 days.
          </p>
          <p>
            <strong>Collected automatically.</strong> Your IP address, which we use only to block spam and repeated login attempts,
            the page you sent a form from, and campaign tags in the link you followed (for example, which ad brought you here).
            We do not use advertising or analytics trackers today. If we add one, we will update this page first.
          </p>
          <p>
            <strong>Stored in your browser.</strong> The projects you watch without logging in are saved in your own browser, not
            on our servers.
          </p>
          <p>We never ask for payment details, Aadhaar, PAN or other identity documents on this site.</p>
        </Section>

        <Section title="Why we use it">
          <ul className="list-disc pl-5 space-y-2">
            <li>To call or message you about the projects you asked about, and to arrange site visits you request.</li>
            <li>To check a project you asked us to add, and tell you when its report is ready.</li>
            <li>To log you in and keep your saved projects.</li>
            <li>To send alerts on projects you watch, once alerts are switched on.</li>
            <li>To answer correction requests.</li>
            <li>To keep the site safe from spam and misuse.</li>
          </ul>
          <p>
            We use your details because you agreed to it on the form. You can withdraw that consent at any time (see &ldquo;Your
            rights&rdquo; below). Withdrawing does not affect what we did before you withdrew.
          </p>
        </Section>

        <Section title="Who sees it">
          <p>
            <strong>Our team.</strong> The House of Investors advisors who reply to your request, and the people who run this site.
          </p>
          <p>
            <strong>Service providers.</strong> Companies that store or process data for us and may not use it for anything else:
            Hostinger (website hosting), Neon (database), Gallabox (WhatsApp messages and login codes) and Base44 (our lead
            management system). Some of them may store data on servers outside India.
          </p>
          <p>
            <strong>Builders, only when you ask.</strong> If you ask us to arrange a visit to a project, we share your name and
            phone number with that builder to book the visit and register you as our client. We do not share your details with
            any builder you did not ask about.
          </p>
          <p>
            <strong>When the law requires it.</strong> We share data with government authorities only when legally required.
          </p>
          <p>We do not sell your personal data, and we do not give it to marketing lists.</p>
          <p>
            Project facts on this site come from public government records. Our AI tools read those government documents; they
            are never sent your personal details.
          </p>
        </Section>

        <Section title="How long we keep it">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Enquiries, project requests and correction requests: up to {POLICY.leadRetentionMonths} months after we last spoke
              with you, then deleted, unless you ask us to delete them sooner.
            </li>
            <li>Your account and saved projects: until you ask us to delete them.</li>
            <li>Login codes: they stop working after 10 minutes. Sign-in cookies: up to 90 days.</li>
            <li>IP addresses: about a day for spam protection, and up to 30 days with login records.</li>
          </ul>
          <p>If a law requires us to keep a record for longer (for example, for tax), we keep only what that law requires.</p>
        </Section>

        <Section title="Your rights">
          <p>You can ask us to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>tell you what personal data we hold about you and who we shared it with,</li>
            <li>correct or complete it,</li>
            <li>delete it,</li>
            <li>stop contacting you (reply STOP to any WhatsApp message from us at any time),</li>
            <li>name someone to act for you if you die or cannot act yourself.</li>
          </ul>
          <p>
            Email <a href={`mailto:${POLICY.privacyEmail}`} className="underline">{POLICY.privacyEmail}</a> or WhatsApp{' '}
            {POLICY.whatsapp}. We reply within 7 days and complete deletion within 30 days. We may ask you to confirm the phone
            number or email we hold, so that we only act on requests from you.
          </p>
        </Section>

        <Section title="Complaints">
          <p>
            Our grievance officer is {POLICY.grievanceOfficer}, reachable at{' '}
            <a href={`mailto:${POLICY.privacyEmail}`} className="underline">{POLICY.privacyEmail}</a>. If you are not satisfied
            with our answer, you can complain to the Data Protection Board of India.
          </p>
        </Section>

        <Section title="Security">
          <p>
            The site only works over an encrypted connection (HTTPS). Login codes and sign-in tokens are stored in hashed form, and
            only our team can see the details you send us. No system is perfectly secure; if a breach affects your data, we will
            tell you and the Data Protection Board as the law requires.
          </p>
        </Section>

        <Section title="Children">
          <p>This site is meant for adults buying homes. We do not knowingly collect data from anyone under 18.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            When we change this policy we update the date at the top. If a change affects how we use details you already gave
            us, we will tell you before it applies.
          </p>
        </Section>

        <p className="text-[15px] text-[#838383]">
          Something on a project page wrong? That goes through <Link href="/corrections" className="underline">corrections</Link>.
        </p>
      </article>
    </RegistryShell>
  );
}
