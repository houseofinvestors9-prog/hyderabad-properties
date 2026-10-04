'use client';

import React, { useEffect, useState } from 'react';

/** "Log in" or "Account" in the main header, once we know which. Hidden until WhatsApp login is set up. */
export function AccountLink({ className = '' }: { className?: string }) {
  const [label, setLabel] = useState<'Log in' | 'Account' | null>(null);
  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((me: { user: unknown; loginAvailable?: boolean }) => setLabel(me.user ? 'Account' : me.loginAvailable ? 'Log in' : null))
      .catch(() => setLabel(null));
  }, []);
  if (!label) return null;
  return (
    <a href={label === 'Account' ? '/account' : `/login?next=${encodeURIComponent('/account')}`} className={className}>
      {label}
    </a>
  );
}
