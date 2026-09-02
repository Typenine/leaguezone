'use client';

import { useMemo, useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export type PlayoffLabTeam = { rosterId: number; teamName: string; wins: number; losses: number; ties: number; pointsFor: number; ppg: number; scoreStdDev: number };
export type PlayoffLabGame = { id: string; week: number; aRosterId: number; aTeam: string; bRosterId: number; bTeam: string };
type Props = { teams: PlayoffLabTeam[]; games: PlayoffLabGame[]; playoffTeams: number; completedWeeks: number };

function randomFactory(seedText: string) {
  let seed = 2166136261;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function normal(random: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(random(), 1e-9))) * Math.cos(2 * Math.PI * Math.max(random(), 1e-9));
}

function simulate(teams: PlayoffLabTeam[], games: PlayoffLabGame[], picks: Record<string, number | null>, playoffTeams: number) {
  const iterations = 2500;
  const playoffCounts = new Map<number, number>();
  const seedTotals = new Map<number, number>();
  const random = randomFactory(JSON.stringify(picks));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const state = new Map(teams.map((team) => [team.rosterId, { wins: team.wins, ties: team.ties, points: team.pointsFor }]));
    const profiles = new Map(teams.map((team) => [team.rosterId, team]));
    for (const game of games) {
      const a = state.get(game.aRosterId); const b = state.get(game.bRosterId);
      const ap = profiles.get(game.aRosterId); const bp = profiles.get(game.bRosterId);
      if (!a || !b || !ap || !bp) continue;
      let as = Math.max(0, ap.ppg + normal(random) * ap.scoreStdDev);
      let bs = Math.max(0, bp.ppg + normal(random) * bp.scoreStdDev);
      if (picks[game.id] === game.aRosterId && as <= bs) as = bs + 0.1;
      if (picks[game.id] === game.bRosterId && bs <= as) bs = as + 0.1;
      a.points += as; b.points += bs;
      if (as > bs) a.wins += 1; else if (bs > as) b.wins += 1; else { a.ties += 1; b.ties += 1; }
    }
    const ranked = [...teams].sort((left, right) => {
      const a = state.get(left.rosterId)!; const b = state.get(right.rosterId)!;
      return b.wins - a.wins || b.ties - a.ties || b.points - a.points;
    });
    ranked.forEach((team, index) => {
      if (index < playoffTeams) playoffCounts.set(team.rosterId, (playoffCounts.get(team.rosterId) || 0) + 1);
      seedTotals.set(team.rosterId, (seedTotals.get(team.rosterId) || 0) + index + 1);
    });
  }
  return teams.map((team) => ({ ...team, playoffPct: (playoffCounts.get(team.rosterId) || 0) / iterations * 100, averageSeed: (seedTotals.get(team.rosterId) || 0) / iterations })).sort((a, b) => b.playoffPct - a.playoffPct);
}

export default function PlayoffScenarioLab({ teams, games, playoffTeams, completedWeeks }: Props) {
  const [picks, setPicks] = useState<Record<string, number | null>>({});
  const weeks = useMemo(() => [...new Set(games.map((game) => game.week))].sort((a, b) => a - b), [games]);
  const [openWeeks, setOpenWeeks] = useState<Record<number, boolean>>(() => ({ [weeks[0] || 1]: true }));
  const results = useMemo(() => simulate(teams, games, picks, playoffTeams), [teams, games, picks, playoffTeams]);
  return <div className="space-y-5">
    <Card><CardHeader><CardTitle>Playoff Picture</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{results.map((team) => <div key={team.rosterId} className="rounded-xl border border-[var(--border)] p-3"><div className="flex justify-between gap-3"><div><div className="font-bold">{team.teamName}</div><div className="text-xs text-[var(--muted)]">{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ''} · {team.ppg.toFixed(1)} PPG</div></div><div className="text-right"><div className="text-lg font-black">{team.playoffPct.toFixed(0)}%</div><div className="text-[10px] text-[var(--muted)]">AVG SEED {team.averageSeed.toFixed(1)}</div></div></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20"><div className="h-full bg-[var(--accent)]" style={{ width: `${Math.max(1, team.playoffPct)}%` }} /></div></div>)}</div></CardContent></Card>
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Scenario Lab</CardTitle><p className="mt-1 text-xs text-[var(--muted)]">{completedWeeks} completed week{completedWeeks === 1 ? '' : 's'} included. Choose any remaining winners.</p></div><button type="button" onClick={() => setPicks({})} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold">Reset</button></div></CardHeader><CardContent><div className="space-y-3">{weeks.length ? weeks.map((week) => { const open = Boolean(openWeeks[week]); const weekGames = games.filter((game) => game.week === week); return <section key={week} className="overflow-hidden rounded-xl border border-[var(--border)]"><button type="button" className="flex w-full justify-between px-4 py-3 text-left font-black" aria-expanded={open} onClick={() => setOpenWeeks((current) => ({ ...current, [week]: !open }))}><span>Week {week}</span><span aria-hidden>{open ? '−' : '+'}</span></button>{open && <div className="grid gap-2 border-t border-[var(--border)] p-3 lg:grid-cols-2">{weekGames.map((game) => <div key={game.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><button type="button" onClick={() => setPicks((current) => ({ ...current, [game.id]: current[game.id] === game.aRosterId ? null : game.aRosterId }))} className="rounded-lg px-3 py-2 text-left text-xs font-bold" style={picks[game.id] === game.aRosterId ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-strong)' }}>{game.aTeam}</button><span className="text-[10px] text-[var(--muted)]">VS</span><button type="button" onClick={() => setPicks((current) => ({ ...current, [game.id]: current[game.id] === game.bRosterId ? null : game.bRosterId }))} className="rounded-lg px-3 py-2 text-right text-xs font-bold" style={picks[game.id] === game.bRosterId ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface-strong)' }}>{game.bTeam}</button></div>)}</div>}</section>; }) : <p className="text-sm text-[var(--muted)]">The regular season is complete.</p>}</div></CardContent></Card>
    <p className="text-xs text-[var(--muted)]">Odds use current records, points, scoring variance, remaining schedule, and {playoffTeams} configured playoff spots. They update as Sleeper results change.</p>
  </div>;
}
