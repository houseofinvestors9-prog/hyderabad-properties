'use client';

import React, { useState } from 'react';

interface Correction {
  id: string;
  pageUrl: string | null;
  fromRole: string;
  name: string | null;
  organisation: string | null;
  contact: string;
  message: string;
  createdAt: string;
}

/** Correction and takedown requests. Answer each within three working days, as the public page promises. */
export function CorrectionsPanel({ initial }: { initial: Correction[] }) {
  const [items, setItems] = useState(initial);
  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-8 pb-10">
      <div className="rounded-[16px] border border-[#eeeeee] p-6">
        <h2 className="text-[18px] font-medium">Correction requests ({items.length})</h2>
        <p className="mt-1 text-[13px] text-[#838383]">From buyers and builders. The public page promises a reply within three working days.</p>
        {items.length === 0 ? (
          <p className="mt-4 text-[14px] text-[#6b6b6b]">None open.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#f0f0f0]">
            {items.map((c) => (
              <li key={c.id} className="py-4 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-medium">
                    {c.fromRole === 'builder' ? 'Builder' : c.fromRole === 'buyer' ? 'Buyer' : 'Other'}
                    {c.name ? ` · ${c.name}` : ''}
                    {c.organisation ? ` · ${c.organisation}` : ''} · {c.contact}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch('/api/admin/corrections', {
                        method: 'PATCH',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ id: c.id, status: 'resolved' }),
                      });
                      if (res.ok) setItems((xs) => xs.filter((x) => x.id !== c.id));
                    }}
                    className="rounded-full border border-[#e5e5e5] px-4 py-1.5 text-[13px] hover:border-[#212121] cursor-pointer"
                  >
                    Mark resolved
                  </button>
                </div>
                {c.pageUrl && (
                  <a href={c.pageUrl} target="_blank" rel="noreferrer" className="text-[13px] underline text-[#4a4a4a]">
                    {c.pageUrl}
                  </a>
                )}
                <p className="text-[14px] text-[#4a4a4a] whitespace-pre-wrap">{c.message}</p>
                <p className="text-[12px] text-[#a3a3a3]">{new Date(c.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
