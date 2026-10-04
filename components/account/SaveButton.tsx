'use client';

import React, { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';

/** Save a project to the buyer's account. Sends people to the WhatsApp login when they are not logged in. */
export function SaveButton({ kind, refId }: { kind: 'rera' | 'project'; refId: string }) {
  const [state, setState] = useState<'loading' | 'out' | 'saved' | 'unsaved'>('loading');

  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((me: { user: unknown; saved?: { kind: string; ref: string }[]; loginAvailable?: boolean }) => {
        if (!me.user) setState(me.loginAvailable === false ? 'loading' : 'out');
        else setState(me.saved?.some((s) => s.kind === kind && s.ref === refId) ? 'saved' : 'unsaved');
      })
      .catch(() => setState('out'));
  }, [kind, refId]);

  if (state === 'loading') return null;

  const toggle = async () => {
    if (state === 'out') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const next = state !== 'saved';
    setState(next ? 'saved' : 'unsaved');
    const res = await fetch('/api/me/saved', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, ref: refId, saved: next }),
    });
    if (!res.ok) setState(next ? 'unsaved' : 'saved');
  };

  const saved = state === 'saved';
  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-medium border transition-colors cursor-pointer ${
        saved ? 'bg-[#212121] text-white border-[#212121]' : 'border-[#e5e5e5] text-[#212121] hover:border-[#212121]'
      }`}
    >
      {saved ? <BookmarkCheck className="w-4 h-4" strokeWidth={1.8} /> : <Bookmark className="w-4 h-4" strokeWidth={1.8} />}
      {saved ? 'Saved' : 'Save this project'}
    </button>
  );
}
