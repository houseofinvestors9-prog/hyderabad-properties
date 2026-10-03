import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RequestProjectForm } from '@/components/RequestProjectForm';
import { RegistryShell } from '@/components/registry/RegistryShell';
import { getRegistryBySlug, nearbyRegistry } from '@/lib/data/rera';
import type { ReraDetails, ReraRegistryRow } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

const SQM_PER_ACRE = 4046.86;

function place(r: ReraRegistryRow): string {
  return [r.locality, r.mandal && r.mandal !== r.locality ? r.mandal : null, r.district].filter(Boolean).join(', ');
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function monthsBetween(a: string, b: string): number {
  const x = new Date(a);
  const y = new Date(b);
  return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth());
}

function area(sqm: number | null | undefined): string | null {
  if (sqm == null) return null;
  const acres = sqm / SQM_PER_ACRE;
  return `${Math.round(sqm).toLocaleString('en-IN')} sq m (${acres >= 0.1 ? `${acres.toFixed(2)} acres` : `${Math.round(sqm * 10.764).toLocaleString('en-IN')} sq ft`})`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await getRegistryBySlug(slug);
  if (!r) return { title: 'Project not found · hyderabad.properties' };
  const d = r.details;
  const title = `${r.name}, ${r.locality ?? r.mandal ?? r.district}: TG-RERA record, status and completion date`;
  const description = [
    `${r.name}${r.promoter ? ` by ${r.promoter}` : ''} is registered with TG-RERA as ${r.registrationNo}.`,
    d?.projectStatus ? `Status: ${d.projectStatus}.` : '',
    d?.proposedCompletion ? `Completion as filed: ${fmtDate(d.revisedCompletion ?? d.proposedCompletion)}.` : '',
    'Free, independent buyer checks from hyderabad.properties.',
  ]
    .filter(Boolean)
    .join(' ');
  return { title, description, alternates: { canonical: `/rera/${r.slug}` }, openGraph: { title, description, type: 'article' } };
}

/** Plain-English notes drawn only from what the filing says. No verdict until a person has checked it. */
function notes(r: ReraRegistryRow, d: ReraDetails | null | undefined): string[] {
  if (!d) return [];
  const out: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const due = d.revisedCompletion ?? d.proposedCompletion;
  const completed = /complet/i.test(d.projectStatus ?? '');
  if (due && due < today && !completed) {
    out.push(`The completion date on file (${fmtDate(due)}) has passed and the project is not marked complete. Ask the builder for the current possession date in writing and check whether an extension has been granted.`);
  }
  if (d.proposedCompletion && d.revisedCompletion && d.revisedCompletion > d.proposedCompletion) {
    const m = monthsBetween(d.proposedCompletion, d.revisedCompletion);
    if (m > 0) out.push(`The completion date was moved by ${m} month${m === 1 ? '' : 's'}, from ${fmtDate(d.proposedCompletion)} to ${fmtDate(d.revisedCompletion)}.`);
  }
  if (d.litigation && /^yes/i.test(d.litigation)) {
    out.push('The builder has declared litigation related to this project. Ask for the case details and current status before you pay.');
  }
  if (d.affectedAreaSqm && d.affectedAreaSqm > 0) {
    out.push(`${area(d.affectedAreaSqm)} of the land is marked as affected by road widening, a lake full tank level (FTL) or nala widening. The filing does not say which. Our full check confirms the lake buffer on the map.`);
  }
  if (d.hasExtension) out.push('TG-RERA has issued an extension certificate for this project.');
  if (d.totalUnits && d.bookedUnits != null && d.totalUnits >= 10) {
    const pct = Math.round((d.bookedUnits / d.totalUnits) * 100);
    out.push(`The builder reports ${d.bookedUnits.toLocaleString('en-IN')} of ${d.totalUnits.toLocaleString('en-IN')} units booked (${pct}%). Builders update this figure themselves, so treat it as indicative.`);
  }
  return out;
}

