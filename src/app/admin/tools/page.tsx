'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthData = {
  db?: { ok: boolean; tables?: string[]; counts?: Record<string, number> };
  setup?: { completed: boolean; leagueName?: string; completedSteps?: string[]; sleeperLeagueId?: string | null };
  r2?: { configured: boolean; vars?: Record<string, boolean> };
  sleeper?: { configured: boolean; leagueId?: string | null };
  discord?: { trades: boolean; newsletter: boolean; taxi: boolean; general: boolean };
  resend?: { configured: boolean };
  groq?: { configured: boolean };
  cron?: { secret: boolean; taxiSecret: boolean };
  site?: { siteUrl?: string | null; nodeEnv?: string; adminSecret: boolean; superAdminKey: boolean; authSecret: boolean };
};

type Team = { rosterId: number; teamName: string; userId: string; displayName: string | null };
type SessionData = {
  authenticated: boolean;
  isAdmin: boolean;
  isSiteAdmin: boolean;
  user?: { email: string; displayName: string | null; role: string };
  claims?: Record<string, unknown>;
};

type ActionResult = { ok: boolean; [key: string]: unknown };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <span className="text-xs text-[var(--muted)]">{label}: —</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${
      ok
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        : 'bg-red-500/10 text-red-400 border-red-500/30'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_80%,var(--background))]">
        <h2 className="font-semibold text-[var(--text)] text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ResultBox({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <pre className={`mt-3 text-xs rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap break-all ${
      result.ok
        ? 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-300'
        : 'bg-red-500/5 border border-red-500/20 text-red-300'
    }`}>
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

function Btn({
  onClick, disabled, variant = 'default', children,
}: {
  onClick: () => void; disabled?: boolean; variant?: 'default' | 'danger' | 'ghost'; children: React.ReactNode;
}) {
  const base = 'inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = {
    default: 'bg-[var(--accent)] border-[var(--accent)] text-white hover:opacity-90',
    danger: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20',
    ghost: 'bg-transparent border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/60',
  };
  return (
    <button className={`${base} ${styles[variant]}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminToolsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [assumedTeam, setAssumedTeam] = useState<string | null>(null);
  const [assumeLoading, setAssumeLoading] = useState<string | null>(null);

  const [actionResults, setActionResults] = useState<Record<string, ActionResult | null>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [discordWebhook, setDiscordWebhook] = useState<'general' | 'trades' | 'newsletter' | 'taxi'>('general');

  const loadHealth = useCallback(() => {
    setHealthLoading(true);
    fetch('/api/admin/tools/health')
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false));
  }, []);

  const loadSession = useCallback(() => {
    setSessionLoading(true);
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setSession(d))
      .catch(() => setSession(null))
      .finally(() => setSessionLoading(false));
  }, []);

  const loadTeams = useCallback(() => {
    setTeamsLoading(true);
    setTeamsError(null);
    fetch('/api/admin/tools/teams')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setTeamsError(d.error);
        setTeams(d.teams || []);
      })
      .catch((e) => setTeamsError(String(e)))
      .finally(() => setTeamsLoading(false));
  }, []);

  useEffect(() => {
    loadHealth();
    loadSession();
  }, [loadHealth, loadSession]);

  async function runAction(key: string, action: string, extra: Record<string, unknown> = {}) {
    setActionLoading((p) => ({ ...p, [key]: true }));
    setActionResults((p) => ({ ...p, [key]: null }));
    try {
      const r = await fetch('/api/admin/tools/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await r.json();
      setActionResults((p) => ({ ...p, [key]: data }));
    } catch (e) {
      setActionResults((p) => ({ ...p, [key]: { ok: false, error: String(e) } }));
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
    }
  }

  async function assumeTeam(teamName: string) {
    setAssumeLoading(teamName);
    try {
      const r = await fetch('/api/admin/tools/assume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: teamName }),
      });
      if (r.ok) {
        setAssumedTeam(teamName);
        loadSession();
      }
    } finally {
      setAssumeLoading(null);
    }
  }

  async function dropAssumedSession() {
    await fetch('/api/admin/tools/assume', { method: 'DELETE' });
    setAssumedTeam(null);
    loadSession();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--background)] py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Testing Tools</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">Admin-only diagnostics and testing utilities</p>
          </div>
          <a href="/admin" className="text-sm text-[var(--accent)] hover:underline">← Admin Hub</a>
        </div>

        {/* ── System Health ─────────────────────────────────────────────── */}
        <Section title="System Health">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge ok={healthLoading ? null : !!health?.db?.ok} label="Database" />
            <Badge ok={healthLoading ? null : !!health?.setup?.completed} label="Setup complete" />
            <Badge ok={healthLoading ? null : !!health?.sleeper?.configured} label="Sleeper" />
            <Badge ok={healthLoading ? null : !!health?.r2?.configured} label="R2 Storage" />
            <Badge ok={healthLoading ? null : !!(health?.discord && Object.values(health.discord).some(Boolean))} label="Discord" />
            <Badge ok={healthLoading ? null : !!health?.resend?.configured} label="Resend" />
            <Badge ok={healthLoading ? null : !!health?.groq?.configured} label="Groq AI" />
            <Badge ok={healthLoading ? null : !!health?.cron?.secret} label="Cron secret" />
          </div>

          {health && (
            <div className="space-y-3 text-xs text-[var(--muted)]">
              {health.site && (
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span>env: <span className="text-[var(--text)] font-mono">{health.site.nodeEnv}</span></span>
                  {health.site.siteUrl && <span>SITE_URL: <span className="text-[var(--text)] font-mono">{health.site.siteUrl}</span></span>}
                  <span>auth_secret: <span className={health.site.authSecret ? 'text-emerald-400' : 'text-red-400'}>{health.site.authSecret ? 'set' : 'missing (using default!)'}</span></span>
                </div>
              )}
              {health.discord && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(health.discord).map(([k, v]) => (
                    <span key={k}>{k}: <span className={v ? 'text-emerald-400' : 'text-[var(--muted)]'}>{v ? '✓' : '—'}</span></span>
                  ))}
                </div>
              )}
              {health.db?.tables && (
                <details className="mt-1">
                  <summary className="cursor-pointer hover:text-[var(--text)]">DB tables ({health.db.tables.length})</summary>
                  <div className="mt-1 font-mono flex flex-wrap gap-2 pl-2">
                    {health.db.tables.map((t) => (
                      <span key={t} className="text-[var(--text)]">{t}{health.db?.counts?.[t] !== undefined ? ` (${health.db.counts[t]})` : ''}</span>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Btn onClick={loadHealth} disabled={healthLoading} variant="ghost">
              {healthLoading ? 'Loading…' : '↺ Refresh'}
            </Btn>
            <Btn onClick={() => runAction('db-counts', 'db-counts')} disabled={actionLoading['db-counts']} variant="ghost">
              {actionLoading['db-counts'] ? 'Counting…' : 'DB row counts'}
            </Btn>
          </div>
          <ResultBox result={actionResults['db-counts'] ?? null} />
        </Section>

        {/* ── Session Inspector ─────────────────────────────────────────── */}
        <Section title="Session Inspector">
          {sessionLoading ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : session ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge ok={session.isAdmin} label="Admin cookie" />
                <Badge ok={session.isSiteAdmin} label="Site admin" />
                <Badge ok={session.authenticated} label="User session" />
              </div>
              {session.user && (
                <div className="text-xs text-[var(--muted)] space-y-0.5 mt-2">
                  <div>email: <span className="text-[var(--text)] font-mono">{session.user.email}</span></div>
                  <div>role: <span className="text-[var(--text)] font-mono">{session.user.role}</span></div>
                  {session.user.displayName && <div>display name: <span className="text-[var(--text)]">{session.user.displayName}</span></div>}
                </div>
              )}
              {session.claims && !session.user && (
                <pre className="text-xs text-[var(--muted)] font-mono mt-2 bg-[var(--background)] p-2 rounded">
                  {JSON.stringify(session.claims, null, 2)}
                </pre>
              )}
              {assumedTeam && (
                <div className="mt-3 p-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/5 flex items-center justify-between gap-3">
                  <span className="text-xs text-yellow-400">Assuming: <strong>{assumedTeam}</strong></span>
                  <Btn onClick={dropAssumedSession} variant="ghost">Drop session</Btn>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-400">Failed to load session</p>
          )}
          <div className="mt-3">
            <Btn onClick={loadSession} disabled={sessionLoading} variant="ghost">
              {sessionLoading ? 'Loading…' : '↺ Refresh'}
            </Btn>
          </div>
        </Section>

        {/* ── Assume Team Identity ──────────────────────────────────────── */}
        <Section title="Assume Team Identity">
          <p className="text-xs text-[var(--muted)] mb-4">
            Sets a temporary session cookie as that team so you can test their view. Your admin cookie is preserved — click &quot;Drop session&quot; above to return to admin-only mode.
          </p>
          {teams.length === 0 && !teamsLoading && (
            <Btn onClick={loadTeams} variant="ghost">Load teams from Sleeper</Btn>
          )}
          {teamsLoading && <p className="text-sm text-[var(--muted)]">Loading teams…</p>}
          {teamsError && <p className="text-sm text-red-400">{teamsError}</p>}
          {teams.length > 0 && (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.rosterId}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    assumedTeam === team.teamName
                      ? 'border-yellow-500/40 bg-yellow-500/5'
                      : 'border-[var(--border)] bg-[var(--background)]'
                  }`}
                >
                  <div>
                    <span className="text-sm font-medium text-[var(--text)]">{team.teamName}</span>
                    {team.displayName && team.displayName !== team.teamName && (
                      <span className="ml-2 text-xs text-[var(--muted)]">({team.displayName})</span>
                    )}
                    <span className="ml-2 text-xs text-[var(--muted)]">#{team.rosterId}</span>
                  </div>
                  {assumedTeam === team.teamName ? (
                    <Btn onClick={dropAssumedSession} variant="ghost">Drop</Btn>
                  ) : (
                    <Btn
                      onClick={() => assumeTeam(team.teamName)}
                      disabled={assumeLoading === team.teamName}
                      variant="ghost"
                    >
                      {assumeLoading === team.teamName ? 'Assuming…' : 'Assume'}
                    </Btn>
                  )}
                </div>
              ))}
              <Btn onClick={loadTeams} disabled={teamsLoading} variant="ghost">↺ Refresh</Btn>
            </div>
          )}
        </Section>

        {/* ── Integration Tests ─────────────────────────────────────────── */}
        <Section title="Integration Tests">
          <div className="space-y-5">

            {/* Sleeper ping */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[var(--text)]">Sleeper API Ping</span>
                <Btn onClick={() => runAction('sleeper-ping', 'sleeper-ping')} disabled={actionLoading['sleeper-ping']}>
                  {actionLoading['sleeper-ping'] ? 'Pinging…' : 'Ping'}
                </Btn>
              </div>
              <p className="text-xs text-[var(--muted)]">Fetches live league info from Sleeper to verify connectivity and league ID.</p>
              <ResultBox result={actionResults['sleeper-ping'] ?? null} />
            </div>

            {/* Discord test */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[var(--text)]">Discord Webhook Test</span>
                <div className="flex items-center gap-2">
                  <select
                    value={discordWebhook}
                    onChange={(e) => setDiscordWebhook(e.target.value as typeof discordWebhook)}
                    className="text-xs rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] px-2 py-1 focus:outline-none"
                  >
                    <option value="general">General</option>
                    <option value="trades">Trades</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="taxi">Taxi</option>
                  </select>
                  <Btn
                    onClick={() => runAction('discord-test', 'discord-test', { webhook: discordWebhook })}
                    disabled={actionLoading['discord-test']}
                  >
                    {actionLoading['discord-test'] ? 'Sending…' : 'Send test'}
                  </Btn>
                </div>
              </div>
              <p className="text-xs text-[var(--muted)]">Posts a test embed to the selected Discord webhook.</p>
              <ResultBox result={actionResults['discord-test'] ?? null} />
            </div>

          </div>
        </Section>

        {/* ── Manual Cron Triggers ──────────────────────────────────────── */}
        <Section title="Manual Cron Triggers">
          <p className="text-xs text-[var(--muted)] mb-4">
            Fires the cron endpoint directly from the server. Requires <code className="font-mono bg-[var(--background)] px-1 rounded">CRON_SECRET</code> or <code className="font-mono bg-[var(--background)] px-1 rounded">TAXI_CRON_SECRET</code> to be set.
          </p>
          <div className="space-y-4">
            {[
              { job: 'trade-notifier', label: 'Trade Notifier', desc: 'Polls Sleeper for new trades and posts to Discord.' },
              { job: 'taxi', label: 'Taxi Cron', desc: 'Runs taxi squad compliance checks and writes snapshots.' },
              { job: 'lineup-snapshot', label: 'Lineup Snapshot', desc: 'Captures current lineup data from Sleeper.' },
            ].map(({ job, label, desc }) => (
              <div key={job}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--text)]">{label}</span>
                  <Btn
                    onClick={() => runAction(`cron-${job}`, 'cron-trigger', { job })}
                    disabled={actionLoading[`cron-${job}`]}
                    variant="ghost"
                  >
                    {actionLoading[`cron-${job}`] ? 'Running…' : '▶ Run'}
                  </Btn>
                </div>
                <p className="text-xs text-[var(--muted)]">{desc}</p>
                <ResultBox result={actionResults[`cron-${job}`] ?? null} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Danger Zone ───────────────────────────────────────────────── */}
        <Section title="Danger Zone">
          <div className="space-y-5">

            {/* Setup reset */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-sm font-medium text-[var(--text)]">Reset Setup Wizard</span>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Marks the league as setup-incomplete so you can re-run <code className="font-mono bg-[var(--background)] px-1 rounded">/setup</code>. Does not delete any data.
                  </p>
                </div>
                <Btn
                  onClick={() => runAction('setup-reset', 'setup-reset')}
                  disabled={actionLoading['setup-reset']}
                  variant="danger"
                >
                  {actionLoading['setup-reset'] ? 'Resetting…' : 'Reset'}
                </Btn>
              </div>
              <ResultBox result={actionResults['setup-reset'] ?? null} />
            </div>

            {/* Clear trade events */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-sm font-medium text-[var(--text)]">Clear Trade Notification Records</span>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Deletes all Discord notification de-dupe records so the trade notifier will re-post all trades on next run.
                  </p>
                </div>
                <Btn
                  onClick={() => runAction('clear-trade-events', 'clear-trade-events')}
                  disabled={actionLoading['clear-trade-events']}
                  variant="danger"
                >
                  {actionLoading['clear-trade-events'] ? 'Clearing…' : 'Clear'}
                </Btn>
              </div>
              <ResultBox result={actionResults['clear-trade-events'] ?? null} />
            </div>

          </div>
        </Section>

      </div>
    </div>
  );
}
