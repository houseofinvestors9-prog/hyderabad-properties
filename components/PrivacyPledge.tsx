'use client';

import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

interface PrivacyPledgeProps {
  compact?: boolean;
  variant?: 'compact' | 'full';
  className?: string;
}

export function PrivacyPledge({ compact = false, variant, className = '' }: PrivacyPledgeProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isCompact = compact || variant === 'compact';

  return (
    <>
      <div className={`pt-3 mt-1 text-left ${className}`}>
        {isCompact ? (
          /* COMPACT VARIANT: One line + link */
          <div className="flex items-center gap-1.5 text-[13px] text-[#838383] flex-wrap">
            <Lock className="w-3.5 h-3.5 text-[#838383] shrink-0" strokeWidth={1.5} />
            <span>Your details go only to our team at House of Investors. Never sold or passed to brokers.</span>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="font-medium text-[#212121] underline hover:text-black cursor-pointer inline"
            >
              How we handle your data
            </button>
          </div>
        ) : (
          /* FULL VARIANT: Quiet block with lock, heading, 3 lines, text link */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#6b6b6b] shrink-0" strokeWidth={1.5} />
              <h4 className="text-sm font-semibold text-[#212121]">
                Your details go only to our team.
              </h4>
            </div>

            <ul className="text-[13px] text-[#838383] space-y-1 pl-6 list-disc list-outside">
              <li>hyderabad.properties is run by House of Investors. Only their team sees what you send.</li>
              <li>We never sell your details or pass them to brokers.</li>
              <li>One advisor contacts you. No cold calls, no group messages.</li>
              <li>Want out? Reply STOP or email us and we delete your data.</li>
            </ul>

            <div className="pl-6 pt-0.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-medium text-[#212121] underline hover:text-black cursor-pointer"
              >
                How we handle your data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SIMPLE 4-SENTENCE PRIVACY MODAL */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white border border-[#eeeeee] rounded-[20px] p-6 shadow-xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#eeeeee]">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#212121]" strokeWidth={1.5} />
                <h3 id="privacy-modal-title" className="font-medium text-base text-[#212121]">
                  How We Handle Your Data
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-[#a3a3a3] hover:text-[#4a4a4a] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-[#4a4a4a] space-y-3 leading-relaxed">
              <p>
                <strong>What we collect:</strong> We collect your email address, optional WhatsApp number, and shortlisted property preferences.
              </p>
              <p>
                <strong>Why we collect it:</strong> We use this information solely to prepare for your consultation and share independent legal verification reports.
              </p>
              <p>
                <strong>Who sees it:</strong> Only the House of Investors team that runs hyderabad.properties sees your details. We never sell them or pass them to brokers or marketing lists.
              </p>
              <p>
                <strong>How to delete:</strong> Reply STOP to any message or email <em>privacy@hyderabad.properties</em> and we completely delete your records within 24 hours.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full py-2.5 px-4 rounded-full bg-[#212121] hover:bg-black text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
