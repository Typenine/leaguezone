'use client';

import { useState } from 'react';
import Link from 'next/link';

interface HelpSection {
  id: string;
  icon: string;
  title: string;
  description: string;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'trades',
    icon: '🔄',
    title: 'Trading Players',
    description: 'Use the Trades page to view trade history, explore trade trees, and manage your trade block. Other teams can see what players/picks you\'re willing to trade.',
  },
  {
    id: 'suggestions',
    icon: '💡',
    title: 'League Voting',
    description: 'Propose and vote on rule changes in the Suggestions section. Any team can submit ideas—endorse ones you support to move them to a ballot vote.',
  },
  {
    id: 'transactions',
    icon: '📝',
    title: 'Roster Moves',
    description: 'View all waiver pickups, drops, and FAAB bids across the league in Transactions. Your Sleeper roster syncs automatically.',
  },
  {
    id: 'newsletter',
    icon: '📰',
    title: 'Weekly Updates',
    description: 'Check the Newsletter for weekly recaps, power rankings, and league podcast episodes posted by your commissioner.',
  },
  {
    id: 'history',
    icon: '📜',
    title: 'Past Seasons',
    description: 'View champions, records, and historical standings from previous years in the History section.',
  },
  {
    id: 'invite',
    icon: '👋',
    title: 'Invite Teammates',
    description: 'Commissioners can copy invite links for unclaimed teams from the League Members section on the home page.',
  },
];

export function OnboardingHelp() {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-[var(--accent)] text-white p-3 rounded-full shadow-lg hover:opacity-90 z-50"
        aria-label="Show help"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl z-50 max-h-[70vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h3 className="font-semibold text-[var(--text)] flex items-center gap-2">
          <span>💡</span> League Guide
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-[var(--muted)] hover:text-[var(--text)] p-1"
          aria-label="Close help"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto p-4 space-y-2">
        <p className="text-sm text-[var(--muted)] mb-3">
          New to the league? Here&apos;s what you can do:
        </p>
        
        {HELP_SECTIONS.map((section) => (
          <div key={section.id} className="border border-[var(--border)] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--surface-strong)] transition-colors"
            >
              <span className="text-lg">{section.icon}</span>
              <span className="font-medium text-sm text-[var(--text)] flex-1">{section.title}</span>
              <svg 
                className={`w-4 h-4 text-[var(--muted)] transition-transform ${expandedSection === section.id ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === section.id && (
              <div className="px-3 pb-3 text-sm text-[var(--muted)] leading-relaxed">
                {section.description}
              </div>
            )}
          </div>
        ))}

        <div className="pt-3 border-t border-[var(--border)] mt-3">
          <Link
            href="/rules"
            className="block w-full text-center py-2 bg-[var(--surface-strong)] hover:bg-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] transition-colors"
          >
            📋 View Full League Rules
          </Link>
        </div>
      </div>
    </div>
  );
}

export function NewUserBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <span className="text-2xl">👋</span>
        <div className="flex-1">
          <h3 className="font-semibold text-[var(--text)] mb-1">Welcome to your league!</h3>
          <p className="text-sm text-[var(--muted)] mb-3">
            Explore the navigation cards below to view standings, make trades, and participate in league voting. 
            Click the 💡 help button in the bottom-right corner anytime for guidance.
          </p>
          <div className="flex gap-2">
            <Link
              href="/rules"
              className="inline-flex items-center px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90"
            >
              View Rules
            </Link>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
