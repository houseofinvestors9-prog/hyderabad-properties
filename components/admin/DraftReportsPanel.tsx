'use client';

import React, { useState } from 'react';

interface Report {
  id: string;
  name: string;
  developer: string | null;
  location: string;
  reraId: string;
  status: string;
  safetyScore: number;
  summary: string;
  whySummary: string;
  keyConcerns: string[];
  questions: string[];
  sources: { label: string; url: string }[];
  priceRange: string;
  ratePerSqFt: number;
  config: string;
  possessionYear: string;
  permitNo: string | null;
  lakeBuffer: string;
  nearestLakeMeters: number | null;
  ocStatus: string | null;
  isLive: boolean;
  signedOffBy: string | null;
  signedOffAt: string | null;
}

const LABEL: Record<string, string> = { verified: 'Looks safe', caution: 'Needs a closer look', risk: 'High risk' };

/** Drafted reports wait here until a named person signs them off; only then do they go public. */
export function DraftReportsPanel({ initial, defaultSigner }: { initial: Report[]; defaultSigner: string }) {
  const [items, setItems] = useState(initial);
  const [signer, setSigner] = useState(defaultSigner);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: 'publish' | 'unpublish') {
    setBusy(id);
    setError(null);
    const res = await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, action, signer }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) return setError(body.error ?? 'Could not save.');
    const now = new Date().toISOString();
    setItems((xs) =>
      xs.map((x) => (x.id === id ? { ...x, isLive: action === 'publish', signedOffBy: action === 'publish' ? signer : x.signedOffBy, signedOffAt: action === 'publish' ? now : x.signedOffAt } : x))
    );
  }

  const drafts = items.filter((x) => !x.isLive);
  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-8 pb-10">
      <div className="rounded-[16px] border border-[#eeeeee] p-6">
        <h2 className="text-[18px] font-medium">Checked reports ({drafts.length} awaiting sign-off)</h2>
        <p className="mt-1 text-[13px] text-[#838383]">
          Read each draft and its sources. Signing off publishes it with your name and today&apos;s date. Open a source if anything looks off.
        </p>
        <label className="mt-4 block text-[13px] text-[#4a4a4a]">
          Name shown on the report
          <input
            value={signer}
            onChange={(e) => setSigner(e.target.value)}
            className="mt-1 block w-full max-w-[360px] rounded-[10px] border border-[#e5e5e5] px-3 py-2 text-[14px]"
            placeholder="e.g. Nikhil, Review Desk"
          />
        </label>
        {error && <p className="mt-2 text-[13px] text-rose-700">{error}</p>}
        <ul className="mt-4 divide-y divide-[#f0f0f0]">
          {items.map((r) => (
            <li key={r.id} className="py-5">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="text-[15px] font-medium">{r.name}</span>
                    <span className="text-[13px] text-[#838383]"> · {r.developer} · {r.location} · {r.reraId}</span>
                  </span>
                  <span className="text-[13px]">
                    {LABEL[r.status] ?? r.status} · {r.safetyScore}
                    {r.isLive ? ` · live, signed off by ${r.signedOffBy}` : ' · draft'}
                  </span>
                </summary>
                <div className="mt-4 space-y-3 text-[14px] text-[#4a4a4a]">
                  <p><strong>Summary:</strong> {r.summary}</p>
                  <p><strong>Why:</strong> {r.whySummary}</p>
                  <p>
                    <strong>Facts:</strong> {r.config} · {r.priceRange} (₹{r.ratePerSqFt.toLocaleString('en-IN')}/sq ft) · possession {r.possessionYear} · permit {r.permitNo ?? '—'} · lake buffer {r.lakeBuffer}
                    {r.nearestLakeMeters != null ? ` (nearest water ${r.nearestLakeMeters} m)` : ''} · OC {r.ocStatus ?? '—'}
                  </p>
                  {r.keyConcerns.length > 0 && (
                    <div><strong>Concerns:</strong><ul className="list-disc pl-5">{r.keyConcerns.map((c) => <li key={c}>{c}</li>)}</ul></div>
                  )}
                  {r.questions.length > 0 && (
                    <div><strong>Ask the builder:</strong><ul className="list-disc pl-5">{r.questions.map((q) => <li key={q}>{q}</li>)}</ul></div>
                  )}
                  <div><strong>Sources:</strong><ul className="list-disc pl-5">{r.sources.map((s) => <li key={s.url + s.label}><a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.label}</a></li>)}</ul></div>
                </div>
              </details>
              <div className="mt-3 flex gap-2">
                {r.isLive ? (
                  <>
                    <a href={`/project?id=${r.id}`} target="_blank" rel="noreferrer" className="rounded-full border border-[#e5e5e5] px-4 py-1.5 text-[13px]">View live</a>
                    <button type="button" disabled={busy === r.id} onClick={() => act(r.id, 'unpublish')} className="rounded-full border border-[#e5e5e5] px-4 py-1.5 text-[13px] cursor-pointer">Unpublish</button>
                  </>
                ) : (
                  <button type="button" disabled={busy === r.id} onClick={() => act(r.id, 'publish')} className="rounded-full bg-[#212121] px-4 py-1.5 text-[13px] text-white cursor-pointer disabled:opacity-60">
                    {busy === r.id ? 'Publishing…' : 'Sign off and publish'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
