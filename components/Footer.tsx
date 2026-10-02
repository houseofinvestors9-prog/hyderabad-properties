'use client';

import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { FOOTER_DISCLAIMER } from '@/lib/mock-data';
import { BrandMark, ViewType } from '@/components/TopBar';
import { DEMO_DATA } from '@/lib/demo';

export type SimulatedChangeType = 'Registration lapsed' | 'Penalty added' | 'Approval granted';

/** The single place the owner is named on the public site. */
export const OWNERSHIP_LINE = 'hyderabad.properties is owned and operated by House of Investors.';

// Demo controls are for internal walkthroughs only; production visitors never see them.
const SHOW_DEMO_CONTROLS = DEMO_DATA;

interface FooterProps {
  onNavigate?: (view: ViewType) => void;
  isAdvisorDemoOpen?: boolean;
  onToggleAdvisorDemo?: () => void;
  onSimulateChange?: (changeType: SimulatedChangeType) => void;
}

export function Footer({ onNavigate, isAdvisorDemoOpen, onToggleAdvisorDemo, onSimulateChange }: FooterProps) {
  const [selectedChange, setSelectedChange] = useState<SimulatedChangeType>('Penalty added');

  const columns: { title: string; links: { label: string; view: ViewType }[] }[] = [
    {
      title: 'Check',
      links: [
        { label: 'Check a project', view: 'check' },
        { label: 'Search by commute', view: 'commute' },
        { label: 'True cost calculator', view: 'cost' },
      ],
    },
    {
      title: 'Your shortlist',
      links: [
        { label: 'Projects you watch', view: 'watching' },
        { label: 'Ask a question', view: 'concierge' },
        { label: 'Talk to an expert', view: 'booking' },
      ],
    },
  ];

  return (
    <footer className="mt-24 sm:mt-32">
      <div className="hm-container">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-10 py-14 border-t border-[#eeeeee]">
          <div className="space-y-4 max-w-sm">
            <div className="flex items-center gap-2 text-[#212121]">
              <BrandMark />
              <span className="text-[19px] font-semibold tracking-tight">hyderabad.properties</span>
            </div>
            <p className="text-[15px] text-[#838383] leading-relaxed">
              Free, independent checks for Hyderabad homes. We read the RERA filings, approvals and lake maps so you can
              see what the brochure leaves out.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="space-y-4">
              <h4 className="text-[15px] font-semibold text-[#212121]">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={() => onNavigate?.(link.view)}
                      className="text-[15px] text-[#838383] hover:text-[#212121] transition-colors cursor-pointer"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="py-8 border-t border-[#eeeeee] flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-sm text-[#838383]">
          <div className="space-y-1">
            <p>{OWNERSHIP_LINE}</p>
            <p>{FOOTER_DISCLAIMER}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {SHOW_DEMO_CONTROLS && onSimulateChange && (
              <div className="inline-flex items-center gap-1.5 p-1 rounded-full border border-[#eeeeee] text-xs">
                <span className="font-medium pl-2">Demo change:</span>
                <select
                  value={selectedChange}
                  onChange={(e) => setSelectedChange(e.target.value as SimulatedChangeType)}
                  className="bg-white border border-[#eeeeee] rounded-full px-2.5 py-1 text-xs text-[#212121] focus:outline-none"
                >
                  <option value="Penalty added">Penalty added</option>
                  <option value="Registration lapsed">Registration lapsed</option>
                  <option value="Approval granted">Approval granted</option>
                </select>
                <button
                  type="button"
                  onClick={() => onSimulateChange(selectedChange)}
                  className="px-3 py-1 bg-[#212121] hover:bg-black text-white rounded-full text-xs font-semibold cursor-pointer"
                >
                  Trigger
                </button>
              </div>
            )}

            {SHOW_DEMO_CONTROLS && onToggleAdvisorDemo && (
              <button
                type="button"
                onClick={onToggleAdvisorDemo}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
                  isAdvisorDemoOpen ? 'bg-[#212121] text-white border-[#212121]' : 'bg-white text-[#212121] border-[#eeeeee]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Advisor view (demo)</span>
              </button>
            )}

            <span>© {new Date().getFullYear()} hyderabad.properties</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
