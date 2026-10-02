'use client';

import React from 'react';
import { 
  X, 
  ShieldAlert, 
  UserCheck, 
  Clock, 
  FileText, 
  Eye, 
  Phone, 
  Mail, 
  Building,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Snowflake,
  Sun
} from 'lucide-react';
import { ProjectSafetyItem } from '@/lib/mock-data';
import { UserPreferences } from '@/components/AppShell';

interface AdvisorDemoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProject: ProjectSafetyItem;
  userPreferences: UserPreferences;
  viewedProjects: ProjectSafetyItem[];
  chatTranscript?: { sender: 'assistant' | 'user'; text: string; time: string }[];
  bookingDetails?: { slot: string; timezone: string; email: string; phone?: string };
}

export function AdvisorDemoPanel({
  isOpen,
  onClose,
  selectedProject,
  userPreferences,
  viewedProjects,
  chatTranscript = [],
  bookingDetails,
}: AdvisorDemoPanelProps) {
  if (!isOpen) return null;

  // Temperature logic
  const isHot = userPreferences.timeline?.includes('3 months') || Boolean(bookingDetails);
  const isWarm = userPreferences.timeline?.includes('6') || userPreferences.lookingFor?.includes('home');
  const tempLabel = isHot ? 'HOT' : isWarm ? 'WARM' : 'COOL';
  const tempColor = isHot 
    ? 'bg-rose-100 text-rose-800 border-rose-300' 
    : isWarm 
    ? 'bg-amber-100 text-amber-800 border-amber-300' 
    : 'bg-sky-100 text-sky-800 border-sky-300';

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-[#f9f9f9] border-t-2 border-[#e0e0e0] shadow-xl overflow-y-auto animate-in slide-in-from-bottom duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#eeeeee]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#eeeeee] text-[#212121]">
              Internal, not visible to users
            </span>
            <h2 className="font-serif text-lg font-bold text-[#212121]">
              HoI Advisor CRM & Diligence Dossier
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#eeeeee] text-[#6b6b6b] transition-colors cursor-pointer"
            aria-label="Close Advisor Demo Panel"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* 4-section grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Section 1: Lead Card with Temperature */}
          <div className="p-4 rounded-xl bg-white border border-[#eeeeee] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#212121] uppercase tracking-wider text-[11px]">
                Lead Profile
              </span>
              <span className={`px-2 py-0.5 rounded-full font-bold border ${tempColor}`}>
                {tempLabel}
              </span>
            </div>

            <div className="space-y-1.5 text-[#4a4a4a]">
              <div>
                <span className="text-[#a3a3a3] block text-[10px]">Client Contact:</span>
                <strong>{bookingDetails?.email || 'Browsing anonymously'}</strong>
              </div>
              {bookingDetails?.phone && (
                <div>
                  <span className="text-[#a3a3a3] block text-[10px]">WhatsApp:</span>
                  <span>{bookingDetails.phone}</span>
                </div>
              )}
              <div>
                <span className="text-[#a3a3a3] block text-[10px]">Consultation Scheduled:</span>
                <span>{bookingDetails?.slot || 'No slot booked yet'}</span>
              </div>
              <div>
                <span className="text-[#a3a3a3] block text-[10px]">Buyer Residency:</span>
                <span className="font-semibold text-[#212121]">
                  {userPreferences.location === 'Abroad (NRI)' ? 'NRI (Overseas Buyer)' : 'Domestic / Hyderabad'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Extracted Preferences */}
          <div className="p-4 rounded-xl bg-white border border-[#eeeeee] space-y-3">
            <span className="font-bold text-[#212121] uppercase tracking-wider text-[11px] block">
              Extracted Preferences
            </span>

            <div className="space-y-2 text-[#4a4a4a]">
              <div className="flex justify-between border-b border-[#f2f2f2] pb-1">
                <span className="text-[#838383]">Primary Goal:</span>
                <strong>{userPreferences.lookingFor || 'A home to live in'}</strong>
              </div>
              <div className="flex justify-between border-b border-[#f2f2f2] pb-1">
                <span className="text-[#838383]">Target Budget:</span>
                <strong>{userPreferences.budget || '₹1 Cr – ₹2.5 Cr'}</strong>
              </div>
              <div className="flex justify-between border-b border-[#f2f2f2] pb-1">
                <span className="text-[#838383]">Possession Window:</span>
                <strong>{userPreferences.timeline || 'Within 6 months'}</strong>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-[#838383]">Active Inquiry:</span>
                <strong className="text-[#212121]">{selectedProject.name}</strong>
              </div>
            </div>
          </div>

          {/* Section 3: Projects Viewed */}
          <div className="p-4 rounded-xl bg-white border border-[#eeeeee] space-y-3">
            <span className="font-bold text-[#212121] uppercase tracking-wider text-[11px] block">
              Projects Viewed This Session ({viewedProjects.length || 1})
            </span>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {(viewedProjects.length > 0 ? viewedProjects : [selectedProject]).map((p, idx) => (
                <div key={`${p.id}-${idx}`} className="p-2 bg-[#f9f9f9] rounded-lg border border-[#eeeeee] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#212121]">{p.name}</div>
                    <div className="text-[10px] text-[#838383]">{p.location} · {p.priceRange}</div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    p.status === 'safe'
                      ? 'bg-emerald-100 text-emerald-800'
                      : p.status === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {p.statusLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Chat Transcript */}
          <div className="p-4 rounded-xl bg-white border border-[#eeeeee] space-y-3">
            <span className="font-bold text-[#212121] uppercase tracking-wider text-[11px] block">
              Recent Wealth Desk Dialogue
            </span>

            <div className="space-y-1.5 max-h-40 overflow-y-auto text-[11px] pr-1">
              {chatTranscript.length > 0 ? (
                chatTranscript.slice(-4).map((msg, idx) => (
                  <div key={idx} className="pb-1 border-b border-[#f2f2f2] last:border-0">
                    <span className="font-bold text-[#4a4a4a] capitalize">{msg.sender}: </span>
                    <span className="text-[#6b6b6b] line-clamp-2">{msg.text}</span>
                  </div>
                ))
              ) : (
                <div className="text-[#a3a3a3] italic">
                  Initial greeting sent regarding {selectedProject.name}. Awaiting live response.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
