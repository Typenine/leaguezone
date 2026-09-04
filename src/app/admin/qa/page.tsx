'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type League = { id: string; slug: string; name: string };
type Team = { rosterId: number; teamName: string; ownerName: string | null };
type Session = {
  id: string; leagueId: string; leagueName: string; leagueSlug: string; perspective: string;
  teamName: string | null; rosterId: number | null; mode: 'view' | 'rehearsal'; draftId: string | null;
  active: boolean; expiresAt: string; updatedAt: string;
};
type Payload = { leagues: League[]; teams: Team[]; active: Session | null; recent: Session[] };

const field = 'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]';

export default function AdminQaPage() {
  const search = useSearchParams();
  const requestedLeague = search.get('league') || '';
  const requestedSource = search.get('sourceDraft') || '';
  const requestedYear = search.get('year') || '';
  const [data, setData] = useState<Payload>({ leagues: [], teams: [], active: null, recent: [] });
  const [leagueId, setLeagueId] = useState(requestedLeague);
  const [perspective, setPerspective] = useState('team');
  const [teamName, setTeamName] = useState('');
  const [mode, setMode] = useState<'view' | 'rehearsal'>(requestedSource ? 'rehearsal' : 'view');
  const [year, setYear] = useState(requestedYear || String(new Date().getFullYear() + 1));
  const [rounds, setRounds] = useState('4');
  const [clockSeconds, setClockSeconds] = useState('60');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const hydratedSessionRef = useRef('');

  const load = useCallback(async (targetLeague?: string) => {
    setLoading(true);
    const qs = targetLeague ? `?leagueId=${encodeURIComponent(targetLeague)}` : '';
    const res = await fetch(`/api/admin/qa${qs}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setData(body as Payload);
    else setError(body.error || 'Could not load QA controls');
    setLoading(false);
  }, []);

  useEffect(() => { void load(requestedLeague || undefined); }, [load, requestedLeague]);
  useEffect(() => {
    if (!leagueId && data.leagues.length > 0) setLeagueId(data.leagues[0].id);
  }, [data.leagues, leagueId]);
  useEffect(() => {
    if (leagueId) void load(leagueId);
  }, [leagueId, load]);
  useEffect(() => {
    const active = data.active;
    if (!active || requestedLeague || requestedSource || hydratedSessionRef.current === active.id) return;
    hydratedSessionRef.current = active.id;
    setLeagueId(active.leagueId);
    setPerspective(active.perspective);
    setTeamName(active.teamName || '');
    setMode(active.mode);
  }, [data.active, requestedLeague, requestedSource]);
  useEffect(() => {
    if (data.teams.length > 0 && !data.teams.some((team) => team.teamName === teamName)) setTeamName(data.teams[0].teamName);
  }, [data.teams, teamName]);

  const needsTeam = perspective === 'team' || perspective === 'member';
  const selectedLeague = useMemo(() => data.leagues.find((league) => league.id === leagueId), [data.leagues, leagueId]);
  const canUpdateActive = Boolean(data.active && data.active.leagueId === leagueId && data.active.mode === mode);

  async function post(body: Record<string, unknown>) {
    setSaving(true); setError('');
    const res = await fetch('/api/admin/qa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(result.error || 'QA action failed'); return null; }
    return result as { redirect?: string };
  }

  async function start() {
    const result = await post({
      action: 'start', leagueId, perspective, teamName: needsTeam ? teamName : null, mode,
      year: Number(year), rounds: Number(rounds), clockSeconds: Number(clockSeconds), sourceDraftId: requestedSource || null,
    });
    if (result?.redirect) window.location.assign(result.redirect);
  }

  async function updateCurrentView() {
    if (!data.active || !canUpdateActive) return;
    const result = await post({
      action: 'update',
      sessionId: data.active.id,
      perspective,
      teamName: needsTeam ? teamName : null,
    });
    if (result?.redirect) window.location.assign(result.redirect);
  }

  async function sessionAction(action: string, sessionId: string) {
    const result = await post({ action, sessionId });
    if (result?.redirect) window.location.assign(result.redirect);
    else await load(leagueId);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-500">Platform Admin</p>
          <h1 className="text-3xl font-black text-[var(--text)]">QA / Test Mode</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Browse LeagueZone from a real league perspective without changing your underlying admin identity. View-only sessions cannot write data. Draft rehearsals write only to an isolated rehearsal draft.</p>
        </div>
        <Link href="/admin" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Admin Home</Link>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-bold text-[var(--text)]">{canUpdateActive ? 'Change Current QA View' : 'Start a QA Session'}</h2>
          {canUpdateActive && <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Changing the perspective keeps the same QA session. In a draft rehearsal, the same isolated draft is preserved while you switch between teams and commissioner view.</p>}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[var(--text)]">League
              <select className={`${field} mt-1`} value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
                {data.leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-[var(--text)]">View as
              <select className={`${field} mt-1`} value={perspective} onChange={(e) => setPerspective(e.target.value)}>
                <option value="public">Signed-out public visitor</option>
                <option value="member">League member</option>
                <option value="team">Specific team</option>
                <option value="commissioner">Commissioner</option>
              </select>
            </label>
            {needsTeam && <label className="text-sm font-semibold text-[var(--text)] sm:col-span-2">Team
              <select className={`${field} mt-1`} value={teamName} onChange={(e) => setTeamName(e.target.value)} disabled={loading}>
                {data.teams.map((team) => <option key={team.rosterId} value={team.teamName}>{team.teamName}{team.ownerName ? ` · ${team.ownerName}` : ''}</option>)}
              </select>
            </label>}
            <label className="text-sm font-semibold text-[var(--text)]">Mode
              <select className={`${field} mt-1`} value={mode} onChange={(e) => setMode(e.target.value as 'view' | 'rehearsal')}>
                <option value="view">View Only</option>
                <option value="rehearsal">Interactive Draft Rehearsal</option>
              </select>
            </label>
            {mode === 'rehearsal' && <>
              <label className="text-sm font-semibold text-[var(--text)]">Draft year
                <input className={`${field} mt-1`} type="number" value={year} onChange={(e) => setYear(e.target.value)} disabled={canUpdateActive} />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">Rounds
                <input className={`${field} mt-1`} type="number" min="1" max="20" value={rounds} onChange={(e) => setRounds(e.target.value)} disabled={canUpdateActive} />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">Clock seconds
                <input className={`${field} mt-1`} type="number" min="10" value={clockSeconds} onChange={(e) => setClockSeconds(e.target.value)} disabled={canUpdateActive} />
              </label>
            </>}
          </div>
          {mode === 'rehearsal' && <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-[var(--muted)]">
            {canUpdateActive ? 'Perspective changes do not reset this rehearsal. Picks, queues, trades, clocks, and setup remain attached to the same isolated QA draft.' : requestedSource ? 'This rehearsal will clone the selected live draft setup, including its current pick ownership and player pool, but not its picks or transactions.' : 'If a live draft already exists for this league and year, its setup is cloned automatically. Otherwise LeagueZone creates a fresh isolated rehearsal draft.'}
          </div>}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {canUpdateActive && <button disabled={saving || loading || (needsTeam && !teamName)} onClick={updateCurrentView} className="w-full rounded-xl bg-amber-400 px-4 py-3 font-black text-black disabled:opacity-50">{saving ? 'Applying…' : 'Apply View to Current Session'}</button>}
            <button disabled={saving || loading || !selectedLeague || (needsTeam && !teamName)} onClick={start} className={`w-full rounded-xl px-4 py-3 font-black disabled:opacity-50 ${canUpdateActive ? 'border border-[var(--border)] text-[var(--text)]' : 'bg-[var(--accent)] text-white sm:col-span-2'}`}>
              {saving ? 'Starting…' : canUpdateActive ? 'Start New Session Instead' : mode === 'rehearsal' ? 'Start Draft Rehearsal' : 'Start QA Session'}
            </button>
          </div>
        </section>

        <div className="space-y-6">
          {data.active && <section className="rounded-2xl border border-amber-500/35 bg-amber-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-amber-500">Active QA Session</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--text)]">{data.active.leagueName}</h2>
            <p className="text-sm text-[var(--muted)]">{data.active.teamName || data.active.perspective} · {data.active.mode}</p>
            {data.active.mode === 'rehearsal' && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Use the form to switch team or commissioner perspective without creating a new rehearsal draft.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => sessionAction('resume', data.active!.id)} className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-black text-black">Open Session</button>
              {data.active.mode === 'rehearsal' && <button onClick={() => sessionAction('reset', data.active!.id)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Reset Rehearsal</button>}
              <button onClick={() => sessionAction('end', data.active!.id)} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-500">Exit QA</button>
            </div>
          </section>}

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-bold text-[var(--text)]">Recent Sessions</h2>
            <div className="mt-3 space-y-2">
              {data.recent.length === 0 && <p className="text-sm text-[var(--muted)]">No QA sessions yet.</p>}
              {data.recent.map((session) => <div key={session.id} className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div><p className="text-sm font-semibold text-[var(--text)]">{session.leagueName}</p><p className="text-xs text-[var(--muted)]">{session.teamName || session.perspective} · {session.mode}</p></div>
                  <span className="text-[10px] uppercase text-[var(--muted)]">{new Date(session.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => sessionAction('resume', session.id)} className="text-xs font-semibold text-[var(--accent)]">Resume</button>
                  <button onClick={() => sessionAction('delete', session.id)} className="text-xs font-semibold text-red-500">Delete</button>
                </div>
              </div>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
