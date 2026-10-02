'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { PrivacyPledge } from '@/components/PrivacyPledge';

interface RequestProjectFormProps {
  /** What the buyer typed into search, used to prefill the project name. */
  initialName?: string;
  title?: string;
  className?: string;
}

const STAGES = ['Pre-launch', 'Under construction', 'Ready to move', 'Not sure'];

const field =
  'w-full px-4 min-h-[48px] rounded-full border border-[#eeeeee] bg-white text-[15px] text-[#212121] placeholder:text-[#a3a3a3] focus:outline-none focus:border-[#212121]';

/**
 * Asks for the basics of a project we have not checked yet. Every submission lands on the
 * Review Desk as a project to add, and in the CRM as a lead with a named project in mind.
 */
export function RequestProjectForm({ initialName = '', title = 'Ask us to check it', className = '' }: RequestProjectFormProps) {
  const [projectName, setProjectName] = useState(initialName);
  const [area, setArea] = useState('');
  const [developer, setDeveloper] = useState('');
  const [reraNumber, setReraNumber] = useState('');
  const [stage, setStage] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim() && !email.trim()) {
      setError('Add a phone number or email so we can tell you when the report is ready.');
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/project-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectName,
          area,
          developer,
          reraNumber,
          stage,
          searchedQuery: initialName || undefined,
          requesterName: name,
          requesterPhone: phone,
          requesterEmail: email,
          consent: true,
          website,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Something went wrong. Please try again.');
        setState('idle');
        return;
      }
      setState('sent');
    } catch {
      setError('You seem to be offline. Please try again.');
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <div className={`py-6 text-center space-y-3 ${className}`}>
        <div className="mx-auto w-12 h-12 rounded-full bg-[#f2f2f2] flex items-center justify-center">
          <Check className="w-5 h-5 text-[#212121]" strokeWidth={2} />
        </div>
        <h3 className="text-[22px] font-medium text-[#212121]">{projectName} is on our list</h3>
        <p className="text-[15px] text-[#838383] max-w-sm mx-auto">
          We’ll pull its records and tell you on {phone || email} when the report is ready, usually within two working days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`space-y-3 ${className}`} noValidate>
      <h3 className="text-[22px] font-medium text-[#212121] mb-1">{title}</h3>

      <p className="text-[14px] font-semibold text-[#212121] pt-1">About the project</p>
      <input
        type="text"
        required
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Project name"
        aria-label="Project name"
        className={field}
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          type="text"
          required
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="Area, e.g. Kokapet"
          aria-label="Area or locality"
          className={field}
        />
        <input
          type="text"
          value={developer}
          onChange={(e) => setDeveloper(e.target.value)}
          placeholder="Builder (if you know)"
          aria-label="Builder or developer, optional"
          className={field}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          type="text"
          value={reraNumber}
          onChange={(e) => setReraNumber(e.target.value)}
          placeholder="RERA number (optional)"
          aria-label="RERA number, optional"
          className={field}
        />
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          aria-label="Construction stage, optional"
          className={`${field} cursor-pointer ${stage ? '' : 'text-[#a3a3a3]'}`}
        >
          <option value="">Stage (optional)</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[14px] font-semibold text-[#212121] pt-2">Where should we send the report?</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          className={field}
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="WhatsApp number"
          aria-label="WhatsApp number"
          className={field}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="or email"
          aria-label="Email address"
          className={field}
        />
      </div>

      {/* Hidden from people, visible to bots */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      {error && <p className="text-[14px] text-rose-700" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={state === 'sending' || projectName.trim().length < 2 || area.trim().length < 2}
        className="w-full rounded-full bg-[#212121] hover:bg-black text-white text-[15px] font-semibold py-3.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'sending' ? 'Sending…' : 'Check this project for me'}
      </button>
      <PrivacyPledge compact />
    </form>
  );
}
