'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TopBar, ViewType } from '@/components/TopBar';
import { Footer, SimulatedChangeType } from '@/components/Footer';
import { HomeView } from '@/components/views/HomeView';
import { CheckView } from '@/components/views/CheckView';
import { ProjectView } from '@/components/views/ProjectView';
import { ConciergeView } from '@/components/views/ConciergeView';
import { BookingView } from '@/components/views/BookingView';
import { CostView } from '@/components/views/CostView';
import { CommuteView } from '@/components/views/CommuteView';
import { WatchingView, WatchedProjectItem, WatchedAlertPreview } from '@/components/views/WatchingView';
import { WatchSheet } from '@/components/WatchSheet';
import { AdvisorDemoPanel } from '@/components/AdvisorDemoPanel';
import { MOCK_PROJECTS, ProjectSafetyItem } from '@/lib/mock-data';
import { useLiveData, formatDate } from '@/components/live/LiveDataProvider';
import { AlertCircle, X } from 'lucide-react';
import { useReveal } from '@/components/useReveal';
import { DEMO_DATA } from '@/lib/demo';

export interface UserPreferences {
  lookingFor?: 'A home to live in' | 'An investment' | 'Not sure yet';
  location?: 'Hyderabad' | 'Elsewhere in India' | 'Abroad (NRI)';
  timeline?: 'Within 6 months' | '6-12 months' | 'Just exploring' | string;
  budget?: string;
  purpose?: string;
}

/** What we keep per watched project in this browser. The project itself always comes from live data. */
interface StoredWatch {
  projectId: string;
  channel: 'whatsapp' | 'email';
  contact: string;
  watchedAt: string; // display label
  watchedAtIso: string;
}

const WATCH_STORAGE_KEY = 'hp-watches-v1';

function readStoredWatches(): StoredWatch[] | null {
  try {
    const raw = window.localStorage.getItem(WATCH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredWatch[]) : null;
  } catch {
    return null;
  }
}

function writeStoredWatches(w: StoredWatch[]) {
  try {
    window.localStorage.setItem(WATCH_STORAGE_KEY, JSON.stringify(w));
  } catch {
    /* storage blocked */
  }
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return formatDate(iso);
}

interface AppShellProps {
  initialView?: ViewType;
  initialProjectId?: string;
  /** Search to run on load, e.g. from /?view=check&q=… */
  initialQuery?: string;
}

