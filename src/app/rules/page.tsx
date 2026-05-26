'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import SectionHeader from '@/components/ui/SectionHeader';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import Link from 'next/link';

// ── Search / highlight helpers ────────────────────────────────────────────────

function highlightHtml(html: string, query: string): string {
  if (!query.trim()) return html;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return html.replace(/>([^<]+)</g, (_, text) =>
    '>' + text.replace(regex, '<mark class="rules-highlight">$1</mark>') + '<'
  );
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

// ── Ask Clancy ────────────────────────────────────────────────────────────────

function AskClancy() {
  const [clancyQuestion, setClancyQuestion] = useState('');
  const [clancyAnswer, setClancyAnswer] = useState<string | null>(null);
  const [clancyLoading, setClancyLoading] = useState(false);
  const [clancyError, setClancyError] = useState<string | null>(null);
  const [clancyRemaining, setClancyRemaining] = useState<number | null>(null);
  const [clancyLimit, setClancyLimit] = useState(30);
  const [clancyWarn, setClancyWarn] = useState(false);

  useEffect(() => {
    fetch('/api/rules/ask')
      .then((r) => r.json())
      .then((d: { remaining?: number; limit?: number; warn?: boolean }) => {
        if (d.remaining != null) setClancyRemaining(d.remaining);
        if (d.limit != null) setClancyLimit(d.limit);
        if (d.warn != null) setClancyWarn(d.warn);
      })
      .catch(() => {});
  }, []);

  const askClancy = useCallback(async () => {
    const q = clancyQuestion.trim();
    if (!q || clancyLoading) return;
    setClancyLoading(true);
    setClancyAnswer(null);
    setClancyError(null);
    try {
      const res = await fetch('/api/rules/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json() as {
        answer?: string; sectionId?: string; error?: string;
        remaining?: number; limit?: number; warn?: boolean; limitReached?: boolean;
      };
      if (!res.ok || data.error) {
        setClancyError(data.error ?? 'Something went wrong.');
        if (data.remaining != null) setClancyRemaining(data.remaining);
      } else {
        setClancyAnswer(data.answer ?? '');
        if (data.remaining != null) setClancyRemaining(data.remaining);
        if (data.limit != null) setClancyLimit(data.limit);
        if (data.warn != null) setClancyWarn(data.warn);
      }
    } catch {
      setClancyError('Could not reach Clancy. Check your connection.');
    } finally {
      setClancyLoading(false);
    }
  }, [clancyQuestion, clancyLoading]);

  return (
    <div className="mb-8 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]" style={{ background: 'var(--surface-strong)' }}>
        <img src="/clancy.png" alt="Clancy" className="w-7 h-7 rounded-full object-cover shrink-0" />
        <span className="text-sm font-bold text-[var(--text)] tracking-wide">Ask Clancy</span>
        <span className="text-xs text-[var(--muted)] ml-1">— rulebook Q&amp;A</span>
        <span className="text-xs text-[var(--muted)] px-1.5 py-0.5 rounded-full border border-[var(--border)] ml-1">AI · May be wrong</span>
        {clancyRemaining !== null && (
          <span className={`ml-auto text-xs font-medium ${clancyWarn ? '' : 'text-[var(--muted)]'}`}
            style={clancyWarn ? { color: clancyRemaining === 0 ? 'var(--danger)' : '#f59e0b' } : {}}>
            {clancyRemaining === 0
              ? 'Daily limit reached — resets at midnight UTC'
              : clancyWarn
                ? `Only ${clancyRemaining} of ${clancyLimit} questions left today`
                : `${clancyRemaining} of ${clancyLimit} questions remaining today`}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={clancyQuestion}
            onChange={(e) => setClancyQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askClancy()}
            placeholder="e.g. What's the trade deadline? Can I have two QBs on taxi?"
            maxLength={500}
            disabled={clancyRemaining === 0 || clancyLoading}
            className="flex-1 rounded-[var(--radius-card)] bg-[var(--surface-strong)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-40"
          />
          <button
            onClick={askClancy}
            disabled={!clancyQuestion.trim() || clancyRemaining === 0 || clancyLoading}
            className="px-4 py-2 rounded-[var(--radius-card)] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {clancyLoading ? '…' : 'Ask'}
          </button>
        </div>
        {(clancyAnswer || clancyError) && (
          <div className={`mt-3 rounded-[var(--radius-card)] px-4 py-3 text-sm border ${clancyError ? 'border-[var(--danger)]' : 'border-[var(--border)]'}`}
            style={{ background: 'var(--surface-strong)' }}>
            {clancyError ? (
              <p style={{ color: 'var(--danger)' }}>{clancyError}</p>
            ) : (
              <>
                <p className="text-[var(--text)] whitespace-pre-wrap leading-relaxed">{clancyAnswer}</p>
                <p className="mt-3 text-xs leading-snug" style={{ color: 'var(--muted)' }}>
                  Clancy is an AI and can make mistakes. Always verify against the actual rulebook.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rich text rules view ──────────────────────────────────────────────────────

function RichTextRules({ html }: { html: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/admin-login').then(r => r.json()).then(j => setIsAdmin(Boolean(j?.isAdmin))).catch(() => {});
  }, []);

  const q = searchQuery.toLowerCase().trim();
  const searchText = stripTags(html).toLowerCase();
  const matchesSearch = !q || searchText.includes(q);
  const processedHtml = matchesSearch ? highlightHtml(html, q) : '';

  return (
    <div>
      <div className="mb-8">
        <Label htmlFor="rules-search" className="mb-1 block">Search rules</Label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--muted)]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <Input
            id="rules-search"
            type="text"
            placeholder="Search rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <AskClancy />

      {matchesSearch ? (
        <Card>
          <CardContent>
            <div
              className="rules-content space-y-4"
              dangerouslySetInnerHTML={{ __html: processedHtml }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8">
          <p className="text-[var(--muted)]">No rules found matching your search.</p>
          <Button onClick={() => setSearchQuery('')} className="mt-4">Clear Search</Button>
        </div>
      )}

      {isAdmin && (
        <div className="mt-6 text-right">
          <Link href="/settings" className="text-sm text-[var(--accent)] hover:underline">
            Edit Rules in Settings →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── PDF rules view ────────────────────────────────────────────────────────────

function PdfRules({ fileUrl }: { fileUrl: string }) {
  return (
    <div>
      <div className="rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: '80vh' }}>
        <iframe
          src={fileUrl}
          className="w-full h-full"
          title="League Rules PDF"
        />
      </div>
      <p className="mt-3 text-xs text-[var(--muted)] text-center">
        If the PDF does not load,{' '}
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">
          open it directly
        </a>.
      </p>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyRules({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
      <div className="text-5xl mb-4">📋</div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Rules Posted Yet</h2>
      <p className="text-[var(--muted)] mb-6">
        League rules have not been published. Check back later.
      </p>
      {isAdmin && (
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          Add Rules in Settings →
        </Link>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type RulesData = {
  rulesContent: string | null;
  rulesFileKey: string | null;
};

export default function RulesPage() {
  const [data, setData] = useState<RulesData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    Promise.all([
      fetch('/api/settings/rules').then(r => r.json()).catch(() => ({ rulesContent: null, rulesFileKey: null })),
      fetch('/api/admin-login').then(r => r.json()).then(j => Boolean(j?.isAdmin)).catch(() => false),
    ]).then(([rulesData, adminStatus]: [RulesData, boolean]) => {
      setData(rulesData);
      setIsAdmin(adminStatus);
    });
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <style dangerouslySetInnerHTML={{ __html: `
        .rules-content p { margin-bottom: 0.75rem; line-height: 1.6; }
        .rules-content p strong { color: var(--text); font-weight: 600; }
        .rules-content ul { margin-left: 1.5rem; margin-bottom: 1rem; list-style-type: disc; }
        .rules-content ul ul { margin-left: 1.5rem; margin-top: 0.5rem; list-style-type: circle; }
        .rules-content ul ul ul { list-style-type: square; }
        .rules-content li { margin-bottom: 0.5rem; line-height: 1.6; padding-left: 0.25rem; }
        .rules-content li strong { color: var(--text); font-weight: 600; }
        .rules-content li > ul { margin-top: 0.5rem; }
        mark.rules-highlight {
          background-color: color-mix(in srgb, var(--gold, #f59e0b) 30%, transparent);
          color: var(--text);
          border-radius: 2px;
          padding: 0 2px;
        }
      ` }} />

      <SectionHeader title="League Rules" />

      {data === null ? (
        <div className="text-[var(--muted)] text-sm mt-8">Loading rules…</div>
      ) : data.rulesContent ? (
        <RichTextRules html={data.rulesContent} />
      ) : data.rulesFileKey ? (
        <PdfRules fileUrl={data.rulesFileKey} />
      ) : (
        <EmptyRules isAdmin={isAdmin} />
      )}
    </div>
  );
}
