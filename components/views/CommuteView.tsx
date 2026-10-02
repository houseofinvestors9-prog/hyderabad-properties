'use client';

import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Building2, 
  Briefcase, 
  ChevronRight, 
  Sliders, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  Navigation
} from 'lucide-react';
import { ViewType } from '@/components/TopBar';
import {
  ProjectSafetyItem, 
  WORK_LOCATIONS, 
  WorkLocation, 
  MOCK_COMMUTE_MATRIX 
} from '@/lib/mock-data';
import { SafetyBadge } from '@/components/SafetyBadge';
import { useLiveData } from '@/components/live/LiveDataProvider';

interface CommuteViewProps {
  onNavigate: (view: ViewType) => void;
  onSelectProject: (project: ProjectSafetyItem) => void;
}

export function CommuteView({ onNavigate, onSelectProject }: CommuteViewProps) {
  const { projects: liveProjects, marketFor } = useLiveData();
  // Step indicator state (1: Workplace, 2: Commute duration, 3: Results)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Filters
  const [selectedWorkplace, setSelectedWorkplace] = useState<WorkLocation>('Financial District');
  const [maxCommuteMinutes, setMaxCommuteMinutes] = useState<number>(30);
  const [trafficMode, setTrafficMode] = useState<'rush' | 'off_peak'>('rush');
  const [includeWarningProjects, setIncludeWarningProjects] = useState<boolean>(false);

  // Selected project pin for map-list sync
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Filtered and sorted projects
  const commuteResults = useMemo(() => {
    // RED STATUS PROJECTS NEVER APPEAR HERE
    const eligibleProjects = liveProjects.filter((p) => {
      if (p.status === 'risk') return false; // Red-status never shown
      if (!includeWarningProjects && p.status === 'warning') return false; // Amber only if toggled on
      return true;
    });

    const withTimes = eligibleProjects.map((project) => {
      const estimates = MOCK_COMMUTE_MATRIX[project.id]?.[selectedWorkplace] || {
        rushMinutes: 30,
        offPeakMinutes: 20,
      };
      const duration = trafficMode === 'rush' ? estimates.rushMinutes : estimates.offPeakMinutes;
      return {
        project,
        duration,
        rushMinutes: estimates.rushMinutes,
        offPeakMinutes: estimates.offPeakMinutes,
      };
    });

    // Filter within threshold
    const matching = withTimes.filter((item) => item.duration <= maxCommuteMinutes);

    // Sort by shortest commute
    matching.sort((a, b) => a.duration - b.duration);

    return {
      matching,
      allEligibleWithTimes: withTimes.sort((a, b) => a.duration - b.duration),
    };
  }, [liveProjects, selectedWorkplace, maxCommuteMinutes, trafficMode, includeWarningProjects]);

  // Nearest project if empty
  const nearestResult = useMemo(() => {
    if (commuteResults.matching.length > 0) return null;
    if (commuteResults.allEligibleWithTimes.length === 0) return null;
    return commuteResults.allEligibleWithTimes[0];
  }, [commuteResults]);

  // Handle Jump to Nearest
  const handleJumpToNearest = () => {
    if (nearestResult) {
      // Round up to nearest 5 mins
      const nextStep = Math.min(60, Math.ceil(nearestResult.duration / 5) * 5);
      setMaxCommuteMinutes(nextStep);
    }
  };

  // Bearings/Angles for SVG Map layout (Degrees)
  const projectAngles: Record<string, number> = {
    'aurelia-heights': 215, // Neopolis - West/Southwest
    'skyline-crest': 260, // Financial District - West
    'banyan-park': 180, // Kokapet - South/Southwest
    'lakeview-residency': 135, // Narsingi - South
    'orchid-terraces': 35, // Uppal - East/Northeast
    'marina-greens': 315, // Kukatpally - Northwest
  };

  return (
    <div className="max-w-[720px] mx-auto px-4 py-4 sm:py-8 space-y-8 animate-in fade-in duration-200 text-left">
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

      {/* Header & Step Indicator */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-[#212121]">
            Commute Diligence
          </span>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f2f2f2] text-[#4a4a4a] text-xs font-semibold">
            <span>Step {currentStep} of 3</span>
          </div>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#212121]">
          Homes near where you work
        </h1>

        <p className="text-xs sm:text-sm text-[#6b6b6b] leading-relaxed">
          Filter verified, legally safe properties by actual drive time rather than optimistic builder brochure claims.
        </p>
      </div>

      {/* STEP INDICATOR TABS */}
      <div className="grid grid-cols-3 gap-2 border-b border-[#eeeeee] pb-3 text-xs">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className={`py-2 px-2 rounded-lg text-left transition-colors cursor-pointer ${
            currentStep === 1
              ? 'bg-[#f2f2f2] font-bold text-[#212121]'
              : 'text-[#838383] hover:text-[#212121]'
          }`}
        >
          <span className="block text-[10px] text-[#a3a3a3]">1. Workplace</span>
          <span className="truncate block font-semibold">{selectedWorkplace}</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className={`py-2 px-2 rounded-lg text-left transition-colors cursor-pointer ${
            currentStep === 2
              ? 'bg-[#f2f2f2] font-bold text-[#212121]'
              : 'text-[#838383] hover:text-[#212121]'
          }`}
        >
          <span className="block text-[10px] text-[#a3a3a3]">2. Commute Limit</span>
          <span className="truncate block font-semibold">{maxCommuteMinutes} min ({trafficMode === 'rush' ? 'Rush' : 'Off-peak'})</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep(3)}
          className={`py-2 px-2 rounded-lg text-left transition-colors cursor-pointer ${
            currentStep === 3
              ? 'bg-[#f2f2f2] font-bold text-[#212121]'
              : 'text-[#838383] hover:text-[#212121]'
          }`}
        >
          <span className="block text-[10px] text-[#a3a3a3]">3. Results</span>
          <span className="truncate block font-semibold">{commuteResults.matching.length} safe homes</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* STEP 1: "Where do you work?" */}
      {/* ============================================================ */}
      {currentStep === 1 && (
        <div className="bg-white rounded-xl border border-[#eeeeee] p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#212121]">
              Where do you work?
            </h2>
            <p className="text-xs text-[#838383] mt-1">
              Select your primary office location or tech park cluster:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {WORK_LOCATIONS.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  setSelectedWorkplace(loc);
                  setCurrentStep(2);
                }}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between min-h-[58px] ${
                  selectedWorkplace === loc
                    ? 'border-[#212121] bg-white ring-2 ring-[#212121]'
                    : 'border-[#eeeeee] hover:border-[#e0e0e0] bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Briefcase className={`w-4 h-4 shrink-0 ${selectedWorkplace === loc ? 'text-[#212121]' : 'text-[#a3a3a3]'}`} strokeWidth={1.5} />
                  <span className="text-sm font-semibold text-[#212121]">
                    {loc}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#a3a3a3] shrink-0 ml-2" strokeWidth={1.5} />
              </button>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-6 py-2.5 rounded-full bg-[#212121] hover:bg-black text-white font-bold font-mono text-xs sm:text-sm uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer min-h-[44px] shadow-xs"
            >
              <span>Next: Set commute duration</span>
              <ChevronRight className="w-4 h-4 text-white" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: "How long can your commute be?" */}
      {/* ============================================================ */}
      {currentStep === 2 && (
        <div className="bg-white rounded-xl border border-[#eeeeee] p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#212121]">
              How long can your commute be?
            </h2>
            <p className="text-xs text-[#838383] mt-1">
              Select your one-way door-to-desk driving ceiling to {selectedWorkplace}:
            </p>
          </div>

          {/* Large Slider display */}
          <div className="p-6 rounded-xl bg-[#f9f9f9] border border-[#eeeeee] space-y-4 text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#212121] block">
              Maximum One-Way Drive Time
            </span>

            <div className="font-serif text-4xl sm:text-5xl font-bold text-[#212121]">
              {maxCommuteMinutes} minutes
            </div>

            <div className="space-y-2 pt-2 max-w-md mx-auto">
              <input
                type="range"
                min={15}
                max={60}
                step={5}
                value={maxCommuteMinutes}
                onChange={(e) => setMaxCommuteMinutes(Number(e.target.value))}
                className="w-full accent-[#212121] cursor-pointer"
              />
              <div className="flex justify-between text-xs text-[#a3a3a3] font-medium">
                <span>15 min</span>
                <span>30 min</span>
                <span>45 min</span>
                <span>60 min</span>
              </div>
            </div>
          </div>

          {/* Traffic Toggle: "Morning rush" / "Off-peak" */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#212121] block">
              Traffic conditions
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTrafficMode('rush')}
                className={`py-3 px-3 rounded-full border text-xs font-mono font-semibold transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-2 ${
                  trafficMode === 'rush'
                    ? 'border-[#212121] bg-[#212121] text-white font-bold shadow-xs'
                    : 'border-[#eeeeee] bg-white text-[#4a4a4a] hover:border-[#c9c9c9]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Morning rush (8:30 – 10:30 AM)</span>
              </button>

              <button
                type="button"
                onClick={() => setTrafficMode('off_peak')}
                className={`py-3 px-3 rounded-full border text-xs font-mono font-semibold transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-2 ${
                  trafficMode === 'off_peak'
                    ? 'border-[#212121] bg-[#212121] text-white font-bold shadow-xs'
                    : 'border-[#eeeeee] bg-white text-[#4a4a4a] hover:border-[#c9c9c9]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Off-peak (Midday / Weekends)</span>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs text-[#838383] hover:text-[#212121] underline py-2 cursor-pointer"
            >
              ← Change workplace
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-6 py-2.5 rounded-full bg-[#212121] hover:bg-black text-white font-bold font-mono text-xs sm:text-sm uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer min-h-[44px] shadow-xs"
            >
              <span>View matching safe homes</span>
              <ChevronRight className="w-4 h-4 text-white" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: RESULTS */}
      {/* ============================================================ */}
      {currentStep === 3 && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header sentence */}
          <div className="bg-[#f9f9f9] border border-[#eeeeee] rounded-xl p-5 sm:p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-[#212121] block mb-0.5">
                  Live Drive Filter
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#212121]">
                  {commuteResults.matching.length} safe {commuteResults.matching.length === 1 ? 'project' : 'projects'} within {maxCommuteMinutes} minutes of {selectedWorkplace}.
                </h2>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-3 py-1.5 rounded-lg border border-[#e0e0e0] hover:bg-[#f2f2f2] text-xs font-semibold text-[#4a4a4a] flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#212121]" strokeWidth={1.5} />
                  <span>Adjust time</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-3 py-1.5 rounded-lg border border-[#e0e0e0] hover:bg-[#f2f2f2] text-xs font-semibold text-[#4a4a4a] flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                >
                  <Briefcase className="w-3.5 h-3.5 text-[#838383]" strokeWidth={1.5} />
                  <span>Change office</span>
                </button>
              </div>
            </div>

            {/* Quick interactive slider on results page so count updates live as slider moves */}
            <div className="pt-2 border-t border-[#eeeeee] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-1 max-w-sm">
                <span className="font-semibold text-[#4a4a4a] shrink-0">Radius: {maxCommuteMinutes}m</span>
                <input
                  type="range"
                  min={15}
                  max={60}
                  step={5}
                  value={maxCommuteMinutes}
                  onChange={(e) => setMaxCommuteMinutes(Number(e.target.value))}
                  className="w-full accent-[#212121] cursor-pointer"
                />
              </div>

              {/* Traffic toggle pill */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTrafficMode(trafficMode === 'rush' ? 'off_peak' : 'rush')}
                  className="px-2.5 py-1 rounded-full bg-white border border-[#eeeeee] text-xs text-[#6b6b6b] hover:text-[#212121] font-medium cursor-pointer"
                >
                  Mode: <strong className="text-[#212121]">{trafficMode === 'rush' ? 'Morning rush' : 'Off-peak'}</strong>
                </button>
              </div>
            </div>

            {/* Toggle: "Include projects that need a closer look" (OFF by default) */}
            <div className="pt-1 flex items-center justify-between border-t border-[#f2f2f2]">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-[#4a4a4a]">
                <input
                  type="checkbox"
                  checked={includeWarningProjects}
                  onChange={(e) => setIncludeWarningProjects(e.target.checked)}
                  className="w-4 h-4 rounded text-[#212121] focus:ring-[#212121] cursor-pointer"
                />
                <span>Include projects that need a closer look (amber status)</span>
              </label>
              <span className="text-[11px] text-[#a3a3a3]">
                Red-status projects never appear here.
              </span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* STYLIZED SVG MAP (CONCENTRIC RINGS FOR 15/30/45 MIN) */}
          {/* ============================================================ */}
          <div className="bg-white rounded-xl border border-[#eeeeee] p-4 sm:p-6 space-y-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#838383]">
                Commute Isoclines ({selectedWorkplace})
              </span>
              <span className="text-[11px] text-[#a3a3a3]">
                Tap any pin to view details
              </span>
            </div>

            {/* Pure SVG Map Container */}
            <div className="relative w-full h-[320px] bg-[#f9f9f9] rounded-xl border border-[#eeeeee] overflow-hidden flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 500 320">
                <defs>
                  <pattern id="commuteGrid" width="25" height="25" patternUnits="userSpaceOnUse">
                    <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#EAE4DC" strokeWidth="0.8" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#commuteGrid)" />

                {/* Concentric rings from center (cx=250, cy=160) */}
                {/* 45 min ring */}
                <circle
                  cx="250"
                  cy="160"
                  r="140"
                  fill="none"
                  stroke="#D1C7BA"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text x="250" y="27" fill="#8C7E6D" fontSize="10" fontWeight="600" textAnchor="middle">
                  45 min drive isocline
                </text>

                {/* 30 min ring */}
                <circle
                  cx="250"
                  cy="160"
                  r="95"
                  fill="none"
                  stroke="#212121"
                  strokeWidth={maxCommuteMinutes === 30 ? '2' : '1.2'}
                  strokeDasharray={maxCommuteMinutes === 30 ? 'none' : '3 3'}
                  strokeOpacity={maxCommuteMinutes >= 30 ? '0.6' : '0.2'}
                />
                <text x="250" y="72" fill="#212121" fontSize="10" fontWeight="600" textAnchor="middle">
                  30 min
                </text>

                {/* 15 min ring */}
                <circle
                  cx="250"
                  cy="160"
                  r="50"
                  fill="#212121"
                  fillOpacity="0.04"
                  stroke="#212121"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
                <text x="250" y="117" fill="#212121" fontSize="9" fontWeight="600" textAnchor="middle">
                  15 min
                </text>

                {/* Office Center Marker */}
                <g transform="translate(250, 160)">
                  <circle cx="0" cy="0" r="10" fill="#212121" />
                  <circle cx="0" cy="0" r="4" fill="#FFFFFF" />
                  <rect x="-45" y="14" width="90" height="18" rx="4" fill="#212121" />
                  <text x="0" y="26" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
                    {selectedWorkplace}
                  </text>
                </g>

                {/* Project Pins inside concentric rings */}
                {commuteResults.allEligibleWithTimes.map(({ project, duration }) => {
                  const angle = projectAngles[project.id] ?? 90;
                  const rad = (angle * Math.PI) / 180;
                  // Distance proportional to time (140px = 45 min)
                  const dist = Math.min(150, Math.max(30, (duration / 45) * 140));
                  const px = 250 + Math.cos(rad) * dist;
                  const py = 160 + Math.sin(rad) * dist;
                  const isWithin = duration <= maxCommuteMinutes;
                  const isSelected = activeProjectId === project.id;

                  return (
                    <g
                      key={project.id}
                      transform={`translate(${px}, ${py})`}
                      className="cursor-pointer group"
                      onClick={() => {
                        setActiveProjectId(project.id);
                        onSelectProject(project);
                      }}
                      opacity={isWithin ? 1 : 0.35}
                    >
                      {/* Pin Glow if active */}
                      {isSelected && (
                        <circle cx="0" cy="0" r="16" fill="#212121" fillOpacity="0.25" />
                      )}

                      {/* Pin Circle */}
                      <circle
                        cx="0"
                        cy="0"
                        r="9"
                        fill={project.status === 'safe' ? '#059669' : '#D97706'}
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />

                      {/* Pin Duration Label */}
                      <rect
                        x="-24"
                        y="11"
                        width="48"
                        height="15"
                        rx="3"
                        fill={isSelected ? '#212121' : '#FFFFFF'}
                        stroke="#D3C9BD"
                        strokeWidth="0.8"
                      />
                      <text
                        x="0"
                        y="22"
                        fill={isSelected ? '#FFFFFF' : '#212121'}
                        fontSize="8.5"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {duration}m
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* One mandatory line under map */}
            <p className="text-[11px] text-[#838383] pt-1 text-center">
              Commute times are estimates for planning. Test the drive before you buy.
            </p>
          </div>

          {/* ============================================================ */}
          {/* RESULT ROWS (ORDERED LIST BY SHORTEST COMMUTE) */}
          {/* ============================================================ */}
          <div className="space-y-3">
            <h3 className="font-medium text-lg text-[#212121]">
              Verified Projects by Proximity
            </h3>

            {commuteResults.matching.length > 0 ? (
              <div className="divide-y divide-[#eeeeee] rounded-xl border border-[#eeeeee] bg-white overflow-hidden">
                {commuteResults.matching.map(({ project, duration }) => (
                  <div
                    key={project.id}
                    onClick={() => {
                      onSelectProject(project);
                      onNavigate('project');
                    }}
                    className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#f9f9f9]/80 transition-colors cursor-pointer group ${
                      activeProjectId === project.id ? 'bg-[#f9f9f9] ring-1 ring-inset ring-[#212121]' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-base text-[#212121] group-hover:text-[#212121] transition-colors">
                          {project.name}
                        </h4>
                        <span className="text-xs text-[#838383]">· {project.location}</span>
                        <SafetyBadge status={project.status} size="sm" showScore={false} />
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#6b6b6b]">
                        <span className="font-semibold text-[#212121] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                          {duration} min in {trafficMode === 'rush' ? 'morning rush' : 'off-peak'}
                        </span>
                        <span>·</span>
                        <span className="font-bold text-[#212121]">{project.priceRange}</span>
                        <span>·</span>
                        <span className="text-[#838383]">{project.config}</span>
                      </div>

                      {(() => {
                        const m = marketFor(project);
                        const guideline = m?.guidelineRatePerSqFt;
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#212121] text-white">
                              ₹{project.ratePerSqFt.toLocaleString('en-IN')} / sq ft
                            </span>
                            {guideline ? (
                              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#6b6b6b]">
                                IGR guideline ₹{guideline.toLocaleString('en-IN')}
                              </span>
                            ) : null}
                            {m ? (
                              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f9f9f9] border border-[#eeeeee] text-[#6b6b6b]">
                                Area ₹{m.minRate.toLocaleString('en-IN')} to ₹{m.maxRate.toLocaleString('en-IN')}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="shrink-0 flex items-center gap-2 pt-2 sm:pt-0">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-full bg-[#212121] hover:bg-black text-white text-xs font-bold font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer min-h-[40px] shadow-xs"
                      >
                        <span>See report</span>
                        <ChevronRight className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* EMPTY STATE */
              <div className="bg-white rounded-xl border border-[#eeeeee] p-8 text-center space-y-4">
                <div className="w-10 h-10 rounded-full bg-[#f2f2f2] text-[#838383] flex items-center justify-center mx-auto">
                  <Navigation className="w-5 h-5 text-[#a3a3a3]" strokeWidth={1.5} />
                </div>

                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="font-medium text-lg text-[#212121]">
                    No safe projects within {maxCommuteMinutes} minutes of {selectedWorkplace}.
                  </h4>
                  <p className="text-xs text-[#6b6b6b]">
                    Try {nearestResult ? `${Math.min(60, Math.ceil(nearestResult.duration / 5) * 5)} minutes` : 'a higher radius'} or switch to off-peak traffic.
                  </p>
                </div>

                {nearestResult && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleJumpToNearest}
                      className="px-6 py-2.5 rounded-full bg-[#212121] hover:bg-black text-white text-xs font-bold font-mono uppercase tracking-wider transition-colors cursor-pointer min-h-[44px]"
                    >
                      <span>Show closest safe project ({nearestResult.duration} min)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
