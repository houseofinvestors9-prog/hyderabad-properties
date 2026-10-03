'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Search,
  MapPin,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Check,
  FileCheck2,
  Landmark,
  Waves,
  Receipt,
  ShieldCheck,
  BellRing,
  Globe,
  Plus,
  Minus,
} from 'lucide-react';
import { ProjectSafetyItem } from '@/lib/mock-data';
import { useLiveData } from '@/components/live/LiveDataProvider';
import { SafetyBadge } from '@/components/SafetyBadge';
import { ViewType } from '@/components/TopBar';
import { UserPreferences } from '@/components/AppShell';
import { PrivacyPledge } from '@/components/PrivacyPledge';
import { OWNERSHIP_LINE } from '@/components/Footer';
import { projectImage, AREA_IMAGES, REPRESENTATIVE_PHOTO_LABEL } from '@/lib/project-images';
import { submitLead } from '@/lib/submit-lead';
import type { RegistryHit, RegistryOverview } from '@/lib/data/rera';
import { RequestProjectForm } from '@/components/RequestProjectForm';

interface HomeViewProps {
  onNavigate: (view: ViewType, query?: string) => void;
  onSelectProject: (project: ProjectSafetyItem) => void;
  userPreferences: UserPreferences;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => void;
}

const SOURCES = ['TG-RERA', 'TS-bPASS and HMDA approvals', 'HYDRAA lake (FTL) maps', 'IGR guideline values'];

const AREAS = [
  {
    name: 'Neopolis',
    rates: '₹14,000 – ₹17,500',
    tagline: 'High-rise cluster off the Outer Ring Road',
    explanation:
      'Government auction layouts with 100-foot roads. Most towers here are new launches, so check the RERA completion date against the brochure.',
  },
  {
    name: 'Financial District',
    rates: '₹10,500 – ₹17,500',
    tagline: 'Walk-to-work towers near the tech campuses',
    explanation: 'Steady rental demand. Approvals are usually clean; the bigger question is how many towers are launching nearby at the same time.',
  },
  {
    name: 'Kokapet',
    rates: '₹11,000 – ₹14,000',
    tagline: 'Fast-growing belt towards the airport',
    explanation:
      'About 25 minutes to the airport. Several plots sit near nalas and irrigation tanks, so the lake buffer check matters more here than almost anywhere.',
  },
];

const CHECKS = [
  {
    icon: FileCheck2,
    title: 'RERA registration',
    body: 'Is the project registered, is the registration still valid, and are the quarterly filings up to date?',
  },
  {
    icon: Landmark,
    title: 'Building approvals',
    body: 'Do the sanctioned floors and layout match what is being sold? We read the permit, not the brochure.',
  },
  {
    icon: Waves,
    title: 'Lake buffer zones',
    body: 'Does the site fall inside a lake’s full tank level or buffer? A clean title does not rule this out.',
  },
  {
    icon: Receipt,
    title: 'True cost',
    body: 'Stamp duty, registration, GST, parking, clubhouse and floor rise. The number you will actually pay.',
  },
];

const FAQS = [
  {
    q: 'Is this really free?',
    a: 'Yes. Every check on this site is free for buyers, and you can read any report without giving us your number.',
  },
  {
    q: 'Where does the information come from?',
    a: `Public government records: ${SOURCES.join(', ')}. Every report shows the source and the date we last checked it. A person reviews every change before it goes live.`,
  },
  {
    q: 'What do the verdicts mean?',
    a: '“Looks safe” means the records we checked are in order. “Needs a closer look” means something is missing, late or unclear. “High risk” means a record points to a real problem, such as a lapsed registration or a site inside a lake buffer. None of them replaces a lawyer’s title check.',
  },
  {
    q: 'Who runs hyderabad.properties?',
    a: `${OWNERSHIP_LINE} House of Investors is a Hyderabad real estate advisory that also sells homes for some builders. Every project, including those, goes through the same published checks, and we show a negative result on our own projects the same way we show anyone else’s.`,
  },
  {
    q: 'What happens if I share my number?',
    a: 'One expert gets in touch about the project you asked about. We don’t sell your details or pass them to brokers, and you can ask us to delete them at any time.',
  },
  {
    q: 'Is this legal advice?',
    a: 'No. It is a fast, independent first check. Before you pay a booking amount, have a qualified lawyer verify the title and the sale agreement.',
  },
];

