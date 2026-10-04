'use client';

import React, { useState } from 'react';

const field =
  'w-full px-4 min-h-[48px] rounded-full border border-[#e5e5e5] bg-white text-[15px] text-[#212121] placeholder:text-[#a3a3a3] focus:outline-none focus:border-[#212121]';

export function ProfileForm({ name: initialName, email: initialEmail }: { name: string; email: string }) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('saving');
    setError(null);
    const res = await fetch('/api/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? 'Could not save.');
      setState('idle');
      return;
    }
    setState('saved');
  };

  return (
    <form onSubmit={save} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
      <input value={name} onChange={(e) => { setName(e.target.value); setState('idle'); }} placeholder="Your name" aria-label="Your name" className={field} />
      <input value={email} onChange={(e) => { setEmail(e.target.value); setState('idle'); }} type="email" placeholder="Email (optional)" aria-label="Email" className={field} />
      <button type="submit" disabled={state === 'saving'} className="rounded-full bg-[#212121] text-white px-6 min-h-[48px] text-[15px] font-medium disabled:opacity-60 cursor-pointer">
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
      </button>
      {error && <p className="text-[14px] text-rose-700 sm:col-span-3">{error}</p>}
    </form>
  );
}

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      }}
      className="rounded-full border border-[#e5e5e5] px-5 py-2.5 text-[14px] hover:border-[#212121] cursor-pointer"
    >
      Log out
    </button>
  );
}
