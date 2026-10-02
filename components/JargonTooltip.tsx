'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { JARGON_DICTIONARY } from '@/lib/mock-data';

interface JargonTooltipProps {
  term: 'RERA' | 'FTL' | 'HYDRAA' | 'UDS' | 'HMDA' | 'GHMC' | string;
  customExplanation?: string;
  children?: React.ReactNode;
}

export function JargonTooltip({ term, customExplanation, children }: JargonTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const termData = JARGON_DICTIONARY[term.toUpperCase()] || {
    term,
    explanation: customExplanation || 'Property regulation term used by Hyderabad civic authorities.',
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <span className="relative inline-flex items-center align-baseline gap-1" ref={tooltipRef}>
      <span className="font-medium underline decoration-dotted decoration-[#212121] underline-offset-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        {children || term}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label={`Explain ${term}`}
        className="inline-flex items-center justify-center w-4 h-4 text-xs font-semibold rounded-full bg-[#f2f2f2] text-[#212121] hover:bg-[#212121] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#212121]/40 cursor-pointer"
      >
        <span className="text-[10px] leading-none">?</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#212121] text-white text-xs rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-semibold text-white tracking-wide">{termData.term}</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5"
              aria-label="Close explanation"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
          <p className="text-slate-200 leading-relaxed font-normal">
            {termData.explanation}
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#212121]" />
        </div>
      )}
    </span>
  );
}
