'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type HealthData = {
  db?: { ok: boolean; tables?: string[]; counts?: Record<string, number> };
  setup?: { completed: boolean; leagueName?: string; completedSteps?: string[] };
  r2?: { configured: boolean };
  sleeper?: { configured: boolean; leagueId?: string | null };
  discord?: { trades: boolean; newsletter: boolean; taxi: boolean; general: boolean };
  resend?: { configured: boolean };
  groq?: { configured: boolean };
  site?: { siteUrl?: string | null; nodeEnv?: string };
};

type StatusDot = 'ok' | 'warn' | 'off' | 'loading';

function Dot({ status }: { status: StatusDot }) {
  const colors: Record<StatusDot, string> = {
    ok: 'bg-emerald-500',
    warn: 'bg-yellow-400',
    off: 'bg-[var(--muted)] opacity-40',
    loading: 'bg-[var(--muted)] animate-pulse',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />;
}

const NAV_CARDS = [
  { href: '/admin/tools', label: 'Testing Tools', icon: '🔧', desc: 'Health checks, assume identity, cron triggers, integration tests' },
  { href: '/admin/users', label: 'Users & PINs', icon: '👥', desc: 'Login activity, time tracking, reset team PINs' },
  { href: '/admin/trades', label: 'Trades', icon: '🔄', desc: 'View and manage league trades' },
  { href: '/admin/taxi', label: 'Taxi Squad', icon: '🚕', desc: 'Taxi squad compliance and observations' },
  { href: '/admin/suggestions', label: 'Suggestions', icon: '💬', desc: 'Community suggestions and votes' },
  { href: '/admin/draft', label: 'Draft', icon: '📋', desc: 'Draft room admin controls' },
  { href: '/setup', label: 'Setup Wizard', icon: '⚙️', desc: 'Re-run league setup steps' },
  { href: '/admin/storage-test', label: 'Storage Test', icon: '📦', desc: 'R2 upload smoke test' },
];

export default function AdminHubPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/tools/health')
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  const dbStatus: StatusDot = loading ? 'loading' : health?.db?.ok ? 'ok' : 'warn';
  const sleeperStatus: StatusDot = loading ? 'loading' : health?.sleeper?.configured ? 'ok' : 'off';
  const r2Status: StatusDot = loading ? 'loading' : health?.r2?.configured ? 'ok' : 'off';
  const discordAny = health?.discord ? Object.values(health.discord).some(Boolean) : false;
  const discordStatus: StatusDot = loading ? 'loading' : discordAny ? 'ok' : 'off';
  const resendStatus: StatusDot = loading ? 'loading' : health?.resend?.configured ? 'ok' : 'off';
  const groqStatus: StatusDot = loading ? 'loading' : health?.groq?.configured ? 'ok' : 'off';

  return (
    <div className="min-h-screen bg-[var(--background)] py-10 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text)]">Admin</h1>
          {health?.setup?.leagueName && (
            <p className="text-[var(--muted)] mt-1">{health.setup.leagueName}</p>
          )}
          {health?.site?.nodeEnv && (
            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded font-mono ${
              health.site.nodeEnv === 'production'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            }`}>
              {health.site.nodeEnv}
            </span>
          )}
        </div>

        {/* Integration status strip */}
        <div className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-wrap gap-5">
          {[
            { label: 'Database', status: dbStatus },
            { label: 'Sleeper', status: sleeperStatus },
            { label: 'R2 Storage', status: r2Status },
            { label: 'Discord', status: discordStatus },
            { label: 'Resend', status: resendStatus },
            { label: 'Groq AI', status: groqStatus },
          ].map(({ label, status }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-[var(--text)]">
              <Dot status={status} />
              <span>{label}</span>
            </div>
          ))}
          <Link href="/admin/tools" className="ml-auto text-xs text-[var(--accent)] hover:underline self-center">
            Full diagnostics →
          </Link>
        </div>

        {/* Setup warning */}
        {health && !health.setup?.completed && (
          <div className="mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
            <span className="text-yellow-400 text-lg">⚠️</span>
            <div>
              <p className="text-yellow-400 font-medium text-sm">Setup not completed</p>
              <p className="text-[var(--muted)] text-xs mt-0.5">
                Completed steps: {health.setup?.completedSteps?.join(', ') || 'none'}
              </p>
              <Link href="/setup" className="text-xs text-[var(--accent)] hover:underline mt-1 inline-block">
                Continue setup →
              </Link>
            </div>
          </div>
        )}

        {/* Nav grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {NAV_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] transition-all"
            >
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors text-sm">
                {card.label}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1 leading-relaxed">{card.desc}</div>
            </Link>
          ))}
        </div>

        {/* DB quick counts */}
        {health?.db?.counts && Object.keys(health.db.counts).length > 0 && (
          <div className="mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">DB Row Counts</p>
            <div className="flex flex-wrap gap-4">
              {Object.entries(health.db.counts).map(([table, count]) => (
                <div key={table} className="text-sm">
                  <span className="text-[var(--muted)]">{table}</span>
                  <span className="ml-2 font-mono text-[var(--text)]">{count < 0 ? '?' : count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
