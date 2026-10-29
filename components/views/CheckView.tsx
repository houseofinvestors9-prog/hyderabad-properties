'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronRight, 
  Info, 
  ArrowRight, 
  PhoneCall, 
  RotateCcw,
  HelpCircle,
  Clock,
  ArrowLeft,
  Bell,
  Check,
  Trash2
} from 'lucide-react';
import { ProjectSafetyItem, JARGON_DICTIONARY } from '@/lib/mock-data';
import { useLiveData } from '@/components/live/LiveDataProvider';
import { JargonTooltip } from '@/components/JargonTooltip';
import { RequestProjectForm } from '@/components/RequestProjectForm';
import type { RegistryHit } from '@/lib/data/rera';
import { ViewType } from '@/components/TopBar';

interface CheckViewProps {
  onNavigate: (view: ViewType) => void;
  onSelectProject: (project: ProjectSafetyItem) => void;
  initialSearchTerm?: string;
  onClearInitialSearch?: () => void;
  watchedProjectIds?: string[];
  onOpenWatchSheet?: (project: ProjectSafetyItem) => void;
  onStopWatching?: (projectId: string) => void;
}

export function CheckView({
  onNavigate,
  onSelectProject,
  initialSearchTerm,
  onClearInitialSearch,
  watchedProjectIds = [],
  onOpenWatchSheet,
  onStopWatching,
}: CheckViewProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const { projects: liveProjects, getProject } = useLiveData();
  const [selectedResultRaw, setSelectedResult] = useState<ProjectSafetyItem | null>(null);
  // Always show the latest pushed record for the selected project.
  const selectedResult = selectedResultRaw ? getProject(selectedResultRaw.id) ?? selectedResultRaw : null;
  const [isNotFound, setIsNotFound] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [isStopWatchingMenuOpen, setIsStopWatchingMenuOpen] = useState(false);
  // Matches from the TG-RERA registry when we have no checked report for the search
  const [registryHits, setRegistryHits] = useState<RegistryHit[]>([]);

  useEffect(() => {
    if (!isNotFound || searchedQuery.trim().length < 2) {
      setRegistryHits([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/rera/search?q=${encodeURIComponent(searchedQuery)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j: { results: RegistryHit[] }) => setRegistryHits(j.results ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [isNotFound, searchedQuery]);

  // Expandable states for the 3 check rows
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

  // Expandable state for the bottom glossary
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  // Run the 600ms check with progressive scanning steps
  const executeAudit = (projectToAudit: ProjectSafetyItem | null, rawQuery: string) => {
    setIsSearching(true);
    setShowDropdown(false);
    setSelectedResult(null);
    setIsNotFound(false);
    setSearchedQuery(rawQuery);
    setExpandedRows({});

    // Dynamic loading text sequence
    setLoadingStep('Checking Telangana RERA registration...');
    setTimeout(() => {
      setLoadingStep('Verifying municipal building sanctions...');
    }, 250);
    setTimeout(() => {
      setLoadingStep('Scanning HYDRAA lake & waterbody buffer coordinates...');
    }, 450);

    setTimeout(() => {
      setIsSearching(false);
      if (projectToAudit) {
        setSelectedResult(projectToAudit);
        setIsNotFound(false);
      } else {
        setIsNotFound(true);
      }
    }, 650);
  };

  // Trigger search if initialSearchTerm provided
  useEffect(() => {
    if (initialSearchTerm && initialSearchTerm.trim().length > 0) {
      const timer = setTimeout(() => {
        setSearchTerm(initialSearchTerm);
        const query = initialSearchTerm.trim().toLowerCase();
        const matched = liveProjects.find(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.reraNumber.toLowerCase() === query ||
            query.includes(p.name.toLowerCase())
        );
        executeAudit(matched || null, initialSearchTerm);
        if (onClearInitialSearch) {
          onClearInitialSearch();
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialSearchTerm, onClearInitialSearch, liveProjects]);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Example chips: the first three projects we have actually checked
  const exampleChips = liveProjects.slice(0, 3).map((p) => ({ label: p.name, query: p.name }));

  // Autocomplete filtering based on user input
  const matchingProjects = searchTerm.trim().length > 0
    ? liveProjects.filter((p) => {
        const query = searchTerm.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.location.toLowerCase().includes(query) ||
          p.reraNumber.toLowerCase().includes(query)
        );
      })
    : [];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    // Find best match in mock projects
    const matched = liveProjects.find(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.reraNumber.toLowerCase() === searchTerm.toLowerCase().trim() ||
        searchTerm.toLowerCase().includes(p.name.toLowerCase())
    );

    executeAudit(matched || null, searchTerm.trim());
  };

  const handleSelectFromDropdown = (project: ProjectSafetyItem) => {
    setSearchTerm(project.name);
    executeAudit(project, project.name);
  };

  const handleChipClick = (chipQuery: string) => {
    setSearchTerm(chipQuery);
    const matched = liveProjects.find((p) => p.name.toLowerCase().includes(chipQuery.toLowerCase()));
    executeAudit(matched || null, chipQuery);
  };

  const toggleRowExpand = (rowKey: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedResult(null);
    setIsNotFound(false);
    setExpandedRows({});
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-8 space-y-8 animate-in fade-in duration-200">
      {/* Consistent Back button */}
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

      {/* 1. BIG CENTERED SEARCH */}
      <section className="space-y-4">
        <div className="text-left space-y-1">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#838383]">
            Independent Project Verification
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#212121]">
            Property Safety Check Tool
          </h1>
          <p className="text-sm text-[#6b6b6b] max-w-xl">
            Verify building sanction orders, <JargonTooltip term="RERA" /> certificates, and <JargonTooltip term="FTL" /> lake buffer boundaries before paying any token advance.
          </p>
        </div>

        {/* Big Search Input with Autocomplete */}
        <div className="relative pt-2" ref={searchContainerRef}>
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <div className="relative w-full">
              <Search className="w-5 h-5 text-[#a3a3a3] absolute left-4 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => {
                  if (searchTerm.trim().length > 0) setShowDropdown(true);
                }}
                placeholder="Type a project name or RERA number..."
                aria-label="Search project name or RERA number"
                className="w-full pl-12 pr-28 sm:pr-32 py-4 text-sm sm:text-base rounded-xl border border-[#eeeeee] bg-white text-[#212121] placeholder:text-[#a3a3a3] focus:outline-none focus:border-[#212121] min-h-[56px]"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-2 px-5 py-2.5 rounded-full bg-[#212121] hover:bg-black text-white text-xs sm:text-sm font-bold font-mono uppercase tracking-wider transition-colors min-h-[44px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>Check</span>
              <ArrowRight className="w-4 h-4 text-white" strokeWidth={2} />
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {showDropdown && matchingProjects.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-[#eeeeee] shadow-md overflow-hidden z-30 text-left animate-in fade-in duration-100">
              <div className="p-2 text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3] px-3 border-b border-[#f2f2f2]">
                Verified Database Matches
              </div>
              <div className="divide-y divide-[#eeeeee] max-h-64 overflow-y-auto">
                {matchingProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectFromDropdown(p)}
                    className="w-full p-3.5 hover:bg-[#f9f9f9] transition-colors flex items-center justify-between text-left cursor-pointer group"
                  >
                    <div>
                      <div className="font-semibold text-sm text-[#212121]">
                        {p.name}
                      </div>
                      <div className="text-xs text-[#838383] mt-0.5">
                        {p.location} · RERA: <span className="font-mono text-[#4a4a4a]">{p.reraNumber}</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        p.status === 'safe'
                          ? 'bg-emerald-50 text-emerald-800'
                          : p.status === 'warning'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      {p.statusLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3 Clickable Example Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-3 text-xs text-[#6b6b6b]">
            <span className="text-[#a3a3a3] font-medium">Try searching:</span>
            {exampleChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleChipClick(chip.query)}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#f9f9f9] text-[#212121] border border-[#eeeeee] font-medium transition-colors cursor-pointer min-h-[36px] flex items-center gap-1.5"
              >
                <span>{chip.label}</span>
                <ChevronRight className="w-3 h-3 text-[#a3a3a3]" strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. LOADING STATE (600ms fake delay on submit with skeleton) */}
      {isSearching && (
        <div className="bg-white rounded-xl border border-[#eeeeee] p-8 sm:p-10 text-left space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-[#212121]" strokeWidth={1.5} />
            <h3 className="font-serif text-lg font-bold text-[#212121]">
              {loadingStep || 'Checking registration... approvals... lake safety...'}
            </h3>
          </div>

          <div className="space-y-2 max-w-md pt-1">
            <div className="h-3 bg-[#eeeeee] rounded w-3/4" />
            <div className="h-3 bg-[#eeeeee] rounded w-full" />
            <div className="h-3 bg-[#eeeeee] rounded w-5/6" />
          </div>

          <p className="text-xs text-[#838383]">
            Querying state registries and waterbody cadastral coordinates...
          </p>
        </div>
      )}

      {/* 3. RESULT CARD */}
      {!isSearching && selectedResult && (
        <div className="bg-white rounded-xl border border-[#eeeeee] overflow-hidden space-y-6 animate-in fade-in duration-200">
          {/* Top Status Banner */}
          <div
            className={`p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              selectedResult.status === 'safe'
                ? 'bg-emerald-50/60 border-emerald-100 text-emerald-950'
                : selectedResult.status === 'warning'
                ? 'bg-amber-50/60 border-amber-100 text-amber-950'
                : 'bg-rose-50/60 border-rose-100 text-rose-950'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#838383]">
                  {selectedResult.location} ({selectedResult.microMarket})
                </span>
                <span className="text-[#d4d4d4]">·</span>
                <span className="text-xs font-mono text-[#6b6b6b]">
                  RERA: {selectedResult.reraNumber}
                </span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#212121]">
                {selectedResult.name}
              </h2>

              <div className="pt-1 flex items-center gap-2">
                {selectedResult.status === 'safe' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" strokeWidth={1.5} />
                    <span>Looks Safe</span>
                  </div>
                )}
                {selectedResult.status === 'warning' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-700" strokeWidth={1.5} />
                    <span>Needs a Closer Look</span>
                  </div>
                )}
                {selectedResult.status === 'risk' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                    <AlertOctagon className="w-4 h-4 text-rose-700" strokeWidth={1.5} />
                    <span>High Risk</span>
                  </div>
                )}
              </div>
            </div>

            {/* Small Score Ring */}
            <div className="flex items-center gap-3 shrink-0 bg-white p-3 rounded-xl border border-[#eeeeee]">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                  <circle
                    cx="24"
                    cy="24"
                    r="19"
                    className="stroke-[#eeeeee] fill-none"
                    strokeWidth="4"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="19"
                    className={`fill-none ${
                      selectedResult.status === 'safe'
                        ? 'stroke-emerald-600'
                        : selectedResult.status === 'warning'
                        ? 'stroke-amber-500'
                        : 'stroke-rose-600'
                    }`}
                    strokeWidth="4"
                    strokeDasharray={119.38}
                    strokeDashoffset={119.38 * (1 - selectedResult.score / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-bold text-xs text-[#212121] leading-none">
                    {selectedResult.score}
                  </span>
                  <span className="text-[8px] text-[#a3a3a3]">/100</span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#6b6b6b]">
                Safety Index
              </span>
            </div>
          </div>

          <div className="px-6 space-y-6">
            <p className="text-sm text-[#4a4a4a] leading-relaxed">
              {selectedResult.summary}
            </p>

            {/* 3 CHECK ROWS */}
            <div className="space-y-3">
              <h3 className="font-medium text-base text-[#212121]">
                Core Safety Breakdown
              </h3>

              <div className="divide-y divide-[#eeeeee] rounded-xl border border-[#eeeeee] bg-[#f9f9f9]/50 overflow-hidden">
                {/* ROW 1: RERA */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {selectedResult.reraStatus === 'Active' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                      )}
                      <div>
                        <div className="font-semibold text-sm text-[#212121]">
                          Registered with the state regulator (<JargonTooltip term="RERA" />)
                        </div>
                        <p className="text-xs text-[#6b6b6b] mt-0.5">
                          {selectedResult.reraStatus === 'Active'
                            ? `Active certificate registered on Telangana portal (Registration No: ${selectedResult.reraNumber}).`
                            : 'Application renewal currently undergoing administrative review.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleRowExpand('rera')}
                      className="text-xs font-semibold text-[#212121] hover:underline flex items-center gap-1 shrink-0 py-1 cursor-pointer"
                    >
                      <span>{expandedRows['rera'] ? 'Hide' : 'See why'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedRows['rera'] ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                    </button>
                  </div>

                  {expandedRows['rera'] && (
                    <div className="mt-2 pl-7 pr-2 py-2 text-xs text-[#6b6b6b] bg-white rounded-lg border border-[#eeeeee] space-y-1">
                      <p>
                        <strong>Regulator Verification:</strong>{' '}
                        {selectedResult.reraStatus === 'Active'
                          ? 'Quarterly construction milestones and bank escrow accounts are properly declared on the TG-RERA portal. No active stop-work orders.'
                          : 'The developer has filed paperwork, but mandatory quarterly disclosures are lagging. Advised to verify phase-wise delivery certificates.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* ROW 2: BUILDING PLANS */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {selectedResult.buildingPlan === 'Approved' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                      )}
                      <div>
                        <div className="font-semibold text-sm text-[#212121]">
                          Building plans approved
                        </div>
                        <p className="text-xs text-[#6b6b6b] mt-0.5">
                          {selectedResult.buildingPlan === 'Approved'
                            ? 'Sanctioned municipal construction permission in place for layout and floors.'
                            : 'Revised plans or additional upper floors currently pending final municipal sanction.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleRowExpand('plans')}
                      className="text-xs font-semibold text-[#212121] hover:underline flex items-center gap-1 shrink-0 py-1 cursor-pointer"
                    >
                      <span>{expandedRows['plans'] ? 'Hide' : 'See why'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedRows['plans'] ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                    </button>
                  </div>

                  {expandedRows['plans'] && (
                    <div className="mt-2 pl-7 pr-2 py-2 text-xs text-[#6b6b6b] bg-white rounded-lg border border-[#eeeeee] space-y-1">
                      <p>
                        <strong>Sanction Verification:</strong>{' '}
                        {selectedResult.buildingPlan === 'Approved'
                          ? 'Clear town planning permissions issued by GHMC/HMDA. All standard setback norms, basement parking, and fire safety NOCs verified.'
                          : 'The builder has applied for permission on additional floors that have not yet been stamped. Always ensure your specific floor is within the approved drawing.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* ROW 3: LAKE SAFETY */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {selectedResult.lakeBuffer === 'Clear' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                      )}
                      <div>
                        <div className="font-semibold text-sm text-[#212121]">
                          Not near a protected lake zone
                        </div>
                        <p className="text-xs text-[#6b6b6b] mt-0.5">
                          {selectedResult.lakeBuffer === 'Clear'
                            ? 'Completely outside lake full tank level (FTL) and protected stormwater buffer lines.'
                            : 'Boundary plot encroaches into the 30-meter lake conservation zone.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleRowExpand('lake')}
                      className="text-xs font-semibold text-[#212121] hover:underline flex items-center gap-1 shrink-0 py-1 cursor-pointer"
                    >
                      <span>{expandedRows['lake'] ? 'Hide' : 'See why'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedRows['lake'] ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                    </button>
                  </div>

                  {expandedRows['lake'] && (
                    <div className="mt-2 pl-7 pr-2 py-2 text-xs text-[#6b6b6b] bg-white rounded-lg border border-[#eeeeee] space-y-1">
                      <p>
                        <strong>HYDRAA Buffer Analysis:</strong>{' '}
                        {selectedResult.lakeBuffer === 'Clear'
                          ? 'Verified against Telangana Irrigation department cadastral maps. Zero overlap with lake water spread or connecting stormwater channels.'
                          : 'Survey coordinates indicate portions of the compound fall inside the lake conservation perimeter. HYDRAA has actively removed unauthorized structures in this exact revenue survey.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Last verified line with info icon */}
            <div className="flex items-center justify-between text-xs text-[#838383] pt-1 border-t border-[#f2f2f2]">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#a3a3a3] shrink-0" strokeWidth={1.5} />
                <span>Last verified: <strong>{selectedResult.lastVerifiedDate}</strong></span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-[#838383] hover:text-[#212121] underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Check another project</span>
              </button>
            </div>

            {/* Watch Secondary Button */}
            <div className="pt-2 flex items-center justify-between">
              {watchedProjectIds.includes(selectedResult.id) ? (
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
                    <div className="absolute left-0 mt-1 w-36 bg-white border border-[#eeeeee] rounded-lg shadow-lg p-1 z-30 animate-in fade-in duration-100">
                      <button
                        type="button"
                        onClick={() => {
                          if (onStopWatching) onStopWatching(selectedResult.id);
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
                  onClick={() => onOpenWatchSheet && onOpenWatchSheet(selectedResult)}
                  className="px-3 py-1.5 rounded-full border border-[#e0e0e0] hover:border-[#212121] bg-white text-[#4a4a4a] hover:text-[#212121] text-xs font-mono font-semibold inline-flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                >
                  <Bell className="w-3.5 h-3.5 text-[#212121]" strokeWidth={1.5} />
                  <span>Watch this project</span>
                </button>
              )}
            </div>

            {/* Two Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pb-6">
              <button
                type="button"
                onClick={() => {
                  onSelectProject(selectedResult);
                  onNavigate('project');
                }}
                className="min-h-[50px] px-6 py-3 rounded-full bg-[#212121] hover:bg-black text-white font-bold font-mono text-xs sm:text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <span>See full project report</span>
                <ChevronRight className="w-4 h-4 text-white" strokeWidth={2} />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('booking')}
                className="min-h-[50px] px-6 py-3 rounded-full bg-[#212121] hover:bg-black text-white font-bold font-mono text-xs sm:text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <PhoneCall className="w-4 h-4 text-white" strokeWidth={2} />
                <span>Ask an advisor about this</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. NOT-FOUND STATE: ask for the basics so we can add the project */}
      {!isSearching && isNotFound && (
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-8 lg:gap-12 rounded-[20px] border border-[#eeeeee] bg-white p-6 sm:p-10 animate-in fade-in duration-200">
          <div className="space-y-4">
            <h3 className="text-[28px] sm:text-[32px] leading-tight font-medium text-[#212121]">
              We haven&apos;t checked {searchedQuery ? <>&ldquo;{searchedQuery}&rdquo;</> : 'this project'} yet
            </h3>
            <p className="text-[16px] text-[#6b6b6b] leading-relaxed">
              Give us the basics and we&apos;ll pull its RERA, approval and lake records, then send you the report. Every
              project buyers ask about gets added, so the next person searching for it finds it here.
            </p>
            {registryHits.length > 0 && (
              <div className="rounded-[14px] border border-[#eeeeee] p-4 space-y-3">
                <p className="text-[14px] font-semibold text-[#212121]">On the TG-RERA public record</p>
                <ul className="space-y-2">
                  {registryHits.slice(0, 5).map((h) => (
                    <li key={h.slug}>
                      <a href={`/rera/${h.slug}`} className="group block rounded-[10px] px-3 py-2 -mx-3 hover:bg-[#f9f9f9]">
                        <span className="text-[15px] font-medium text-[#212121] group-hover:underline underline-offset-2">{h.name}</span>
                        <span className="block text-[13px] text-[#838383]">
                          {[h.promoter, h.locality ?? h.mandal, h.registrationNo].filter(Boolean).join(' · ')}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="text-[12px] text-[#a3a3a3]">Builder&apos;s own filing, status and completion date. Not yet checked by our team.</p>
              </div>
            )}
            <div className="rounded-[14px] bg-[#f9f9f9] p-4 text-[14px] text-[#4a4a4a] space-y-1">
              <p className="font-semibold text-[#212121]">Until then</p>
              <p>
                Don&apos;t pay a booking advance until you have seen the project&apos;s TG-RERA registration number. Under
                RERA, a builder can&apos;t take more than 10% before a registered sale agreement.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-[15px] font-medium text-[#212121] underline underline-offset-4 cursor-pointer"
            >
              Try another search
            </button>
          </div>

          <RequestProjectForm key={searchedQuery} initialName={searchedQuery} title="Add it to our list" />
        </div>
      )}

      {/* 5. COLLAPSIBLE GLOSSARY */}
      <section className="bg-white rounded-xl border border-[#eeeeee] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsGlossaryOpen(!isGlossaryOpen)}
          className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-3 hover:bg-[#f9f9f9] transition-colors min-h-[56px] cursor-pointer"
        >
          <div>
            <h3 className="font-medium text-base text-[#212121]">
              What do these checks mean?
            </h3>
            <p className="text-xs text-[#838383]">
              Plain-English explanation of Hyderabad real estate terms (RERA, FTL, HYDRAA, UDS).
            </p>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-[#a3a3a3] transition-transform duration-150 ${
              isGlossaryOpen ? 'rotate-180' : ''
            }`}
            strokeWidth={1.5}
          />
        </button>

        {isGlossaryOpen && (
          <div className="px-5 pb-6 sm:px-6 divide-y divide-[#eeeeee] text-xs sm:text-sm text-[#4a4a4a] animate-in fade-in duration-150">
            <div className="py-3 space-y-1">
              <strong className="text-[#212121] text-sm">RERA (Real Estate Regulatory Authority)</strong>
              <p className="text-[#6b6b6b] text-xs">
                {JARGON_DICTIONARY.RERA.explanation} In Telangana, a builder cannot collect more than 10% advance payment without signing a registered agreement containing this number.
              </p>
            </div>

            <div className="py-3 space-y-1">
              <strong className="text-[#212121] text-sm">FTL (Full Tank Level)</strong>
              <p className="text-[#6b6b6b] text-xs">
                {JARGON_DICTIONARY.FTL.explanation} Even if local panchayats mistakenly issued old documents, construction within FTL boundaries cannot be regularized.
              </p>
            </div>

            <div className="py-3 space-y-1">
              <strong className="text-[#212121] text-sm">HYDRAA (Asset Protection Agency)</strong>
              <p className="text-[#6b6b6b] text-xs">
                {JARGON_DICTIONARY.HYDRAA.explanation} The agency uses satellite maps to restore lake catchment areas. Properties caught in their crosshairs face power disconnection and demolition.
              </p>
            </div>

            <div className="py-3 space-y-1">
              <strong className="text-[#212121] text-sm">UDS (Undivided Share of Land)</strong>
              <p className="text-[#6b6b6b] text-xs">
                {JARGON_DICTIONARY.UDS.explanation} When you buy an apartment, you legally own a proportion of the physical plot. A higher UDS gives you stronger long-term asset value.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
