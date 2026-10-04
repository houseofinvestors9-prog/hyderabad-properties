'use client';

import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';

const field =
  'w-full px-5 min-h-[52px] rounded-full border border-[#e5e5e5] bg-white text-[16px] text-[#212121] placeholder:text-[#a3a3a3] focus:outline-none focus:border-[#212121]';

/** WhatsApp number -> 6-digit code -> logged in. */
export function LoginForm({ next }: { next: string }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/request-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string; devCode?: string };
    setBusy(false);
    if (!res?.ok) {
      setError(body?.error ?? 'Something went wrong. Please try again.');
      return;
    }
    setDevCode(body.devCode ?? null);
    setStep('code');
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, code, next }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string };
    if (!res?.ok) {
      setBusy(false);
      setError(body?.error ?? 'Something went wrong. Please try again.');
      return;
    }
    window.location.href = next;
  };

  return (
    <div className="space-y-5">
      {step === 'phone' ? (
        <form onSubmit={requestCode} className="space-y-4">
          <label className="block text-[14px] font-medium text-[#212121]" htmlFor="phone">
            WhatsApp number
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98765 43210"
            className={field}
          />
          <button
            type="submit"
            disabled={busy || phone.replace(/\D/g, '').length < 10}
            className="w-full min-h-[52px] rounded-full bg-[#212121] text-white text-[16px] font-medium flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" strokeWidth={2} />
            {busy ? 'Sending…' : 'Send code on WhatsApp'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-[15px] text-[#4a4a4a]">
            We sent a 6-digit code to <strong className="text-[#212121]">{phone}</strong> on WhatsApp.
          </p>
          <label className="block text-[14px] font-medium text-[#212121]" htmlFor="code">
            Code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className={`${field} tracking-[0.3em]`}
          />
          {devCode && <p className="text-[13px] text-[#838383]">Development mode: your code is {devCode}.</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full min-h-[52px] rounded-full bg-[#212121] text-white text-[16px] font-medium disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'Checking…' : 'Log in'}
          </button>
          <div className="flex justify-between text-[14px]">
            <button type="button" onClick={() => { setStep('phone'); setCode(''); }} className="underline underline-offset-4 cursor-pointer">
              Change number
            </button>
            <button type="button" onClick={() => requestCode()} disabled={busy} className="underline underline-offset-4 cursor-pointer">
              Send a new code
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="text-[14px] text-rose-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