export default async function RegistryPage({ params }: Props) {
  const { slug } = await params;
  const r = await getRegistryBySlug(slug);
  if (!r) notFound();
  const d = r.details;
  const nearby = await nearbyRegistry(r);
  const due = d?.revisedCompletion ?? d?.proposedCompletion;

  const facts: [string, string | null][] = [
    ['TG-RERA registration', r.registrationNo],
    ['Builder (promoter)', r.promoter ?? (d?.promoterType === 'Individual' ? 'An individual (name on the TG-RERA record)' : null)],
    ['Project status', d?.projectStatus ?? null],
    ['Project type', d?.projectType ?? null],
    ['Approving authority', d?.authority ?? null],
    ['Plan approval number', d?.planApprovalNo ?? null],
    ['Completion date as first filed', fmtDate(d?.proposedCompletion)],
    ['Revised completion date', d?.revisedCompletion && d.revisedCompletion !== d.proposedCompletion ? fmtDate(d.revisedCompletion) : null],
    ['Litigation declared by builder', d?.litigation ?? null],
    ['Units', d?.totalUnits ? `${d.totalUnits.toLocaleString('en-IN')}${d.unitTypes?.length ? ` (${d.unitTypes.join(', ')})` : ''}` : null],
    ['Towers or blocks', d?.buildings ? String(d.buildings) : null],
    ['Floors (tallest block)', d?.maxSlabs ? `${d.maxSlabs} above ground${d.basements ? `, ${d.basements} basement${d.basements === 1 ? '' : 's'}` : ''}` : null],
    ['Total land', area(d?.landAreaSqm)],
    ['Land affected by road, lake FTL or nala widening', d?.affectedAreaSqm ? area(d.affectedAreaSqm) : d?.affectedAreaSqm === 0 ? 'None declared' : null],
    ['Approved built-up area', area(d?.builtUpAreaSqm)],
    ['Construction progress (builder reported)', d?.workDonePercent != null ? `${d.workDonePercent}%` : null],
    ['Survey numbers', r.surveyNumbers],
    ['Location', [r.street, place(r), r.pinCode].filter(Boolean).join(', ') || null],
  ];

  const lookOut = notes(r, d);
  const mapSrc =
    r.lat && r.lng
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${r.lng - 0.01},${r.lat - 0.006},${r.lng + 0.01},${r.lat + 0.006}&layer=mapnik&marker=${r.lat},${r.lng}`
      : null;

  return (
    <RegistryShell>
      <nav className="text-[13px] text-[#838383] mb-6 flex flex-wrap gap-1.5">
        <Link href="/" className="hover:text-[#212121]">Home</Link>
        <span>/</span>
        <Link href="/rera" className="hover:text-[#212121]">TG-RERA projects</Link>
        {r.district && (
          <>
            <span>/</span>
            <Link href={`/rera?district=${encodeURIComponent(r.district)}`} className="hover:text-[#212121]">{r.district}</Link>
          </>
        )}
      </nav>

      <div className="inline-flex items-center gap-2 rounded-full bg-[#f4f4f4] px-3.5 py-1.5 text-[13px] font-medium text-[#4a4a4a]">
        <span className="h-2 w-2 rounded-full bg-[#a3a3a3]" aria-hidden="true" />
        Official TG-RERA record · not yet checked by our team
      </div>

      <h1 className="mt-4 text-[34px] sm:text-[48px] leading-[1.08] font-medium tracking-tight">{r.name}</h1>
      <p className="mt-3 text-[17px] text-[#6b6b6b]">
        {r.promoter ? <>By {r.promoter} · </> : null}
        {place(r)}
      </p>
      {due && (
        <p className="mt-2 text-[15px] text-[#4a4a4a]">
          Completion on file: <span className="font-semibold text-[#212121]">{fmtDate(due)}</span>
          {d?.projectStatus ? <> · {d.projectStatus}</> : null}
        </p>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-8 lg:gap-12">
        <div className="space-y-8 min-w-0">
          {lookOut.length > 0 && (
            <section className="rounded-[16px] border border-[#eeeeee] p-6 sm:p-7">
              <h2 className="text-[20px] font-medium">What the filing tells a buyer</h2>
              <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#4a4a4a] list-disc pl-5">
                {lookOut.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-[16px] border border-[#eeeeee] overflow-hidden">
            <h2 className="text-[20px] font-medium px-6 sm:px-7 pt-6">Facts on the TG-RERA record</h2>
            {!d && (
              <p className="px-6 sm:px-7 pt-2 text-[14px] text-[#838383]">
                We are reading this project&apos;s full RERA page. Builder, approval and completion details appear here within a day.
              </p>
            )}
            <dl className="mt-4 divide-y divide-[#f0f0f0]">
              {facts
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-1 sm:grid-cols-[0.9fr_1.1fr] gap-1 sm:gap-6 px-6 sm:px-7 py-3.5">
                    <dt className="text-[14px] text-[#838383]">{k}</dt>
                    <dd className="text-[15px] text-[#212121] break-words">{v}</dd>
                  </div>
                ))}
            </dl>
            <p className="px-6 sm:px-7 py-4 text-[13px] text-[#838383] bg-[#fafafa]">
              Source:{' '}
              {r.detailUrl ? (
                <a href={r.detailUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 hover:text-[#212121]">
                  TG-RERA public project page
                </a>
              ) : (
                <a href="https://rerait.telangana.gov.in/GIS/default.aspx" target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 hover:text-[#212121]">
                  TG-RERA project map
                </a>
              )}
              {r.detailFetchedAt && !r.detailError ? <>, read on {fmtDate(r.detailFetchedAt.toISOString())}</> : null}. Figures are as filed by the builder.
            </p>
          </section>

          {r.changes.length > 0 && (
            <section className="rounded-[16px] border border-[#eeeeee] p-6 sm:p-7">
              <h2 className="text-[20px] font-medium">Changes we have seen on the record</h2>
              <ul className="mt-4 space-y-2 text-[14px] text-[#4a4a4a]">
                {[...r.changes].reverse().slice(0, 10).map((c, i) => (
                  <li key={i}>
                    <span className="text-[#838383]">{fmtDate(c.at)}:</span> {String(c.field).replace(/([A-Z])/g, ' $1').toLowerCase()} changed from{' '}
                    <b>{String(c.from ?? 'blank')}</b> to <b>{String(c.to ?? 'blank')}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {mapSrc && (
            <section className="rounded-[16px] border border-[#eeeeee] overflow-hidden">
              <iframe title={`Map of ${r.name}`} src={mapSrc} className="w-full h-[320px] border-0" loading="lazy" />
              <p className="px-6 py-3 text-[13px] text-[#838383]">
                Site location as filed with TG-RERA. Map ©{' '}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
                  OpenStreetMap
                </a>{' '}
                contributors.{' '}
                <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noopener noreferrer" className="underline">
                  Open in Google Maps
                </a>
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-6 min-w-0">
          <div className="rounded-[16px] bg-[#f9f9f9] p-6 text-[14px] leading-relaxed text-[#4a4a4a]">
            <p className="font-semibold text-[#212121] text-[16px]">This is the builder&apos;s own filing</p>
            <p className="mt-2">
              Our full check adds what the RERA page does not show: the lake buffer on the map, the building permission and
              occupancy certificate, penalties and orders, and the true cost of buying. A person on our team signs off every report.
            </p>
          </div>
          <RequestProjectForm
            initialName={r.name}
            initialArea={place(r)}
            initialDeveloper={r.promoter ?? ''}
            initialReraNumber={r.registrationNo}
            title="Get the full check on this project"
          />
        </aside>
      </div>

      {nearby.length > 0 && (
        <section className="mt-14">
          <h2 className="text-[22px] font-medium">Other registered projects nearby</h2>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nearby.map((n) => (
              <Link key={n.slug} href={`/rera/${n.slug}`} className="rounded-[16px] border border-[#eeeeee] p-5 hover:border-[#212121] transition-colors">
                <p className="font-medium text-[16px]">{n.name}</p>
                <p className="mt-1 text-[13px] text-[#838383]">{[n.promoter, n.locality ?? n.mandal].filter(Boolean).join(' · ')}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </RegistryShell>
  );
}
