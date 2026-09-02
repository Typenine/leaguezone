import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { getLeague as getSleeperLeague, getLeagueMatchups, getRosterIdToTeamNameMap, type SleeperMatchup } from '@/lib/utils/sleeper-api';

export const dynamic = 'force-dynamic';

function pairWeek(rows: SleeperMatchup[], names: Map<number, string>) {
  const grouped = new Map<number, SleeperMatchup[]>();
  for (const row of rows) {
    if (!row.matchup_id) continue;
    grouped.set(row.matchup_id, [...(grouped.get(row.matchup_id) || []), row]);
  }
  return [...grouped.entries()].sort(([a], [b]) => a - b).flatMap(([id, teams]) => teams.length >= 2 ? [{ id, teams: teams.slice(0, 2).map((team) => ({ rosterId: team.roster_id, name: names.get(team.roster_id) || `Roster ${team.roster_id}`, points: Number(team.points || 0) })) }] : []);
}

export default async function LeagueSchedulePage({ params, searchParams }: { params: Promise<{ leagueSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ leagueSlug }, query] = await Promise.all([params, searchParams]);
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  const leagueId = league.sleeperLeagueId;
  const sleeperLeague = leagueId ? await getSleeperLeague(leagueId).catch(() => null) : null;
  const sleeperSettings = (sleeperLeague?.settings || {}) as { playoff_week_start?: number; playoff_start_week?: number };
  const playoffStartWeek = Number(sleeperSettings.playoff_week_start ?? sleeperSettings.playoff_start_week ?? 15);
  const configuredWeeks = Number((league.config.season as Record<string, unknown> | undefined)?.totalSeasonWeeks || league.config.totalSeasonWeeks || Math.max(17, playoffStartWeek + 2));
  const weekCount = Number.isFinite(configuredWeeks) ? Math.max(1, Math.min(18, configuredWeeks)) : 17;
  const selected = typeof query.week === 'string' ? Number(query.week) : 0;
  const weeks = selected >= 1 && selected <= weekCount ? [selected] : Array.from({ length: weekCount }, (_, index) => index + 1);

  if (!leagueId) return <main className="container mx-auto px-4 py-8"><h1 className="text-3xl font-black">Season Schedule</h1><p className="mt-6 text-[var(--muted)]">Connect this league to Sleeper to load its schedule.</p></main>;
  const names = await getRosterIdToTeamNameMap(leagueId);
  const results = await Promise.all(weeks.map(async (week) => ({ week, rows: await getLeagueMatchups(leagueId, week).catch(() => []) })));

  return (
    <main className="container mx-auto px-4 py-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">{league.name}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black">Season Schedule</h1><p className="mt-1 text-sm text-[var(--muted)]">Regular season and postseason matchups in one view.</p></div>{selected ? <Link href={`/l/${league.slug}/matchups`} className="text-sm font-bold text-[var(--accent)] hover:underline">View full schedule</Link> : null}</div>
      <nav aria-label="Schedule week" className="mt-6 flex flex-wrap gap-2">{Array.from({ length: weekCount }, (_, index) => index + 1).map((week) => <Link key={week} href={`/l/${league.slug}/matchups?week=${week}`} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${selected === week ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'}`}>W{week}</Link>)}</nav>
      <div className="mt-8 space-y-8">{results.map(({ week, rows }) => { const pairs = pairWeek(rows, names); return <section key={week}><h2 className="mb-3 text-xl font-black">Week {week}</h2>{pairs.length ? <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{pairs.map((pair) => <Link href={`/l/${league.slug}/matchups/${week}/${pair.id}`} key={pair.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]"><div className="space-y-3">{pair.teams.map((team) => <div key={team.rosterId} className="flex items-center justify-between gap-3"><span className="truncate font-bold">{team.name}</span><span className="font-black tabular-nums">{team.points ? team.points.toFixed(2) : '—'}</span></div>)}</div><span className="mt-3 block text-xs font-bold text-[var(--accent)]">View projections and details</span></Link>)}</div> : <p className="rounded-xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">Schedule not populated.</p>}</section>; })}</div>
    </main>
  );
}
