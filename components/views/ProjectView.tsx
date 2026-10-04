'use client';

import React, { useState } from 'react';
import { 
  AlertOctagon, 
  MapPin, 
  Clock, 
  ChevronDown, 
  ChevronRight, 
  Share2, 
  PhoneCall, 
  Check, 
  CheckCircle2, 
  XCircle,
  Building2,
  ArrowLeft,
  Bell,
  Mail,
  MessageSquare,
  Receipt,
  Trash2
} from 'lucide-react';
import { MICRO_MARKETS, MicroMarketLive, ProjectSafetyItem } from '@/lib/mock-data';
import { useLiveData, formatDate } from '@/components/live/LiveDataProvider';
import { SafetyBadge } from '@/components/SafetyBadge';
import { JargonTooltip } from '@/components/JargonTooltip';
import { ViewType } from '@/components/TopBar';
import { SaveButton } from '@/components/account/SaveButton';

interface ProjectViewProps {
  project: ProjectSafetyItem;
  onNavigate: (view: ViewType) => void;
  onSelectProject: (project: ProjectSafetyItem) => void;
  isWatching?: boolean;
  onOpenWatchSheet?: (project: ProjectSafetyItem) => void;
  onStopWatching?: (projectId: string) => void;
}

export function ProjectView({ 
  project, 
  onNavigate, 
  onSelectProject,
  isWatching = false,
  onOpenWatchSheet,
  onStopWatching
}: ProjectViewProps) {
  const [isWhyWarningOpen, setIsWhyWarningOpen] = useState(false);
  const [openSafetyDetails, setOpenSafetyDetails] = useState<{ [key: string]: boolean }>({});
  const [copied, setCopied] = useState(false);
  const [isStopWatchingMenuOpen, setIsStopWatchingMenuOpen] = useState(false);

  // Watch project state

  // Document upload state

  // Micro-market calculations
  const { projects: liveProjects, marketFor, alertsFor } = useLiveData();
  // The micro_markets rows are still the template's demo ranges, not transacted prices. Keep the
  // benchmark hidden until real figures are loaded with a source.
  const realMarket: MicroMarketLive | null = null;
  const market: MicroMarketLive = marketFor(project) ?? MICRO_MARKETS[0];
  const projectAlerts = alertsFor(project.id);
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const reraExpired = !!project.reraValidUntil && project.reraValidUntil < new Date().toISOString().slice(0, 10);
  const areaAvgRate = Math.round((market.minRate + market.maxRate) / 2);
  const rateDiffPercent = Math.round(((project.ratePerSqFt - areaAvgRate) / areaAvgRate) * 100);

  const toggleSafetyDetail = (id: string) => {
    setOpenSafetyDetails((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleShare = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tailoredQuestions: string[] = project.questions?.length
    ? project.questions
    : project.status === 'risk'
    ? [
        'Can the builder show the official revenue survey map superimposing the 30-meter lake buffer line?',
        'Has the project received written confirmation from HYDRAA regarding survey plot clearance?',
        'Will our individual apartment deed guarantee compensation if municipal sanctions are challenged in court?',
        'Which designated nationalized banks have approved unconditional home loans for this specific survey number?',
        'Can I review the non-agricultural land conversion order (NALA) and town planning master sanction?'
      ]
    : project.status === 'warning'
    ? [
        'Has the revised sanction for upper floors received final municipal planning sign-off?',
        'When is the RERA quarterly disclosure update scheduled, and can I see the latest architect milestone certificate?',
        'What is the precise distance between the nearest compound wall and the local stormwater channel (nala)?',
        'What is the exact undivided share of land (UDS) registered in the draft agreement of sale?',
        'Is there any pending litigation or ceiling review on the survey numbers comprising this layout?'
      ]
    : [
        'Can you provide the sanctioned floor-by-floor architectural drawing for my specific flat and floor?',
        'What is the registered RERA escrow bank account number into which all buyer payments are deposited?',
        'What is the exact undivided share of land (UDS) allocated to this specific unit?',
        'Are the clubhouse, sports amenities, and sub-station included in the common undivided layout property?',
        'Can you provide the 30-year non-encumbrance certificate (EC) up to the current calendar month?'
      ];

  const beginnerSummary = project.summary;

  return (
    <div className="space-y-8 animate-in fade-in duration-200 pb-24 md:pb-12">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="text-xs font-semibold text-[#6b6b6b] hover:text-[#212121] inline-flex items-center gap-1.5 py-1 min-h-[44px] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span>Back to Home</span>
        </button>
      </div>

      {/* Switcher Bar */}
      <div className="bg-[#f2f2f2] p-3 rounded-xl border border-[#eeeeee] flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs font-semibold text-[#6b6b6b]">
          Viewing Project Audit:
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {liveProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectProject(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] cursor-pointer ${
                p.id === project.id
                  ? 'bg-white text-[#212121] font-bold border border-[#eeeeee] shadow-2xs'
                  : 'text-[#6b6b6b] hover:text-[#212121]'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* STICKY SUMMARY HEADER */}
      <header className="sticky top-18 z-30 bg-[#f9f9f9] border border-[#eeeeee] rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-[#212121] shrink-0" strokeWidth={1.5} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-medium text-lg sm:text-xl text-[#212121]">
                {project.name}
              </h1>
              <span className="text-xs text-[#838383] font-medium">
                · {project.location}
              </span>
            </div>
            <div className="text-[11px] font-mono text-[#838383]">
              RERA: {project.reraNumber}
              {project.reraValidUntil && (
                <span className={reraExpired ? 'text-rose-700 font-semibold' : ''}>
                  {' '}· Completion due {formatDate(project.reraValidUntil)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
          {/* Watch secondary button */}
          {isWatching ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsStopWatchingMenuOpen(!isStopWatchingMenuOpen)}
                className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer min-h-[36px]"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
                <span>Watching</span>
              </button>
              {isStopWatchingMenuOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-white border border-[#eeeeee] rounded-lg shadow-lg p-1 z-30 animate-in fade-in duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (onStopWatching) onStopWatching(project.id);
                      setIsStopWatchingMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50 rounded font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Stop watching</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenWatchSheet && onOpenWatchSheet(project)}
              className="px-3 py-1.5 rounded-full border border-[#e0e0e0] hover:border-[#212121] bg-white text-[#4a4a4a] hover:text-[#212121] text-xs font-mono font-semibold inline-flex items-center gap-1.5 cursor-pointer min-h-[36px]"
            >
              <Bell className="w-3.5 h-3.5 text-[#212121]" strokeWidth={1.5} />
              <span>Watch this project</span>
            </button>
          )}

          <SafetyBadge status={project.status} size="sm" showScore={false} />

          {/* Small Score Ring */}
          <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="14"
                className="stroke-[#eeeeee] fill-none"
                strokeWidth="3.5"
              />
              <circle
                cx="18"
                cy="18"
                r="14"
                className={`fill-none ${
                  project.status === 'safe'
                    ? 'stroke-emerald-600'
                    : project.status === 'warning'
                    ? 'stroke-amber-500'
                    : 'stroke-rose-600'
                }`}
                strokeWidth="3.5"
                strokeDasharray={87.96}
                strokeDashoffset={87.96 * (1 - project.score / 100)}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[11px] font-bold text-[#212121]">
              {project.score}
            </span>
          </div>
        </div>
      </header>

      {/* LIVE REGULATORY UPDATES */}
      {projectAlerts.length > 0 && (
        <section
          aria-label="Recent regulatory updates"
          className="bg-[#212121] text-white rounded-2xl p-5 sm:p-6 space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest font-bold text-white">
              <span className="w-2 h-2 rounded-full bg-[#212121] animate-pulse" />
              <span>Notice verified on {formatDate(projectAlerts[0].publishedAt)}</span>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#AAAAAA]">
              Last verified {project.lastVerifiedDate}
            </span>
          </div>
          <div className="space-y-1.5">
            <span className="inline-block font-mono text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-[#212121] text-white">
              {projectAlerts[0].type}
            </span>
            <p className="text-sm sm:text-base font-semibold leading-relaxed">{projectAlerts[0].whatChanged}</p>
            <p className="text-xs sm:text-sm text-[#CFCFCF] leading-relaxed">{projectAlerts[0].whatItMeans}</p>
          </div>
          {projectAlerts.length > 1 && (
            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowAllUpdates(!showAllUpdates)}
                className="font-mono text-[11px] uppercase tracking-wider font-bold text-white hover:text-white inline-flex items-center gap-1 py-1 cursor-pointer"
              >
                <span>{showAllUpdates ? 'Hide earlier updates' : `Earlier updates (${projectAlerts.length - 1})`}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllUpdates ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>
              {showAllUpdates && (
                <ul className="mt-2 space-y-2.5">
                  {projectAlerts.slice(1, 8).map((a) => (
                    <li key={a.id} className="text-xs leading-relaxed">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#AAAAAA]">
                        {formatDate(a.publishedAt)} · {a.type}
                      </span>
                      <p className="text-[#E2E2E2]">{a.whatChanged}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {/* RED-STATUS WARNING CARD */}
      {project.status === 'risk' && (
        <section className="bg-rose-50 border border-rose-200 rounded-xl p-6 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="space-y-1">
              <h2 className="font-medium text-lg text-rose-950">
                Critical Safety Warning: Buffer Zone Conflict Detected
              </h2>
              <p className="text-xs sm:text-sm text-rose-900 leading-relaxed">
                Cadastral mapping indicates that this layout borders or encroaches upon protected lake full tank level (<JargonTooltip term="FTL" />) boundaries. In Hyderabad, civic authorities under <JargonTooltip term="HYDRAA" /> have been actively demolishing unauthorized structures on waterbodies.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-rose-200">
            <button
              type="button"
              onClick={() => setIsWhyWarningOpen(!isWhyWarningOpen)}
              className="text-xs font-bold text-rose-900 hover:text-rose-950 flex items-center gap-1.5 py-1 min-h-[36px] cursor-pointer"
            >
              <span>{isWhyWarningOpen ? 'Hide analysis' : 'Why this matters for a buyer'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isWhyWarningOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
            </button>

            {isWhyWarningOpen && (
              <div className="mt-2 p-3.5 rounded-lg bg-white border border-rose-200 text-xs text-rose-900 space-y-2 leading-relaxed">
                <p>
                  <strong>1. Demolition & Regularization:</strong> Under state government directives, structures built within lake FTL or nala buffer zones cannot be regularized.
                </p>
                <p>
                  <strong>2. Utility Disconnections:</strong> Properties identified in lake beds face immediate disconnection of municipal drinking water and electricity grids.
                </p>
                <p>
                  <strong>3. Mortgage Denial:</strong> Most nationalized banks will refuse to disburse housing loans or demand immediate recovery if survey coordinates flag buffer violations.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (Content Sections 1 through 5) */}
        <div className="lg:col-span-8 space-y-10">
          
          {/* SECTION 1: "In plain words" */}
          <section className="bg-white rounded-xl border border-[#eeeeee] p-6 sm:p-8 space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-[#212121]">
                Section 1
              </span>
              <button
                type="button"
                onClick={handleShare}
                className="text-xs text-[#838383] hover:text-[#212121] flex items-center gap-1 py-1 px-2.5 rounded-lg border border-[#eeeeee] hover:bg-[#f9f9f9] transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} /> : <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                <span>{copied ? 'Copied' : 'Share'}</span>
              </button>
            </div>

            <h2 className="font-serif text-2xl font-bold text-[#212121]">
              In plain words
            </h2>

            <p className="text-sm sm:text-base text-[#4a4a4a] leading-relaxed">
              {beginnerSummary}
            </p>
          </section>

          {(project.marketedByOwner || project.sources?.length) && (
            <section className="bg-white rounded-xl border border-[#eeeeee] p-6 sm:p-8 space-y-5 text-left">
              {project.marketedByOwner && (
                <p className="rounded-lg bg-[#f9f9f9] p-4 text-sm text-[#4a4a4a] leading-relaxed">
                  Disclosure: House of Investors, which owns hyderabad.properties, is paid to market this project. It was checked
                  against the same records, in the same way, as every other project, and the questions in Section 5 apply in full.
                </p>
              )}
              {project.sources && project.sources.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs uppercase font-bold tracking-wider text-[#212121]">Sources</h3>
                  <ul className="space-y-1 text-sm text-[#4a4a4a]">
                    {project.sources.map((src) => (
                      <li key={src.url + src.label}>
                        <a href={src.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 hover:no-underline">
                          {src.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {project.signedOffBy && (
                <p className="text-xs text-[#838383]">
                  Checked and signed off by {project.signedOffBy}
                  {project.signedOffAt
                    ? ` on ${new Date(project.signedOffAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`
                    : ''}
                  . Builder figures are as filed or advertised on that date.{' '}
                  <a href={`/corrections?page=${encodeURIComponent(`/project?id=${project.id}`)}`} className="underline hover:text-[#212121]">
                    Report an error
                  </a>
                </p>
              )}
            </section>
          )}

          {/* SECTION 2: "Safety checks" */}
          <section className="space-y-4 text-left">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-[#212121]">
                Section 2
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#212121]">
                Safety checks
              </h2>
              <p className="text-xs text-[#838383] mt-0.5">
                What we checked against the TG-RERA record, the HMDA permit and mapped water bodies.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* RERA */}
              <div className="bg-white rounded-xl border border-[#eeeeee] p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {project.reraStatus === 'Active' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                    ) : (
                      <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                    )}
                    <div>
                      <h3 className="font-bold text-base text-[#212121]">
                        <JargonTooltip term="RERA" /> Registration Status
                      </h3>
                      <div className="text-xs text-[#838383] mt-0.5">
                        Checked: <strong>{project.lastVerifiedDate}</strong>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    project.reraStatus === 'Active' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                  }`}>
                    {project.reraStatus}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#6b6b6b] leading-relaxed pl-7">
                  {project.reraStatus === 'Active' && reraExpired
                    ? `Registered with TG-RERA as ${project.reraNumber}, but the completion date on file (${formatDate(project.reraValidUntil)}) has passed. Ask for the TG-RERA extension order.`
                    : project.reraStatus === 'Active'
                    ? `Registered with TG-RERA as ${project.reraNumber}${project.reraValidUntil ? `, with completion due by ${formatDate(project.reraValidUntil)}` : ''}.`
                    : `Registration application renewal is currently processing. No active final certificate publicly listed on the portal.`}
                </p>

                <div className="pl-7 flex flex-wrap gap-1.5">
                  {project.reraValidUntil && (
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#212121]">
                      Valid until {formatDate(project.reraValidUntil)}
                    </span>
                  )}
                  {project.lastQprFiled && (
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#212121]">
                      Last QPR {project.lastQprFiled}
                    </span>
                  )}
                  {project.escrowAccount && (
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#212121]">
                      {project.escrowAccount}
                    </span>
                  )}
                </div>

                <div className="pl-7 pt-1">
                  <button
                    type="button"
                    onClick={() => toggleSafetyDetail('rera')}
                    className="text-xs font-semibold text-[#212121] hover:underline flex items-center gap-1 cursor-pointer py-1"
                  >
                    <span>{openSafetyDetails['rera'] ? 'Hide breakdown' : 'See why (Regulator disclosure)'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openSafetyDetails['rera'] ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                  </button>

                  {openSafetyDetails['rera'] && (
                    <div className="mt-2 p-3 bg-[#f9f9f9] rounded-lg border border-[#eeeeee] text-xs text-[#4a4a4a] leading-relaxed">
                      We read the project’s TG-RERA page: registration, completion date, declared litigation and land affected by widening. We have not done a title search or seen the designated bank account; ask your lawyer for a title report and an encumbrance certificate.
                    </div>
                  )}
                </div>
              </div>

              {/* Building Plans */}
              <div className="bg-white rounded-xl border border-[#eeeeee] p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {project.buildingPlan === 'Approved' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                    ) : (
                      <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                    )}
                    <div>
                      <h3 className="font-bold text-base text-[#212121]">
                        Building Plan Sanction (<JargonTooltip term="GHMC" /> / <JargonTooltip term="HMDA" />)
                      </h3>
                      <div className="text-xs text-[#838383] mt-0.5">
                        Checked: <strong>{project.lastVerifiedDate}</strong>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    project.buildingPlan === 'Approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                  }`}>
                    {project.buildingPlan}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#6b6b6b] leading-relaxed pl-7">
                  {project.buildingPlan === 'Approved'
                    ? `TG-RERA lists HMDA as the approving authority${project.permitNo ? `, permit ${project.permitNo}` : ''}${project.sanctionedConfig ? `. Configuration: ${project.sanctionedConfig}` : ''}.`
                    : 'The developer has applied for an additional floor permission amendment that is pending civic sign-off.'}
                </p>

                <div className="pl-7 flex flex-wrap gap-1.5">
                  {project.sanctionedConfig && (
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#212121]">
                      Sanctioned {project.sanctionedConfig}
                    </span>
                  )}
                  {!!project.sanctionedFloors && (
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#212121]">
                      {project.sanctionedFloors} floors
                    </span>
                  )}
                  {project.permitNo && (
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#212121]">
                      Permit {project.permitNo}
                    </span>
                  )}
                  {project.ocStatus && (
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#212121]">
                      OC {project.ocStatus}
                    </span>
                  )}
                </div>

                <div className="pl-7 pt-1">
                  <button
                    type="button"
                    onClick={() => toggleSafetyDetail('plans')}
                    className="text-xs font-semibold text-[#212121] hover:underline flex items-center gap-1 cursor-pointer py-1"
                  >
                    <span>{openSafetyDetails['plans'] ? 'Hide breakdown' : 'See why (Sanction drawing notes)'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openSafetyDetails['plans'] ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                  </button>

                  {openSafetyDetails['plans'] && (
                    <div className="mt-2 p-3 bg-[#f9f9f9] rounded-lg border border-[#eeeeee] text-xs text-[#4a4a4a] leading-relaxed">
                      We have not reviewed the sanction drawings. Ask the builder for the sanction plan copy and check that your tower and floor are on it.
                    </div>
                  )}
                </div>
              </div>

              {/* Lake Buffer */}
              <div className="bg-white rounded-xl border border-[#eeeeee] p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {project.lakeBuffer === 'Clear' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                    )}
                    <div>
                      <h3 className="font-bold text-base text-[#212121]">
                        Lake & Waterbody Buffer Zone (<JargonTooltip term="FTL" />)
                      </h3>
                      <div className="text-xs text-[#838383] mt-0.5">
                        Checked: <strong>{project.lastVerifiedDate}</strong>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    project.lakeBuffer === 'Clear' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                  }`}>
                    {project.lakeBuffer}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#6b6b6b] leading-relaxed pl-7">
                  {project.lakeBuffer === 'Clear'
                    ? `No mapped lake lies near enough to put the site in a lake buffer${project.nearestLakeMeters != null ? `: the nearest mapped water is about ${project.nearestLakeMeters} m away` : ''}.`
                    : 'Portions of the project boundary lie inside the lake buffer zone flagged under recent HYDRAA enforcement.'}
                </p>

                <div className="pl-7 flex flex-wrap gap-1.5">
                  {project.nearestLakeMeters != null && (
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#212121]">
                      Nearest mapped water {project.nearestLakeMeters} m
                    </span>
                  )}
                  {project.surveyNumbers && (
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#212121]">
                      {project.surveyNumbers}
                    </span>
                  )}
                </div>

                <div className="pl-7 pt-1">
                  <button
                    type="button"
                    onClick={() => toggleSafetyDetail('lake')}
                    className="text-xs font-semibold text-[#212121] hover:underline flex items-center gap-1 cursor-pointer py-1"
                  >
                    <span>{openSafetyDetails['lake'] ? 'Hide breakdown' : 'See how we measured'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openSafetyDetails['lake'] ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                  </button>

                  {openSafetyDetails['lake'] && (
                    <div className="mt-2 p-3 bg-[#f9f9f9] rounded-lg border border-[#eeeeee] text-xs text-[#4a4a4a] leading-relaxed">
                      Measured on OpenStreetMap water outlines and checked against HMDA’s lake list and HYDRAA notices. The notified full tank level (FTL) line can lie outside the water you see, and HMDA has notified final FTLs for only part of its lakes.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: "Where is it?" */}
          <section className="bg-white rounded-xl border border-[#eeeeee] p-6 sm:p-8 space-y-4 text-left">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-[#212121]">
                Section 3
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#212121]">
                Where is it?
              </h2>
              <p className="text-xs text-[#838383] mt-0.5">
                The site on the map, with the nearest mapped water and the drive to the IT corridor.
              </p>
            </div>

            {project.siteLat != null && project.siteLng != null ? (
              <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-[#e0e0e0]">
                <iframe
                  title={`Map of ${project.name}`}
                  className="w-full h-full"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${project.siteLng - 0.012},${project.siteLat - 0.008},${project.siteLng + 0.012},${project.siteLat + 0.008}&layer=mapnik&marker=${project.siteLat},${project.siteLng}`}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`px-3 py-1 rounded-full font-bold ${project.lakeBuffer === 'Clear' ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'}`}>
                {project.lakeBuffer === 'Clear' ? 'Clear of lake buffer' : 'Inside lake buffer'}
              </span>
              <span className="px-2.5 py-1 rounded-full border border-[#eeeeee] text-[#4a4a4a]">{project.distanceToIT}</span>
              {project.nearestLakeMeters != null && (
                <span className="px-2.5 py-1 rounded-full border border-[#eeeeee] text-[#4a4a4a]">Nearest mapped water about {project.nearestLakeMeters} m</span>
              )}
            </div>
          </section>

          {/* SECTION 4: "The numbers" */}
          <section className="bg-white rounded-xl border border-[#eeeeee] p-6 sm:p-8 space-y-6 text-left">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-[#212121]">
                Section 4
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#212121]">
                The numbers
              </h2>
              <p className="text-xs text-[#838383] mt-0.5">
                Prices as quoted by the builder or on property portals on the date shown.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-[#f9f9f9] border border-[#eeeeee]">
                <span className="text-[11px] text-[#838383] block mb-1">Price Range</span>
                <span className="text-sm sm:text-base font-bold text-[#212121]">{project.priceRange}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-[#f9f9f9] border border-[#eeeeee]">
                <span className="text-[11px] text-[#838383] block mb-1">Project Rate</span>
                <span className="text-sm sm:text-base font-bold text-[#212121]">
                  ₹{project.ratePerSqFt.toLocaleString('en-IN')} <span className="text-xs font-normal text-[#838383]">/ sq ft</span>
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-[#f9f9f9] border border-[#eeeeee]">
                <span className="text-[11px] text-[#838383] block mb-1">Configuration</span>
                <span className="text-sm sm:text-base font-bold text-[#212121]">{project.config}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-[#f9f9f9] border border-[#eeeeee]">
                <span className="text-[11px] text-[#838383] block mb-1">Possession Year</span>
                <span className="text-sm sm:text-base font-bold text-[#212121]">{project.possessionYear}</span>
              </div>
            </div>

            {/* Rate per sq ft vs area average, only with real benchmark data */}
            {realMarket && (
            <div className="p-5 rounded-xl bg-[#f9f9f9] border border-[#eeeeee] space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-semibold text-[#212121]">
                  Rate per sq ft vs. {project.location} Average:
                </span>
                <span className="font-bold text-[#212121]">
                  {rateDiffPercent >= 0 ? `+${rateDiffPercent}% vs avg` : `${rateDiffPercent}% vs avg`}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between text-[#6b6b6b]">
                    <span className="font-medium text-[#212121]">{project.name}</span>
                    <span className="font-bold text-[#212121]">₹{project.ratePerSqFt.toLocaleString('en-IN')} / sq ft</span>
                  </div>
                  <div className="h-2 w-full bg-[#eeeeee] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#212121] rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(20, (project.ratePerSqFt / 20000) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[#6b6b6b]">
                    <span className="font-medium">{project.location} Benchmark</span>
                    <span className="font-semibold text-[#212121]">₹{areaAvgRate.toLocaleString('en-IN')} / sq ft</span>
                  </div>
                  <div className="h-2 w-full bg-[#eeeeee] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#a3a3a3] rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(20, (areaAvgRate / 20000) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {market.guidelineRatePerSqFt ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-[#f9f9f9] border border-[#eeeeee] px-3 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b]">IGR guideline value</span>
                  <span className="font-mono text-xs font-bold text-[#212121]">
                    ₹{market.guidelineRatePerSqFt.toLocaleString('en-IN')} / sq ft
                  </span>
                </div>
              ) : null}

              <p className="text-[11px] text-[#838383]">
                Benchmark based on transacted registry records in {project.location} (Range: ₹{market.minRate.toLocaleString('en-IN')} to ₹{market.maxRate.toLocaleString('en-IN')}).
                {market.guidelineRatePerSqFt ? ' Stamp duty is charged on the higher of your price and the IGR guideline value.' : ''}
              </p>
            </div>
            )}

            {/* "See the full cost" CTA Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onNavigate('cost')}
                className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 rounded-xl bg-[#212121] hover:bg-black text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-white" strokeWidth={1.5} />
                <span>See the full cost (taxes, stamp duty, loan EMI)</span>
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </section>

          {/* SECTION 5: "Questions to ask the builder" */}
          <section className="bg-white rounded-xl border border-[#eeeeee] p-6 sm:p-8 space-y-4 text-left">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-[#212121]">
                Section 5
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#212121]">
                Questions to ask the builder
              </h2>
              <p className="text-xs text-[#838383] mt-0.5">
                Put these to the builder and get the answers in writing:
              </p>
            </div>

            <div className="space-y-2">
              {tailoredQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-[#f9f9f9] border border-[#eeeeee] flex items-start gap-3 text-xs sm:text-sm text-[#212121]"
                >
                  <span className="font-bold text-[#212121] shrink-0 mt-0.5">
                    {idx + 1}.
                  </span>
                  <p className="leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </section>

          {/* WATCH & DOCUMENT UPLOAD SECTION */}
          <section className="bg-white rounded-xl border border-[#eeeeee] p-6 sm:p-8 space-y-3 text-left">
            <span className="text-xs uppercase font-bold tracking-wider text-[#212121]">Keep track</span>
            <h2 className="font-serif text-2xl font-bold text-[#212121]">Save {project.name}</h2>
            <p className="text-sm text-[#4a4a4a] leading-relaxed">
              Save it to your account with a WhatsApp login, so it is one tap away when you come back. We are building WhatsApp alerts for
              changes to the TG-RERA record; saved projects will be the first to get them. We do not send alerts yet.
            </p>
            <SaveButton kind="project" refId={project.id} />
          </section>
        </div>

        {/* Right Sidebar on Desktop (Sticky) */}
        <div className="hidden lg:block lg:col-span-4 sticky top-36 space-y-4 text-left">
          <div className="bg-[#212121] text-white rounded-3xl border border-white/10 p-6 space-y-4 shadow-xl">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              {project.marketedByOwner ? 'Talk to the marketing team' : 'Talk to an advisor'}
            </div>

            <h3 className="font-medium text-xl text-white">
              {project.marketedByOwner ? 'Questions about this project?' : 'Want help with this report?'}
            </h3>

            <p className="text-xs text-[#AAAAAA] leading-relaxed font-sans">
              {project.marketedByOwner
                ? `House of Investors, which owns this site, is paid to market ${project.name}. Our advisors can answer questions about it, but on this project they are not independent. Take the questions above to the builder and to a lawyer you choose.`
                : `An advisor can walk you through this report and the questions to ask before you sign anything or pay a booking amount for ${project.name}.`}
            </p>

            <ul className="text-xs text-[#DDDDDD] space-y-1.5 pt-2 border-t border-white/10 font-sans">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                <span>Go through this report with you</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                <span>Help you get the builder’s answers in writing</span>
              </li>
            </ul>

            {/* Neon CTA Button */}
            <button
              type="button"
              onClick={() => onNavigate('booking')}
              className="w-full min-h-[50px] py-3.5 px-6 rounded-full bg-[#212121] hover:bg-black text-white font-bold font-mono text-xs sm:text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span>{project.marketedByOwner ? 'Talk to the team' : 'Talk to an advisor'}</span>
              <ChevronRight className="w-4 h-4 text-white" strokeWidth={2} />
            </button>
            <p className="text-center text-[11px] text-[#838383] font-mono">
              {project.marketedByOwner
                ? '20-minute call · asks for your WhatsApp number'
                : 'House of Investors earns a fee from builders on homes it sells · 20-minute call'}
            </p>
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM BAR ON MOBILE (Neon CTA Button) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-[#212121] border-t border-white/10 z-40">
        <button
          type="button"
          onClick={() => onNavigate('booking')}
          className="w-full min-h-[48px] py-3 px-5 rounded-full bg-[#212121] hover:bg-black text-white font-bold font-mono text-xs sm:text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          <PhoneCall className="w-4 h-4 text-white" strokeWidth={2} />
          <span>{project.marketedByOwner ? 'Talk to the team marketing this project' : 'Talk to an advisor'}</span>
        </button>
      </div>
    </div>
  );
}