export function AppShell({ initialView = 'home', initialProjectId, initialQuery }: AppShellProps) {
  const live = useLiveData();
  const { projects, alerts } = live;
  const fallbackProject = projects[0] ?? MOCK_PROJECTS[0];

  const [currentView, setCurrentView] = useState<ViewType>(initialView);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId ?? fallbackProject.id);
  // Local-only demo overrides from the footer "Simulate a change" control.
  const [demoOverrides, setDemoOverrides] = useState<Record<string, ProjectSafetyItem>>({});
  const selectedProject: ProjectSafetyItem =
    demoOverrides[selectedProjectId] ?? live.getProject(selectedProjectId) ?? fallbackProject;

  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  const [activeSearchTerm, setActiveSearchTerm] = useState<string>(initialQuery ?? '');


  // Viewed projects tracking
  const [viewedProjectIds, setViewedProjectIds] = useState<string[]>([selectedProjectId]);
  const viewedProjects = viewedProjectIds.map((id) => live.getProject(id)).filter(Boolean) as ProjectSafetyItem[];

  // Chat transcript tracking
  const [chatTranscript, setChatTranscript] = useState<{ sender: 'assistant' | 'user'; text: string; time: string }[]>([]);

  // Booking details tracking
  const [bookingDetails, setBookingDetails] = useState<{ slot: string; timezone: string; email: string; phone?: string } | undefined>(undefined);

  // Advisor Demo Panel toggle
  const [isAdvisorDemoOpen, setIsAdvisorDemoOpen] = useState<boolean>(false);

  // ==========================================
  // WATCH THIS PROJECT STATE
  // ==========================================
  const [watches, setWatches] = useState<StoredWatch[]>(() =>
    DEMO_DATA
      ? [
          {
            projectId: MOCK_PROJECTS[0].id, // Aurelia Heights pre-watched for immediate demo readiness
            channel: 'whatsapp',
            contact: '+91 98765 43210',
            watchedAt: 'Yesterday',
            watchedAtIso: new Date(Date.now() - 86400_000).toISOString(),
          },
        ]
      : []
  );
  const watchesLoaded = useRef(false);
  const [localAlerts, setLocalAlerts] = useState<WatchedAlertPreview[]>([]);
  const [latestAlert, setLatestAlert] = useState<WatchedAlertPreview | null>(null);
  const seenAlertIds = useRef<Set<string>>(new Set(alerts.map((a) => a.id)));

  // Watch Sheet modal state
  const [isWatchSheetOpen, setIsWatchSheetOpen] = useState<boolean>(false);
  const [watchSheetProject, setWatchSheetProject] = useState<ProjectSafetyItem | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string, ms = 4000) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), ms);
  };

  useReveal([currentView, selectedProjectId, projects.length]);

  // Restore this browser's watch list.
  useEffect(() => {
    const stored = readStoredWatches();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    if (stored) setWatches(stored);
    watchesLoaded.current = true;
  }, []);

  useEffect(() => {
    if (watchesLoaded.current) writeStoredWatches(watches);
  }, [watches]);

  // Keep the address bar on the shareable report URL while a project is open.
  useEffect(() => {
    const target = currentView === 'project' ? `/project?id=${encodeURIComponent(selectedProjectId)}` : '/';
    if (window.location.pathname + window.location.search !== target) {
      window.history.replaceState(window.history.state, '', target);
    }
  }, [currentView, selectedProjectId]);

  // A live data refresh drops local demo overrides so pushed records always win.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset demo state when live data changes
    setDemoOverrides({});
  }, [live.version]);

  // Surface newly approved alerts for watched projects the moment they arrive.
  const watchedIdsKey = watches.map((w) => w.projectId).join(',');
  useEffect(() => {
    const watchedIds = new Set(watchedIdsKey.split(',').filter(Boolean));
    const fresh = alerts.filter((a) => !seenAlertIds.current.has(a.id));
    fresh.forEach((a) => seenAlertIds.current.add(a.id));
    const relevant = fresh.filter((a) => watchedIds.has(a.projectId));
    if (relevant.length === 0) return;
    const a = relevant[0];
    const w = watches.find((x) => x.projectId === a.projectId);
    setLatestAlert({
      id: a.id,
      projectName: a.projectName,
      changeType: a.type,
      timestamp: 'Just now',
      channel: w?.channel ?? 'whatsapp',
      contact: w?.contact ?? '',
      whatChanged: a.whatChanged,
      whatItMeans: a.whatItMeans,
    });
    setToastMessage(`${a.projectName}: ${a.type.toLowerCase()}. Report updated.`);
    const t = setTimeout(() => setToastMessage(null), 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, watchedIdsKey]);

  const watchedProjects: WatchedProjectItem[] = watches
    .map((w) => {
      const project = demoOverrides[w.projectId] ?? live.getProject(w.projectId);
      if (!project) return null;
      const latest = alerts.find((a) => a.projectId === w.projectId && a.publishedAt > w.watchedAtIso);
      const demo = demoOverrides[w.projectId];
      return {
        project,
        channel: w.channel,
        contact: w.contact,
        watchedAt: w.watchedAt,
        lastChecked: project.lastVerifiedDate,
        hasChanged: !!latest || !!demo,
        changeNote: latest ? `${latest.type}: ${latest.whatChanged}` : demo ? 'Simulated change (demo only)' : undefined,
        changeTimestamp: latest ? timeAgo(latest.publishedAt) : undefined,
      } satisfies WatchedProjectItem;
    })
    .filter(Boolean) as WatchedProjectItem[];

  const alertTimeline: WatchedAlertPreview[] = [
    ...localAlerts,
    ...alerts
      .filter((a) => watches.some((w) => w.projectId === a.projectId))
      .map((a) => {
        const w = watches.find((x) => x.projectId === a.projectId)!;
        return {
          id: a.id,
          projectName: a.projectName,
          changeType: a.type,
          timestamp: `Verified ${formatDate(a.publishedAt)}`,
          channel: w.channel,
          contact: w.contact,
          whatChanged: a.whatChanged,
          whatItMeans: a.whatItMeans,
        };
      }),
  ];

  const handleNavigate = (view: ViewType, query?: string) => {
    if (query !== undefined) {
      setActiveSearchTerm(query);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectProject = (project: ProjectSafetyItem) => {
    setSelectedProjectId(project.id);
    setViewedProjectIds((prev) => (prev.includes(project.id) ? prev : [...prev, project.id]));
  };

  const handleUpdatePreferences = (prefs: Partial<UserPreferences>) => {
    setUserPreferences((prev) => ({ ...prev, ...prefs }));
  };

  const getProjectPriceInRupees = (project: ProjectSafetyItem): number => {
    const priceText = project.priceRange;
    if (priceText.includes('Cr')) {
      const match = priceText.match(/(\d+(\.\d+)?)/);
      if (match) return Math.round(parseFloat(match[1]) * 10000000);
    }
    if (priceText.includes('Lakh')) {
      const match = priceText.match(/(\d+(\.\d+)?)/);
      if (match) return Math.round(parseFloat(match[1]) * 100000);
    }
    return 12000000;
  };

  // Watch Sheet Handlers
  const handleOpenWatchSheet = (project: ProjectSafetyItem) => {
    setWatchSheetProject(project);
    setIsWatchSheetOpen(true);
  };

  const handleStartWatching = (project: ProjectSafetyItem, channel: 'whatsapp' | 'email', contact: string) => {
    const now = new Date().toISOString();
    setWatches((prev) => {
      const existing = prev.find((w) => w.projectId === project.id);
      if (existing) {
        return prev.map((w) => (w.projectId === project.id ? { ...w, channel, contact } : w));
      }
      return [{ projectId: project.id, channel, contact, watchedAt: 'Just now', watchedAtIso: now }, ...prev];
    });

    showToast(`Now watching ${project.name}. Alerts active.`);

    fetch('/api/watch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, channel, contact }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          showToast(body.error ?? 'Could not save your alert. Please try again.', 5000);
        }
      })
      .catch(() => showToast('You are offline. Alerts will start once you reconnect and watch again.', 5000));
  };

  const handleStopWatching = (projectId: string) => {
    const target = watches.find((w) => w.projectId === projectId);
    setWatches((prev) => prev.filter((w) => w.projectId !== projectId));
    if (target) {
      const name = live.getProject(projectId)?.name ?? 'project';
      showToast(`Stopped watching ${name}.`, 3000);
      fetch('/api/watch', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, contact: target.contact }),
      }).catch(() => undefined);
    }
  };

  // Demo: Simulate a Change (local preview only, nothing is written to the database)
  const handleSimulateChange = (changeType: SimulatedChangeType) => {
    const target = selectedProject;

    let whatChanged = '';
    let whatItMeans = '';
    let newStatus: 'safe' | 'warning' | 'risk' = 'warning';
    let newLabel: 'Looks Safe' | 'Needs a Closer Look' | 'High Risk' = 'Needs a Closer Look';
    let newScore = target.score;

    if (changeType === 'Penalty added') {
      whatChanged = 'Telangana RERA added a delayed filing penalty of ₹2,50,000 on Tower C quarterly milestone return.';
      whatItMeans = 'This indicates an administrative filing delay. Municipal layout sanction remains intact, but compliance record has been penalized.';
      newStatus = 'warning';
      newLabel = 'Needs a Closer Look';
      newScore = 76;
    } else if (changeType === 'Registration lapsed') {
      whatChanged = 'Telangana RERA registration expired without active quarterly project extension certificate.';
      whatItMeans = 'New sales deed registrations are paused at the sub-registrar office pending builder regulatory renewal.';
      newStatus = 'risk';
      newLabel = 'High Risk';
      newScore = 44;
    } else {
      whatChanged = 'HMDA municipal planning branch granted unconditional revised building sanction for upper residential floors.';
      whatItMeans = 'All previously conditional floors now possess verified municipal sanction orders.';
      newStatus = 'safe';
      newLabel = 'Looks Safe';
      newScore = 96;
    }

    const updatedProject: ProjectSafetyItem = {
      ...target,
      status: newStatus,
      statusLabel: newLabel,
      score: newScore,
    };
    setDemoOverrides((prev) => ({ ...prev, [target.id]: updatedProject }));

    const toastVerb = changeType === 'Penalty added'
      ? 'a penalty was added'
      : changeType === 'Registration lapsed'
      ? 'registration lapsed'
      : 'approval was granted';
    showToast(`${target.name}: ${toastVerb}`, 6000);

    if (!watches.some((w) => w.projectId === target.id)) {
      setWatches((prev) => [
        { projectId: target.id, channel: 'whatsapp', contact: '+91 98765 43210', watchedAt: 'Today', watchedAtIso: new Date().toISOString() },
        ...prev,
      ]);
    }

    const alertItem: WatchedAlertPreview = {
      id: `alert-${Date.now()}`,
      projectName: target.name,
      changeType,
      timestamp: 'Just now',
      channel: 'whatsapp',
      contact: '+91 98765 43210',
      whatChanged,
      whatItMeans,
    };
    setLatestAlert(alertItem);
    setLocalAlerts((prev) => [alertItem, ...prev]);
  };

  const isSelectedProjectWatched = watches.some((w) => w.projectId === selectedProject.id);
  const watchedProjectIds = watches.map((w) => w.projectId);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#212121]">
      {/* Persistent Top Bar with Watching count badge */}
      <TopBar 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        watchedCount={watchedProjects.length} 
      />

      {/* Main Content Area with State-Based Routing */}
      <main className={currentView === 'home' ? 'flex-1 w-full pt-2' : 'flex-1 hm-container py-8 sm:py-12'}>
        {currentView === 'home' && (
          <HomeView
            onNavigate={handleNavigate}
            onSelectProject={handleSelectProject}
            userPreferences={userPreferences}
            onUpdatePreferences={handleUpdatePreferences}
          />
        )}

        {currentView === 'check' && (
          <CheckView
            onNavigate={handleNavigate}
            onSelectProject={handleSelectProject}
            initialSearchTerm={activeSearchTerm}
            onClearInitialSearch={() => setActiveSearchTerm('')}
            watchedProjectIds={watchedProjectIds}
            onOpenWatchSheet={handleOpenWatchSheet}
            onStopWatching={handleStopWatching}
          />
        )}

        {currentView === 'project' && (
          <ProjectView
            project={selectedProject}
            onNavigate={handleNavigate}
            onSelectProject={handleSelectProject}
            isWatching={isSelectedProjectWatched}
            onOpenWatchSheet={handleOpenWatchSheet}
            onStopWatching={handleStopWatching}
          />
        )}

        {currentView === 'watching' && (
          <WatchingView
            onNavigate={handleNavigate}
            onSelectProject={handleSelectProject}
            watchedProjects={watchedProjects}
            alertTimeline={alertTimeline}
            latestAlert={latestAlert}
            onStopWatching={handleStopWatching}
          />
        )}

        {currentView === 'concierge' && (
          <ConciergeView
            onNavigate={handleNavigate}
            selectedProject={selectedProject}
            userPreferences={userPreferences}
            onUpdatePreferences={handleUpdatePreferences}
            onUpdateTranscript={setChatTranscript}
          />
        )}

        {currentView === 'booking' && (
          <BookingView
            onNavigate={handleNavigate}
            selectedProject={selectedProject}
            userPreferences={userPreferences}
            onBookingConfirmed={(details) => setBookingDetails(details)}
          />
        )}

        {currentView === 'cost' && (
          <CostView
            onNavigate={handleNavigate}
            selectedProject={selectedProject}
            initialPrice={getProjectPriceInRupees(selectedProject)}
          />
        )}

        {currentView === 'commute' && (
          <CommuteView
            onNavigate={handleNavigate}
            onSelectProject={handleSelectProject}
          />
        )}
      </main>

      {/* Footer with Mandatory Disclaimer & Demo Controls */}
      <Footer
        onNavigate={handleNavigate}
        isAdvisorDemoOpen={isAdvisorDemoOpen}
        onToggleAdvisorDemo={() => setIsAdvisorDemoOpen(!isAdvisorDemoOpen)}
        onSimulateChange={handleSimulateChange}
      />

      {/* Advisor Demo Panel Drawer */}
      <AdvisorDemoPanel
        isOpen={isAdvisorDemoOpen}
        onClose={() => setIsAdvisorDemoOpen(false)}
        selectedProject={selectedProject}
        userPreferences={userPreferences}
        viewedProjects={viewedProjects}
        chatTranscript={chatTranscript}
        bookingDetails={bookingDetails}
      />

      {/* Compact Watch Sheet (Bottom sheet on mobile, side panel / modal on desktop) */}
      {watchSheetProject && (
        <WatchSheet
          project={watchSheetProject}
          isOpen={isWatchSheetOpen}
          onClose={() => {
            setIsWatchSheetOpen(false);
            setWatchSheetProject(null);
          }}
          onStartWatching={handleStartWatching}
        />
      )}

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 left-6 sm:left-auto z-50 bg-[#212121] text-white px-5 py-3.5 rounded-full shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200"
        >
          <AlertCircle className="w-4 h-4 text-white shrink-0" strokeWidth={1.5} />
          <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white p-1 cursor-pointer"
            aria-label="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
