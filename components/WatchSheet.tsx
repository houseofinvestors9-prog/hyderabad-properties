'use client';

import React, { useState } from 'react';
import { X, Bell, MessageSquare, Mail, Check } from 'lucide-react';
import { ProjectSafetyItem } from '@/lib/mock-data';
import { PrivacyPledge } from '@/components/PrivacyPledge';

interface WatchSheetProps {
  project: ProjectSafetyItem;
  isOpen: boolean;
  onClose: () => void;
  onStartWatching: (project: ProjectSafetyItem, channel: 'whatsapp' | 'email', contact: string) => void;
}

export function WatchSheet({ project, isOpen, onClose, onStartWatching }: WatchSheetProps) {
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  const isContactValid = channel === 'whatsapp'
    ? phone.trim().length >= 8
    : email.trim().includes('@');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isContactValid) return;
    const contactValue = channel === 'whatsapp' ? phone.trim() : email.trim();
    onStartWatching(project, channel, contactValue);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="watch-sheet-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4 bg-black/40 animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Bottom sheet on mobile, side panel / compact modal on desktop */}
      <div
        className="w-full sm:max-w-md bg-[#f9f9f9] sm:rounded-2xl rounded-t-2xl border border-[#e0e0e0] p-6 shadow-2xl space-y-4 text-left max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-2 border-b border-[#eeeeee]">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#212121]">
              <Bell className="w-3.5 h-3.5 text-[#212121]" strokeWidth={1.5} />
              <span>Watch {project.name}</span>
            </div>
            <h3 id="watch-sheet-title" className="font-medium text-xl text-[#212121]">
              Get told if anything changes.
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#a3a3a3] hover:text-[#4a4a4a] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Plain Explanation */}
        <p className="text-xs sm:text-sm text-[#6b6b6b] leading-relaxed">
          We re-check this project&apos;s registration, approvals and penalty record. If something changes, we message you.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Channel Choice */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#212121]">
              Where should we alert you?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`py-2.5 px-3 rounded-full border text-xs font-mono font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
                  channel === 'whatsapp'
                    ? 'border-[#212121] bg-[#212121] text-white font-bold shadow-xs'
                    : 'border-[#eeeeee] bg-white text-[#4a4a4a] hover:border-[#c9c9c9]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`py-2.5 px-3 rounded-full border text-xs font-mono font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
                  channel === 'email'
                    ? 'border-[#212121] bg-[#212121] text-white font-bold shadow-xs'
                    : 'border-[#eeeeee] bg-white text-[#4a4a4a] hover:border-[#c9c9c9]'
                }`}
              >
                <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Email</span>
              </button>
            </div>
          </div>

          {/* Field for chosen channel only */}
          {channel === 'whatsapp' ? (
            <div>
              <label htmlFor="watchPhoneInput" className="block text-xs font-semibold text-[#212121] mb-1">
                WhatsApp number
              </label>
              <div className="relative">
                <MessageSquare className="w-4 h-4 text-[#a3a3a3] absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                <input
                  id="watchPhoneInput"
                  type="tel"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#eeeeee] bg-white text-xs sm:text-sm focus:outline-none focus:border-[#212121] min-h-[44px]"
                />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="watchEmailInput" className="block text-xs font-semibold text-[#212121] mb-1">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#a3a3a3] absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                <input
                  id="watchEmailInput"
                  type="email"
                  required
                  placeholder="e.g. yourname@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#eeeeee] bg-white text-xs sm:text-sm focus:outline-none focus:border-[#212121] min-h-[44px]"
                />
              </div>
            </div>
          )}

          {/* Privacy Pledge compact variant */}
          <PrivacyPledge variant="compact" />

          {/* Button: "Start watching" (Neon & Black combo) */}
          <button
            type="submit"
            disabled={!isContactValid}
            className="w-full py-3.5 px-4 rounded-full bg-[#212121] hover:bg-black text-white text-xs sm:text-sm font-bold font-mono uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] shadow-xs"
          >
            <Bell className="w-4 h-4 text-white" strokeWidth={2} />
            <span>Start watching</span>
          </button>
        </form>

        {/* Small muted line */}
        <p className="text-[11px] text-[#838383] pt-1 text-center">
          We save your request now. Alert messages are not switched on yet; when they are, we will message the number or email you give here.
        </p>
      </div>
    </div>
  );
}
