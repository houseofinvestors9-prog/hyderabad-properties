'use client';

import React, { useState } from 'react';

const field =
  'w-full px-4 min-h-[48px] rounded-[14px] border border-[#e5e5e5] bg-white text-[15px] text-[#212121] placeholder:text-[#a3a3a3] focus:outline-none focus:border-[#212121]';

export function CorrectionForm({ pageUrl }: { pageUrl: string }) {
  const [fromRole, setFromRole] = useState<'buyer' | 'builder' | 'other'>('buyer');
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [contact, setContact] = useState('');
  const [page, setPage] = useState(pageUrl);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (state === 'sent') {
    return (
      <p className="rounded-[14px] bg-[#f9f9f9] p-5 text-[15px] text-[#212121]">
        Thank you. A person on our team reads every request and replies within three working days.
      </p>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setState('sending');
        setError(null);
        const res = await fetch('/api/corrections', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pageUrl: page, fromRole, name, organisation, contact, message, website }),
        }).catch(() => null);
        const body = (await res?.json().catch(() => ({}))) as { error?: string };
        if (!res?.ok) {
          setError(body?.error ?? 'Something went wrong. Please try again.');
          setState('idle');
          return;
        }
        setState('sent');
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="You are">
        {(['buyer', 'builder', 'other'] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={fromRole === r}
            onClick={() => setFromRole(r)}
            className={`rounded-full px-4 py-2 text-[14px] border cursor-pointer ${fromRole === r ? 'bg-[#212121] text-white border-[#212121]' : 'border-[#e5e5e5]'}`}
          >
            {r === 'buyer' ? 'I am a buyer' : r === 'builder' ? 'I represent the builder' : 'Other'}
          </button>
        ))}
      </div>
      <input value={page} onChange={(e) => setPage(e.target.value)} placeholder="Page address (link)" aria-label="Page address" className={field} />
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className={field} />
        {fromRole === 'builder' && (
          <input value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder="Company" aria-label="Company" className={field} />
        )}
        <input required value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or phone, for our reply" aria-label="Email or phone" className={field} />
      </div>
      <textarea
        required
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        placeholder="What is wrong or out of date? Links to documents help us fix it faster."
        aria-label="What is wrong"
        className={`${field} py-3`}
      />
      <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden="true" />
      {error && <p className="text-[14px] text-rose-700" role="alert">{error}</p>}
      <button type="submit" disabled={state === 'sending'} className="rounded-full bg-[#212121] text-white px-6 min-h-[48px] text-[15px] font-medium disabled:opacity-60 cursor-pointer">
        {state === 'sending' ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
