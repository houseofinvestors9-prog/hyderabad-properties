'use client';

import type { LeadSource } from './db/schema';

export interface LeadPayload {
  source: LeadSource;
  name?: string;
  email?: string;
  phone?: string;
  projectId?: string;
  projectName?: string;
  preferences?: Record<string, unknown>;
  message?: string;
  slot?: string;
}

function readUtm(): Record<string, string> | undefined {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    params.forEach((value, key) => {
      if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid') utm[key] = value.slice(0, 200);
    });
    return Object.keys(utm).length ? utm : undefined;
  } catch {
    return undefined;
  }
}

/** Send a lead to /api/leads. Resolves with an error message, or null on success. */
export async function submitLead(payload: LeadPayload): Promise<string | null> {
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, consent: true, pagePath: window.location.pathname, utm: readUtm() }),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return body.error ?? 'Something went wrong. Please try again.';
  } catch {
    return 'You seem to be offline. Please try again.';
  }
}
