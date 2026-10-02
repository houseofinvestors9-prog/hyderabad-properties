'use client';

import React, { useState } from 'react';
import type { ProjectRequestGroup } from '@/lib/project-requests';

interface Props {
  initialRequests: ProjectRequestGroup[];
}

function when(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

/**
 * Projects buyers searched for that we don't cover yet, most asked-for first.
 * Mark one "Researching" while the records are pulled, and "Added" once it is live.
 */
export function ProjectRequestsPanel({ initialRequests }: Props) {
  const [rows, setRows] = useState(initialRequests);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const move = async (key: string, status: 'researching' | 'added' | 'rejected') => {
    setBusy(key);
    setError(null);
    const res = await fetch('/api/admin/project-requests', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nameKey: key, status }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      setError('Could not update. Please try again.');
      return;
    }
    setRows((prev) =>
      status === 'researching' ? prev.map((r) => (r.nameKey === key ? { ...r, status } : r)) : prev.filter((r) => r.nameKey !== key)
    );
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16" aria-label="Projects buyers asked for">
      <div className="rounded-[20px] border border-[#eeeeee] bg-white overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#eeeeee] flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-xl font-medium text-[#212121]">Projects buyers asked for ({rows.length})</h2>
            <p className="text-sm text-[#838383]">Not in our database yet. Add the most requested first.</p>
          </div>
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>

        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[#838383]">No open requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[#838383]">
                <tr className="border-b border-[#eeeeee]">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Area</th>
                  <th className="px-5 py-3 font-medium">Builder</th>
                  <th className="px-5 py-3 font-medium">RERA no</th>
                  <th className="px-5 py-3 font-medium text-right">Asked</th>
                  <th className="px-5 py-3 font-medium">Last asked</th>
                  <th className="px-5 py-3 font-medium sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.nameKey} className="border-b border-[#f2f2f2] last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-[#212121]">{r.projectName}</div>
                      {r.stage && <div className="text-xs text-[#838383]">{r.stage}</div>}
                    </td>
                    <td className="px-5 py-3 text-[#4a4a4a]">{r.area ?? '—'}</td>
                    <td className="px-5 py-3 text-[#4a4a4a]">{r.developer ?? '—'}</td>
                    <td className="px-5 py-3 text-[#4a4a4a] tabular-nums">{r.reraNumber ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{r.requests}</td>
                    <td className="px-5 py-3 text-[#838383]">{when(r.lastAskedAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        {r.status === 'new' ? (
                          <button
                            type="button"
                            disabled={busy === r.nameKey}
                            onClick={() => move(r.nameKey, 'researching')}
                            className="px-3 py-1.5 rounded-full border border-[#eeeeee] hover:border-[#212121] text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Start research
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded-full bg-[#f2f2f2] text-xs font-semibold">Researching</span>
                        )}
                        <button
                          type="button"
                          disabled={busy === r.nameKey}
                          onClick={() => move(r.nameKey, 'added')}
                          className="px-3 py-1.5 rounded-full bg-[#212121] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Mark added
                        </button>
                        <button
                          type="button"
                          disabled={busy === r.nameKey}
                          onClick={() => move(r.nameKey, 'rejected')}
                          className="px-3 py-1.5 rounded-full text-[#838383] hover:text-[#212121] text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
