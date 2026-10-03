'use client';

import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type ViewType = 'home' | 'check' | 'project' | 'concierge' | 'booking' | 'cost' | 'commute' | 'watching';

interface TopBarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  watchedCount?: number;
}

const NAV: { view: ViewType; label: string }[] = [
  { view: 'home', label: 'Home' },
  { view: 'check', label: 'Check a project' },
  { view: 'commute', label: 'Search by commute' },
  { view: 'cost', label: 'True cost' },
  { view: 'watching', label: 'Watching' },
];

/** House outline mark, drawn to sit with the wordmark like the HouseMarket logo. */
export function BrandMark({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3.5 10.2 12 3.5l8.5 6.7V20a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-9.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m8.6 14.2 2.4 2.4 4.6-4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TopBar({ currentView, onNavigate, watchedCount = 0 }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (view: ViewType) => {
    setMenuOpen(false);
    onNavigate(view);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md">
      <div className="hm-container h-[76px] flex items-center justify-between gap-6">
        <div className="flex items-center gap-10">
          <button
            type="button"
            onClick={() => go('home')}
            className="flex items-center gap-2 text-[#212121] cursor-pointer min-h-[44px]"
            aria-label="hyderabad.properties home"
          >
            <BrandMark />
            <span className="text-[19px] font-semibold tracking-tight">hyderabad.properties</span>
          </button>

          <nav className="hidden xl:flex items-center gap-7 whitespace-nowrap" aria-label="Main">
            {NAV.map((item) => {
              const active = currentView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => go(item.view)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative text-[15px] font-medium transition-colors cursor-pointer py-2 ${
                    active ? 'text-[#212121]' : 'text-[#6b6b6b] hover:text-[#212121]'
                  }`}
                >
                  {item.label}
                  {item.view === 'watching' && watchedCount > 0 && (
                    <span className="ml-1 text-[#212121]">({watchedCount})</span>
                  )}
                  {active && <span className="absolute left-0 right-0 -bottom-0.5 h-px bg-[#212121]" />}
                </button>
              );
            })}
            <a href="/rera" className="text-[15px] font-medium text-[#6b6b6b] hover:text-[#212121] py-2">
              RERA projects
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go('booking')}
            className="hidden md:inline-flex text-[15px] font-medium text-[#212121] px-4 py-2 rounded-full hover:bg-[#f2f2f2] transition-colors cursor-pointer"
          >
            Talk to an expert
          </button>
          <button
            type="button"
            onClick={() => go('check')}
            className="hidden sm:inline-flex items-center rounded-full bg-[#212121] hover:bg-black text-white text-[15px] font-semibold px-6 py-2.5 transition-colors cursor-pointer"
          >
            Check a project
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="xl:hidden w-11 h-11 inline-flex items-center justify-center rounded-full border border-[#eeeeee] text-[#212121] cursor-pointer"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" strokeWidth={1.6} /> : <Menu className="w-5 h-5" strokeWidth={1.6} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="xl:hidden border-t border-[#eeeeee] bg-white">
          <nav className="hm-container py-4 flex flex-col" aria-label="Mobile">
            {NAV.map((item) => (
              <button
                key={item.view}
                type="button"
                onClick={() => go(item.view)}
                className={`text-left py-3 text-lg font-medium border-b border-[#f2f2f2] cursor-pointer ${
                  currentView === item.view ? 'text-[#212121]' : 'text-[#6b6b6b]'
                }`}
              >
                {item.label}
                {item.view === 'watching' && watchedCount > 0 ? ` (${watchedCount})` : ''}
              </button>
            ))}
            <a href="/rera" className="text-left py-3 text-lg font-medium border-b border-[#f2f2f2] text-[#6b6b6b]">
              RERA projects
            </a>
            <div className="flex flex-col gap-2 pt-4">
              <button
                type="button"
                onClick={() => go('check')}
                className="rounded-full bg-[#212121] text-white font-semibold py-3 cursor-pointer"
              >
                Check a project
              </button>
              <button
                type="button"
                onClick={() => go('booking')}
                className="rounded-full border border-[#eeeeee] text-[#212121] font-semibold py-3 cursor-pointer"
              >
                Talk to an expert
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