export function HomeView({ onNavigate, onSelectProject, userPreferences, onUpdatePreferences }: HomeViewProps) {
  const initialStep = userPreferences.timeline ? 'results' : 'idle';
  const [miniStep, setMiniStep] = useState<'idle' | 1 | 2 | 3 | 'results'>(initialStep);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchArea, setSearchArea] = useState('');
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const { projects, getProject } = useLiveData();

  // TG-RERA registry: every registered project, shown as "official record, not yet checked"
  const [registry, setRegistry] = useState<RegistryOverview | null>(null);
  const [suggestions, setSuggestions] = useState<RegistryHit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBoxRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch('/api/rera/overview')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: RegistryOverview | null) => j && setRegistry(j))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const q = [searchQuery, searchArea].filter(Boolean).join(' ').trim();
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/rera/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((j: { results: RegistryHit[] }) => setSuggestions(j.results ?? []))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [searchQuery, searchArea]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const checkedMatches = searchQuery.trim().length >= 2
    ? projects.filter((p) => `${p.name} ${p.location}`.toLowerCase().includes(searchQuery.trim().toLowerCase())).slice(0, 3)
    : [];

  const featured = ['aurelia-heights', 'skyline-crest']
    .map((id) => getProject(id))
    .filter(Boolean) as ProjectSafetyItem[];
  const featuredPair = featured.length === 2 ? featured : projects.filter((p) => p.status === 'safe').slice(0, 2);
  const otherProjects = projects.filter((p) => !featuredPair.some((f) => f.id === p.id)).slice(0, 6);

  const recommendedProjects: ProjectSafetyItem[] = projects.filter((p) => p.status !== 'risk').slice(0, 3);
  const riskCount = projects.filter((p) => p.status !== 'safe').length;

  const openProject = (project: ProjectSafetyItem) => {
    onSelectProject(project);
    onNavigate('project');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('check', [searchQuery, searchArea].filter(Boolean).join(' ').trim());
  };

  const handleResetFlow = () => {
    onUpdatePreferences({ lookingFor: undefined, location: undefined, timeline: undefined });
    setMiniStep('idle');
  };

  return (
    <div className="animate-in fade-in duration-300">
      {/* 1. HERO: full-bleed rounded photo with the search bar on top, as in HouseMarket Home V1 */}
      <section className="px-2 sm:px-4 lg:px-6">
        <div className="relative z-20 rounded-[24px] min-h-[620px] sm:min-h-[680px] flex">
          {/* Photo is clipped in its own layer so the search suggestions can drop below the hero */}
          <div className="absolute inset-0 overflow-hidden rounded-[24px]">
            <img
              src="/img/hero.jpg"
              alt="Balcony of a high-rise apartment looking over the city at dusk"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/35 to-black/25 sm:bg-gradient-to-r sm:from-white/90 sm:via-white/45 sm:to-transparent" />
          </div>

          <div className="relative hm-container flex flex-col justify-between py-12 sm:py-20">
            <div className="max-w-2xl space-y-5" data-reveal>
              <h1 className="text-[40px] leading-[1.08] sm:text-[56px] lg:text-[64px] font-medium text-[#212121] tracking-[-0.03em]">
                Know if a Hyderabad home is safe before you pay a rupee
              </h1>
              <p className="text-lg text-[#4a4a4a] max-w-xl leading-relaxed">
                Free, independent checks on RERA status, building approvals, lake buffer zones and the true cost. Built
                from government records, explained in plain words.
              </p>
            </div>

            {/* Search bar */}
            <div className="relative mt-10 w-full max-w-3xl">
            <form
              ref={searchBoxRef}
              onSubmit={handleSearchSubmit}
              className="relative w-full bg-white rounded-[20px] sm:rounded-full p-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] flex flex-col sm:flex-row sm:items-center gap-2"
              data-reveal
              role="search"
            >
              <label className="flex-1 flex items-center gap-2.5 px-4 min-h-[48px]">
                <Search className="w-5 h-5 text-[#838383] shrink-0" strokeWidth={1.6} />
                <span className="sr-only">Project name</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Project, builder or RERA number"
                  autoComplete="off"
                  className="w-full bg-transparent text-[15px] text-[#212121] placeholder:text-[#838383] focus:outline-none"
                />
              </label>
              <div className="hidden sm:block w-px h-7 bg-[#eeeeee]" />
              <label className="flex items-center gap-2.5 px-4 min-h-[48px] sm:w-56">
                <MapPin className="w-5 h-5 text-[#838383] shrink-0" strokeWidth={1.6} />
                <span className="sr-only">Area</span>
                <select
                  value={searchArea}
                  onChange={(e) => setSearchArea(e.target.value)}
                  className="w-full bg-transparent text-[15px] text-[#212121] focus:outline-none cursor-pointer"
                >
                  <option value="">Any area</option>
                  {(registry?.areas.length ? registry.areas.map((a) => a.name) : Array.from(new Set(projects.map((p) => p.location)))).map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-full bg-[#212121] hover:bg-black text-white text-[15px] font-semibold px-7 min-h-[48px] transition-colors cursor-pointer"
              >
                Check
              </button>

              {showSuggestions && (checkedMatches.length > 0 || suggestions.length > 0) && (
                <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-[20px] bg-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] border border-[#eeeeee] p-2 max-h-[420px] overflow-y-auto text-left">
                  {checkedMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openProject(p)}
                      className="w-full flex items-center justify-between gap-3 rounded-[14px] px-4 py-3 hover:bg-[#f9f9f9] text-left cursor-pointer"
                    >
                      <span>
                        <span className="block text-[15px] font-medium text-[#212121]">{p.name}</span>
                        <span className="block text-[13px] text-[#838383]">{p.location} · checked report</span>
                      </span>
                      <SafetyBadge status={p.status} size="sm" showScore={false} />
                    </button>
                  ))}
                  {suggestions.length > 0 && (
                    <p className="px-4 pt-2 pb-1 text-[12px] font-semibold uppercase tracking-wide text-[#a3a3a3]">On the TG-RERA record</p>
                  )}
                  {suggestions.map((h) => (
                    <a key={h.slug} href={`/rera/${h.slug}`} className="block rounded-[14px] px-4 py-3 hover:bg-[#f9f9f9]">
                      <span className="block text-[15px] font-medium text-[#212121]">{h.name}</span>
                      <span className="block text-[13px] text-[#838383]">
                        {[h.promoter, h.locality ?? h.mandal, h.projectStatus].filter(Boolean).join(' · ')}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </form>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PROOF STRIP: real numbers only */}
      <section className="hm-container">
        <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-[#eeeeee]" data-reveal>
          {[
            registry?.total
              ? { value: registry.total.toLocaleString('en-IN'), label: 'Projects on the TG-RERA record' }
              : { value: String(projects.length), label: 'Projects checked so far' },
            { value: String(SOURCES.length), label: 'Government sources read' },
            registry?.total
              ? { value: registry.flagged.toLocaleString('en-IN'), label: 'Filings with a missed deadline or litigation' }
              : { value: String(riskCount), label: 'Projects with something to look at' },
            { value: '₹0', label: 'Cost to you, always' },
          ].map((s, i) => (
            <div key={s.label} className={`py-8 sm:py-10 px-2 sm:px-6 ${i % 2 === 1 ? 'border-l' : ''} lg:border-l border-[#eeeeee] ${i === 0 ? 'lg:border-l-0' : ''}`}>
              <div className="text-[36px] sm:text-[44px] font-medium tracking-[-0.03em] text-[#212121] leading-none">{s.value}</div>
              <div className="mt-2 text-[15px] text-[#838383]">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. HOW IT WORKS: "as easy as 1, 2, 3" */}
      <section className="hm-container pt-24 sm:pt-32">
        <div className="text-center max-w-2xl mx-auto space-y-4" data-reveal>
          <h2 className="text-[34px] sm:text-[44px] leading-[1.15] font-medium tracking-[-0.02em] text-[#212121]">
            Check any project as easy as 1, 2, 3
          </h2>
          <p className="text-[17px] text-[#838383]">
            You shouldn’t need five government portals and a lawyer on speed dial to know if a project is sound.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="relative overflow-hidden rounded-[16px] aspect-[4/3.4]" data-reveal>
            <img
              src="/img/hussain-sagar.jpg"
              alt="Hussain Sagar lake with the Hyderabad skyline behind it"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          <div className="space-y-10">
            {[
              {
                n: '1',
                icon: Search,
                title: 'Search the project you are considering',
                body: 'By name, builder or area. If we haven’t checked it yet, ask us and we add it to the queue.',
              },
              {
                n: '2',
                icon: ShieldCheck,
                title: 'Read a plain-English verdict',
                body: 'RERA, approvals, lake buffer and true cost on one page, each with the government source behind it.',
              },
              {
                n: '3',
                icon: BellRing,
                title: 'Watch it until you sign',
                body: 'Get a WhatsApp or email alert the day a registration lapses, a penalty lands or an approval changes.',
              },
            ].map((step) => (
              <div key={step.n} className="grid grid-cols-[48px_1fr] gap-5" data-reveal>
                <div className="w-12 h-12 rounded-full bg-[#f2f2f2] flex items-center justify-center text-[#212121]">
                  <step.icon className="w-5 h-5" strokeWidth={1.6} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-[22px] sm:text-[24px] leading-tight font-medium text-[#212121]">{step.title}</h3>
                  <p className="text-[16px] text-[#838383] leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
            <div className="pl-[68px]" data-reveal>
              <button
                type="button"
                onClick={() => onNavigate('check')}
                className="rounded-full bg-[#212121] hover:bg-black text-white text-[15px] font-semibold px-7 py-3 transition-colors cursor-pointer"
              >
                Check a project
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. WHAT WE CHECK: dark band, like the template's "best way to find your home" */}
      <section className="px-2 sm:px-4 lg:px-6 pt-24 sm:pt-32">
        <div className="relative overflow-hidden rounded-[24px] bg-[#212121]">
          <img src="/img/interior.jpg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-25" />
          <div className="relative hm-container py-16 sm:py-24 space-y-12">
            <div className="max-w-2xl space-y-4" data-reveal>
              <h2 className="text-[34px] sm:text-[44px] leading-[1.15] font-medium tracking-[-0.02em] text-white">
                The four checks every Hyderabad buyer should run
              </h2>
              <p className="text-[17px] text-white/70">
                The records exist, but they sit on different portals and no one joins them up for you. We do.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CHECKS.map((c) => (
                <div key={c.title} className="rounded-[16px] bg-white/[0.07] backdrop-blur-sm border border-white/10 p-6 space-y-4" data-reveal>
                  <c.icon className="w-6 h-6 text-white" strokeWidth={1.5} />
                  <h3 className="text-[20px] font-medium text-white">{c.title}</h3>
                  <p className="text-[15px] text-white/65 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5a. NEW ON THE TG-RERA RECORD: shown until our first checked reports are published */}
      {featuredPair.length === 0 && registry && registry.recent.length > 0 && (
        <section className="hm-container pt-24 sm:pt-32">
          <div className="text-center max-w-2xl mx-auto space-y-4" data-reveal>
            <h2 className="text-[34px] sm:text-[44px] leading-[1.15] font-medium tracking-[-0.02em] text-[#212121]">
              Newly registered with TG-RERA
            </h2>
            <p className="text-[17px] text-[#838383]">
              The builder&apos;s own filing for every registered project in and around Hyderabad: status, completion date,
              approvals and location. Our full checks are added project by project.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {registry.recent.map((r) => (
              <a
                key={r.slug}
                href={`/rera/${r.slug}`}
                className="group rounded-[16px] border border-[#eeeeee] bg-white p-6 hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.25)] transition-shadow"
                data-reveal
              >
                <span className="inline-block rounded-full bg-[#f4f4f4] px-3 py-1 text-[12px] font-medium text-[#4a4a4a]">
                  {r.projectStatus ?? 'Registered'}
                </span>
                <h3 className="mt-4 text-[20px] font-medium text-[#212121] group-hover:underline underline-offset-4">{r.name}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-[15px] text-[#838383]">
                  <MapPin className="w-4 h-4 shrink-0" strokeWidth={1.6} />
                  {[r.locality ?? r.mandal, r.district].filter(Boolean).join(', ')}
                </p>
                {r.promoter && <p className="mt-1 text-[14px] text-[#838383]">{r.promoter}</p>}
                <div className="pt-3 mt-4 border-t border-[#eeeeee] flex items-center justify-between text-[14px]">
                  <span className="text-[#212121]">
                    {r.completion ? `Completion ${new Date(r.completion).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : r.registrationNo}
                  </span>
                  <span className="text-[#838383]">{r.totalUnits ? `${r.totalUnits.toLocaleString('en-IN')} units` : r.authority}</span>
                </div>
              </a>
            ))}
          </div>
          <div className="mt-10 text-center" data-reveal>
            <a
              href="/rera"
              className="inline-block rounded-full bg-[#212121] hover:bg-black text-white text-[15px] font-semibold px-7 py-3 transition-colors"
            >
              Browse all {registry.total.toLocaleString('en-IN')} registered projects
            </a>
          </div>
        </section>
      )}

      {/* 5. FEATURED PROJECTS: two large photo cards with overlaid text */}
      {featuredPair.length > 0 && (
      <section className="hm-container pt-24 sm:pt-32">
        <div className="text-center max-w-2xl mx-auto space-y-4" data-reveal>
          <h2 className="text-[34px] sm:text-[44px] leading-[1.15] font-medium tracking-[-0.02em] text-[#212121]">
            Recently checked projects
          </h2>
          <p className="text-[17px] text-[#838383]">Open any report to see what we found and where it came from.</p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
          {featuredPair.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => openProject(project)}
              className="group relative overflow-hidden rounded-[16px] aspect-[4/4.2] text-left cursor-pointer"
              data-reveal
            >
              <img
                src={projectImage(project.id)}
                alt={`${REPRESENTATIVE_PHOTO_LABEL} for ${project.name}`}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/50" />
              <div className="relative h-full p-7 sm:p-9 flex flex-col justify-between text-white">
                <div className="space-y-3 max-w-md">
                  <h3 className="text-[26px] sm:text-[30px] leading-tight font-medium">{project.name}</h3>
                  <p className="text-[15px] text-white/85 leading-relaxed line-clamp-2">{project.summary}</p>
                  <p className="flex items-center gap-1.5 text-[15px] font-medium">
                    <MapPin className="w-4 h-4" strokeWidth={1.8} />
                    {project.location}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="bg-white rounded-full">
                    <SafetyBadge status={project.status} size="sm" showScore={false} />
                  </div>
                  <span className="text-[11px] text-white/70">{REPRESENTATIVE_PHOTO_LABEL}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* All other checked projects */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {otherProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => openProject(project)}
              className="group text-left rounded-[16px] border border-[#eeeeee] bg-white overflow-hidden hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.25)] transition-shadow cursor-pointer"
              data-reveal
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={projectImage(project.id)}
                  alt={`${REPRESENTATIVE_PHOTO_LABEL} for ${project.name}`}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute top-3 left-3 bg-white rounded-full">
                  <SafetyBadge status={project.status} size="sm" showScore={false} />
                </div>
                <span className="absolute bottom-2 right-3 text-[11px] text-white/80 drop-shadow">{REPRESENTATIVE_PHOTO_LABEL}</span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="text-[20px] font-medium text-[#212121]">{project.name}</h3>
                <p className="flex items-center gap-1.5 text-[15px] text-[#838383]">
                  <MapPin className="w-4 h-4" strokeWidth={1.6} />
                  {project.location}
                </p>
                <div className="pt-3 mt-1 border-t border-[#eeeeee] flex items-center justify-between text-[14px]">
                  <span className="font-semibold text-[#212121]">{project.priceRange}</span>
                  <span className="text-[#838383]">{project.config}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-10 text-center" data-reveal>
          <button
            type="button"
            onClick={() => onNavigate('check')}
            className="rounded-full border border-[#eeeeee] hover:border-[#212121] text-[#212121] text-[15px] font-semibold px-7 py-3 transition-colors cursor-pointer"
          >
            See all checked projects
          </button>
        </div>
      </section>
      )}

      {/* 6. MATCH QUIZ: three questions, then a shortlist (lead capture) */}
      <section className="hm-container pt-24 sm:pt-32">
        <div className="rounded-[24px] bg-[#f9f9f9] p-6 sm:p-12 lg:p-16 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16" data-reveal>
          <div className="space-y-4">
            <h2 className="text-[34px] sm:text-[44px] leading-[1.15] font-medium tracking-[-0.02em] text-[#212121]">
              Not sure where to start?
            </h2>
            <p className="text-[17px] text-[#838383] leading-relaxed">
              Answer three quick questions and we’ll show the checked projects that fit how and when you plan to buy.
              No phone number needed.
            </p>
          </div>

          <div>
            {miniStep === 'idle' && (
              <div className="h-full flex flex-col justify-center gap-5">
                <ul className="space-y-3 text-[16px] text-[#4a4a4a]">
                  {['Home to live in, or an investment?', 'Buying from Hyderabad, elsewhere in India, or abroad?', 'When do you want possession?'].map((q) => (
                    <li key={q} className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-[#212121] shrink-0" strokeWidth={2} />
                      {q}
                    </li>
                  ))}
                </ul>
                <div>
                  <button
                    type="button"
                    onClick={() => setMiniStep(1)}
                    className="rounded-full bg-[#212121] hover:bg-black text-white text-[15px] font-semibold px-7 py-3 transition-colors cursor-pointer"
                  >
                    Start, it takes 30 seconds
                  </button>
                </div>
              </div>
            )}

            {(miniStep === 1 || miniStep === 2 || miniStep === 3) && (
              <QuizStep
                step={miniStep}
                userPreferences={userPreferences}
                onCancel={handleResetFlow}
                onBack={() => setMiniStep(miniStep === 3 ? 2 : 1)}
                onAnswer={(prefs, next) => {
                  onUpdatePreferences(prefs);
                  setMiniStep(next);
                }}
              />
            )}

            {miniStep === 'results' && (
              <QuizResults
                userPreferences={userPreferences}
                projects={recommendedProjects}
                onOpen={openProject}
                onReset={handleResetFlow}
              />
            )}
          </div>
        </div>
      </section>

      {/* 7. AREAS */}
      <section className="hm-container pt-24 sm:pt-32">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4" data-reveal>
          <div className="max-w-xl space-y-4">
            <h2 className="text-[34px] sm:text-[44px] leading-[1.15] font-medium tracking-[-0.02em] text-[#212121]">
              Know the area, not just the tower
            </h2>
            <p className="text-[17px] text-[#838383]">Current price ranges per sq ft and what to watch for in each corridor.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('commute')}
            className="self-start sm:self-auto rounded-full border border-[#eeeeee] hover:border-[#212121] text-[#212121] text-[15px] font-semibold px-6 py-3 transition-colors cursor-pointer"
          >
            Search by commute
          </button>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {AREAS.map((area) => {
            const isOpen = expandedArea === area.name;
            return (
              <div key={area.name} className="rounded-[16px] border border-[#eeeeee] overflow-hidden bg-white" data-reveal>
                <div className="relative aspect-[16/11] overflow-hidden">
                  <img src={AREA_IMAGES[area.name]} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <div className="p-6 space-y-3">
                  <h3 className="text-[22px] font-medium text-[#212121]">{area.name}</h3>
                  <p className="text-[15px] text-[#838383]">{area.tagline}</p>
                  <p className="text-[16px] font-semibold text-[#212121]">
                    {area.rates} <span className="font-normal text-[#838383]">/ sq ft</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setExpandedArea(isOpen ? null : area.name)}
                    aria-expanded={isOpen}
                    className="w-full pt-3 mt-1 border-t border-[#eeeeee] flex items-center justify-between text-[15px] font-medium text-[#212121] cursor-pointer"
                  >
                    What to watch for here
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={1.8} />
                  </button>
                  {isOpen && <p className="text-[15px] text-[#6b6b6b] leading-relaxed animate-in fade-in duration-200">{area.explanation}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="hm-container pt-24 sm:pt-32">
        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
          <div className="space-y-4" data-reveal>
            <h2 className="text-[34px] sm:text-[44px] leading-[1.15] font-medium tracking-[-0.02em] text-[#212121]">
              Questions buyers ask us
            </h2>
            <p className="text-[17px] text-[#838383]">Something else on your mind? Ask an expert, it’s free.</p>
            <button
              type="button"
              onClick={() => onNavigate('concierge')}
              className="rounded-full border border-[#eeeeee] hover:border-[#212121] text-[#212121] text-[15px] font-semibold px-6 py-3 transition-colors cursor-pointer"
            >
              Ask a question
            </button>
          </div>

          <div className="divide-y divide-[#eeeeee] border-y border-[#eeeeee]" data-reveal>
            {FAQS.map((f, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={f.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full py-6 flex items-center justify-between gap-6 text-left cursor-pointer"
                  >
                    <span className="text-[19px] sm:text-[20px] font-medium text-[#212121]">{f.q}</span>
                    <span className="w-9 h-9 rounded-full bg-[#f2f2f2] flex items-center justify-center shrink-0">
                      {isOpen ? <Minus className="w-4 h-4" strokeWidth={1.8} /> : <Plus className="w-4 h-4" strokeWidth={1.8} />}
                    </span>
                  </button>
                  {isOpen && <p className="pb-6 -mt-2 pr-14 text-[16px] text-[#6b6b6b] leading-relaxed animate-in fade-in duration-200">{f.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. LEAD BAND: free expert check */}
      <section className="px-2 sm:px-4 lg:px-6 pt-24 sm:pt-32">
        <ExpertCheckBand />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const QUIZ: Record<
  1 | 2 | 3,
  { title: string; key: keyof UserPreferences; options: { label: string; desc: string }[] }
> = {
  1: {
    title: 'What are you looking for?',
    key: 'lookingFor',
    options: [
      { label: 'A home to live in', desc: 'For your family to move into' },
      { label: 'An investment', desc: 'Rental income and price growth' },
      { label: 'Not sure yet', desc: 'Still comparing areas and prices' },
    ],
  },
  2: {
    title: 'Where are you based?',
    key: 'location',
    options: [
      { label: 'Hyderabad', desc: 'You can visit sites in person' },
      { label: 'Elsewhere in India', desc: 'You visit Hyderabad now and then' },
      { label: 'Abroad (NRI)', desc: 'You will need checks done remotely' },
    ],
  },
  3: {
    title: 'When do you want to buy?',
    key: 'timeline',
    options: [
      { label: 'Within 6 months', desc: 'Ready to move, or close to possession' },
      { label: '6-12 months', desc: 'Under construction is fine' },
      { label: 'Just exploring', desc: 'Getting a feel for prices' },
    ],
  },
};

function QuizStep({
  step,
  userPreferences,
  onAnswer,
  onBack,
  onCancel,
}: {
  step: 1 | 2 | 3;
  userPreferences: UserPreferences;
  onAnswer: (prefs: Partial<UserPreferences>, next: 2 | 3 | 'results') => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const q = QUIZ[step];
  const next = step === 1 ? 2 : step === 2 ? 3 : 'results';
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between text-[14px] text-[#838383]">
        <span>Question {step} of 3</span>
        <button type="button" onClick={onCancel} className="hover:text-[#212121] cursor-pointer">
          Cancel
        </button>
      </div>
      <div className="h-1 w-full bg-[#eeeeee] rounded-full overflow-hidden">
        <div className="h-full bg-[#212121] transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
      </div>
      <h3 className="text-[24px] font-medium text-[#212121]">{q.title}</h3>
      <div className="grid gap-3">
        {q.options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onAnswer({ [q.key]: opt.label } as Partial<UserPreferences>, next)}
            className={`p-4 sm:p-5 text-left rounded-[14px] border bg-white transition-colors cursor-pointer flex items-center justify-between ${
              userPreferences[q.key] === opt.label ? 'border-[#212121]' : 'border-[#eeeeee] hover:border-[#c9c9c9]'
            }`}
          >
            <span>
              <span className="block text-[16px] font-semibold text-[#212121]">{opt.label}</span>
              <span className="block text-[14px] text-[#838383] mt-0.5">{opt.desc}</span>
            </span>
            <ChevronRight className="w-5 h-5 text-[#838383] shrink-0 ml-3" strokeWidth={1.6} />
          </button>
        ))}
      </div>
      {step > 1 && (
        <button type="button" onClick={onBack} className="text-[14px] text-[#838383] hover:text-[#212121] underline cursor-pointer">
          Back
        </button>
      )}
    </div>
  );
}

function QuizResults({
  userPreferences,
  projects,
  onOpen,
  onReset,
}: {
  userPreferences: UserPreferences;
  projects: ProjectSafetyItem[];
  onOpen: (p: ProjectSafetyItem) => void;
  onReset: () => void;
}) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError(null);
    const err = await submitLead({
      source: 'shortlist',
      email: email.trim(),
      phone: phone.trim() || undefined,
      preferences: { ...userPreferences },
      message: `Shortlist: ${projects.map((p) => p.name).join(', ')}`,
    });
    if (err) {
      setError(err);
      setState('idle');
    } else {
      setState('sent');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[24px] font-medium text-[#212121]">Your checked matches</h3>
        <button type="button" onClick={onReset} className="flex items-center gap-1.5 text-[14px] text-[#838383] hover:text-[#212121] cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.8} />
          Change answers
        </button>
      </div>

      {userPreferences.location === 'Abroad (NRI)' && (
        <div className="rounded-[14px] bg-white border border-[#eeeeee] p-4 flex items-start gap-3 text-[14px] text-[#6b6b6b]">
          <Globe className="w-5 h-5 text-[#212121] shrink-0 mt-0.5" strokeWidth={1.5} />
          <p>
            <strong className="text-[#212121]">Buying from abroad?</strong> An expert can run the title and power of attorney
            checks and send you a site video, so you don’t have to fly in.
          </p>
        </div>
      )}

      <div className="grid gap-3">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpen(project)}
            className="group flex items-center gap-4 p-3 rounded-[14px] bg-white border border-[#eeeeee] hover:border-[#212121] text-left transition-colors cursor-pointer"
          >
            <img src={projectImage(project.id)} alt="" aria-hidden="true" className="w-20 h-16 rounded-[10px] object-cover shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-semibold text-[#212121] truncate">{project.name}</span>
              <span className="block text-[14px] text-[#838383] truncate">
                {project.location} · {project.priceRange}
              </span>
            </span>
            <SafetyBadge status={project.status} size="sm" showScore={false} />
            <ArrowUpRight className="w-5 h-5 text-[#838383] group-hover:text-[#212121] shrink-0 hidden sm:block" strokeWidth={1.6} />
          </button>
        ))}
      </div>

      <div className="rounded-[14px] bg-white border border-[#eeeeee] p-5 space-y-3">
        <h4 className="text-[17px] font-semibold text-[#212121]">Email me this shortlist with the source documents</h4>
        {state === 'sent' ? (
          <p className="flex items-center gap-2 text-[15px] text-[#212121]">
            <Check className="w-4 h-4" strokeWidth={2} /> On its way to {email}.
          </p>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                aria-label="Email address"
                className="w-full px-4 min-h-[48px] rounded-full border border-[#eeeeee] bg-white text-[15px] focus:outline-none focus:border-[#212121]"
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="WhatsApp (optional)"
                aria-label="WhatsApp number, optional"
                className="w-full px-4 min-h-[48px] rounded-full border border-[#eeeeee] bg-white text-[15px] focus:outline-none focus:border-[#212121]"
              />
            </div>
            {error && <p className="text-[14px] text-rose-700">{error}</p>}
            <button
              type="submit"
              disabled={state === 'sending'}
              className="rounded-full bg-[#212121] hover:bg-black text-white text-[15px] font-semibold px-6 py-3 transition-colors cursor-pointer disabled:opacity-60"
            >
              {state === 'sending' ? 'Sending…' : 'Send me the shortlist'}
            </button>
            <PrivacyPledge compact />
          </form>
        )}
      </div>
    </div>
  );
}

function ExpertCheckBand() {
  return (
    <div className="relative overflow-hidden rounded-[24px] min-h-[520px] flex items-center">
      <img src="/img/night-skyline.jpg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative hm-container py-16 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
        <div className="space-y-4 text-white" data-reveal>
          <h2 className="text-[34px] sm:text-[48px] leading-[1.1] font-medium tracking-[-0.02em]">
            Project not on our list yet? We’ll check it for free.
          </h2>
          <p className="text-[17px] text-white/75 max-w-lg">
            Tell us the basics. We pull its RERA, approval and lake records and send you the report, usually within two
            working days. Then it’s on the site for every buyer after you.
          </p>
        </div>

        <div className="rounded-[20px] bg-white p-6 sm:p-8" data-reveal>
          <RequestProjectForm title="Request a free check" />
        </div>
      </div>
    </div>
  );
}
