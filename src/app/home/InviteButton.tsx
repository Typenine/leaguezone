'use client';

import { useState } from 'react';

interface InviteButtonProps {
  teamName: string;
  inviteCode: string;
}

export function InviteButton({ teamName, inviteCode }: InviteButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Link goes to /join/[code] — prompts new users to create a PIN,
    // and returning users to sign in directly with their team pre-selected.
    const url = `${window.location.origin}/join/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy invite link for ${teamName}`}
      className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
        copied
          ? 'bg-green-500/15 text-green-600 dark:text-green-400'
          : 'bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Invite
        </>
      )}
    </button>
  );
}
