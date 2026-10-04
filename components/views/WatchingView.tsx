'use client';

import React from 'react';
import { 
  ArrowLeft, 
  Bell, 
  Check, 
  Clock, 
  MessageSquare, 
  Mail, 
  Trash2, 
  AlertCircle, 
  PhoneCall, 
  Building2,
  ChevronRight,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { ViewType } from '@/components/TopBar';
import { ProjectSafetyItem } from '@/lib/mock-data';
import { SafetyBadge } from '@/components/SafetyBadge';

export interface WatchedProjectItem {
  project: ProjectSafetyItem;
  channel: 'whatsapp' | 'email';
  contact: string;
  watchedAt: string;
  lastChecked: string;
  hasChanged?: boolean;
  changeNote?: string;
  changeTimestamp?: string;
}

export interface WatchedAlertPreview {
  id: string;
  projectName: string;
  changeType: string;
  timestamp: string;
  channel: 'whatsapp' | 'email';
  contact: string;
  whatChanged: string;
  whatItMeans: string;
}

interface WatchingViewProps {
  onNavigate: (view: ViewType) => void;
  onSelectProject: (project: ProjectSafetyItem) => void;
  watchedProjects: WatchedProjectItem[];
  alertTimeline: WatchedAlertPreview[];
  latestAlert: WatchedAlertPreview | null;
  onStopWatching: (projectId: string) => void;
}

export function WatchingView({
  onNavigate,
  onSelectProject,
  watchedProjects,
  alertTimeline,
  latestAlert,
  onStopWatching,
}: WatchingViewProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-8 space-y-8 animate-in fade-in duration-200 text-left">
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

      {/* Header */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-[#eeeeee] text-xs font-mono font-semibold tracking-wider uppercase text-[#212121] shadow-2xs">
          <Bell className="w-4 h-4 text-[#212121]" strokeWidth={1.5} />
          <span>Your list</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#212121]">
          Projects You&apos;re Watching
        </h1>
        <p className="text-xs sm:text-sm text-[#6b6b6b] leading-relaxed">
          We re-read each project’s TG-RERA record every week. Alert messages are not switched on yet; your list is saved for when they are.
        </p>
      </div>

      {/* 1. ALERT PREVIEW CARD (WHEN AN ALERT OCCURRED) */}
      {latestAlert && (
        <div className="space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Preview of the message you&apos;ll get</span>
            </span>
            <span className="text-[11px] text-[#838383]">
              Via {latestAlert.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} to {latestAlert.contact}
            </span>
          </div>

          {/* WhatsApp / Email card mockup */}
          <div className="bg-white rounded-xl border-2 border-amber-300 p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#f2f2f2] text-xs text-[#838383]">
              <div className="flex items-center gap-1.5">
                {latestAlert.channel === 'whatsapp' ? (
                  <MessageSquare className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
                ) : (
                  <Mail className="w-4 h-4 text-[#212121]" strokeWidth={1.5} />
                )}
                <span className="font-semibold text-[#212121]">hyderabad.properties alert</span>
              </div>
              <span>{latestAlert.timestamp}</span>
            </div>

            {/* 3 SHORT LINES */}
            <div className="text-xs sm:text-sm text-[#212121] space-y-2 leading-relaxed">
              <p>
                <strong>What changed:</strong> {latestAlert.whatChanged}
              </p>
              <p className="text-[#4a4a4a]">
                <strong>What it means:</strong> {latestAlert.whatItMeans}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('booking')}
                  className="font-bold font-mono text-xs text-[#212121] hover:text-[#6b6b6b] underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#212121]" strokeWidth={2} />
                  <span>Talk to an advisor about this update →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PLAIN LIST OF WATCHED PROJECTS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-lg text-[#212121]">
            Monitored Developments ({watchedProjects.length})
          </h2>
          <span className="text-xs text-[#838383]">
            Automated check frequency: 24h
          </span>
        </div>

        {watchedProjects.length > 0 ? (
          <div className="divide-y divide-[#eeeeee] rounded-xl border border-[#eeeeee] bg-white overflow-hidden">
            {watchedProjects.map(({ project, channel, contact, lastChecked, hasChanged, changeNote, changeTimestamp }) => (
              <div
                key={project.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#f9f9f9]/70 transition-colors"
              >
                <div 
                  className="space-y-1.5 flex-1 cursor-pointer"
                  onClick={() => {
                    onSelectProject(project);
                    onNavigate('project');
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-base text-[#212121] hover:text-[#212121] transition-colors">
                      {project.name}
                    </h3>
                    <span className="text-xs text-[#838383]">· {project.location}</span>
                    <SafetyBadge status={project.status} size="sm" showScore={false} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#838383]">
                    <span className="flex items-center gap-1 text-[#6b6b6b]">
                      <Clock className="w-3.5 h-3.5 text-[#a3a3a3]" strokeWidth={1.5} />
                      Last verified: {lastChecked}
                    </span>
                    <span>·</span>
                    <span>Alerts: {channel === 'whatsapp' ? 'WhatsApp' : 'Email'} ({contact})</span>
                  </div>

                  {/* One-line status notice */}
                  <p className={`text-xs ${hasChanged ? 'text-amber-800 font-semibold' : 'text-[#a3a3a3]'}`}>
                    {hasChanged ? changeNote : 'Nothing has changed'}
                    {hasChanged && changeTimestamp ? <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b6b6b] ml-1.5">· {changeTimestamp}</span> : null}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProject(project);
                      onNavigate('project');
                    }}
                    className="px-3.5 py-1.5 rounded-lg border border-[#eeeeee] hover:bg-[#f2f2f2] text-xs font-semibold text-[#4a4a4a] transition-colors cursor-pointer min-h-[36px]"
                  >
                    View report
                  </button>

                  <button
                    type="button"
                    onClick={() => onStopWatching(project.id)}
                    className="p-2 rounded-lg text-[#a3a3a3] hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer min-h-[36px]"
                    title="Stop watching this project"
                    aria-label={`Stop watching ${project.name}`}
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#eeeeee] p-8 text-center space-y-4">
            <div className="w-10 h-10 rounded-full bg-[#f2f2f2] text-[#a3a3a3] flex items-center justify-center mx-auto">
              <Bell className="w-5 h-5 text-[#a3a3a3]" strokeWidth={1.5} />
            </div>

            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-medium text-base text-[#212121]">
                You aren&apos;t watching any projects yet.
              </h3>
              <p className="text-xs text-[#6b6b6b] leading-relaxed">
                Tap &ldquo;Watch this project&rdquo; on any checked report to add it here. We will message you about changes to its TG-RERA record once alerts are switched on.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => onNavigate('check')}
                className="px-5 py-2.5 rounded-full bg-[#212121] hover:bg-black text-white text-xs font-bold font-mono uppercase tracking-wider transition-colors cursor-pointer min-h-[44px] shadow-xs"
              >
                Browse & check projects
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. WHAT CHANGED TIMELINE */}
      {alertTimeline.length > 0 && (
        <div className="bg-white rounded-xl border border-[#eeeeee] p-5 sm:p-6 space-y-4">
          <div className="space-y-0.5">
            <h3 className="font-medium text-lg text-[#212121]">
              What Changed Timeline
            </h3>
            <p className="text-xs text-[#838383]">
              Verified statutory events recorded across your watch list:
            </p>
          </div>

          <div className="space-y-3 divide-y divide-[#eeeeee]">
            {alertTimeline.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[#838383]">
                  <span className="font-bold text-[#212121] text-sm">{item.projectName}</span>
                  <span>{item.timestamp}</span>
                </div>
                <p className="text-[#212121]">
                  <strong className="text-amber-700">[{item.changeType}]:</strong> {item.whatChanged}
                </p>
                <p className="text-[#838383]">
                  Impact: {item.whatItMeans}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Small muted line required */}
      <p className="text-xs text-[#838383] text-center pt-2">
        Alerts use the latest verified records. Updates may take up to 24 hours to appear.
      </p>
    </div>
  );
}
