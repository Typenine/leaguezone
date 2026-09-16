import Link from 'next/link';
import Card, { CardContent } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import WeeklyLeaders from '@/components/home/WeeklyLeaders';
import AroundTheLeague from '@/components/home/AroundTheLeague';
import RecentTransactions from '@/components/home/RecentTransactions';
import LeagueHistorySpotlight from '@/components/home/LeagueHistorySpotlight';
import type { League } from '@/lib/server/league-context';
import { getFantasyCurrentWeek, getFantasyMatchups, getFantasyRosters, getFantasyStandings } from '@/lib/server/fantasy-data';
import { getFantasyLeagueSettings } from '@/lib/server/provider-settings';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';
import { buildProviderLeagueProjectionSnapshots } from '@/lib/fantasy/provider-projections';

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProviderSeasonHome({
  league,
  teamName,
  rosterId,
  searchParams,
}: {
  league: League;
  teamName?: string | null;
  rosterId?: number | null;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const mapped = await resolveLeagueProviderSeason(league.id);
  if (!mapped) return <div className="container mx-auto px-4 py-8"><SectionHeader title={league.name} /><p className="text-[var(--muted)]">No fantasy provider season is configured for this league.</p></div>;
  const [settings, currentWeek] = await Promise.all([
    getFantasyLeagueSettings(league.id, mapped.season).catch(() => null),
    getFantasyCurrentWeek(),
  ]);
  const maxWeeks = Math.max(1, Math.min(18, settings?.regularSeasonWeeks || 14));
  const requestedWeek = Number(queryValue(params.week));
  const selectedWeek = Number.isFinite(requestedWeek) && requestedWeek >= 1 && requestedWeek <= maxWeeks
    ? requestedWeek
    : Math.min(maxWeeks, Math.max(1, currentWeek));

  const [standingsData, rosters, matchups, projections] = await Promise.all([
    getFantasyStandings(league.id, mapped.season).catch(() => null),
    getFantasyRosters(league.id, mapped.season).catch(() => null),
    getFantasyMatchups(league.id, selectedWeek, mapped.season).catch(() => []),
    buildProviderLeagueProjectionSnapshots({ leagueId: league.id, season: String(mapped.season), week: selectedWeek, saveSnapshots: false }).catch(() => []),
  ]);

  const standings = [...(standingsData?.teams || [])].sort((a, b) => b.wins - a.wins || b.fpts - a.fpts);
  const projectionByTeam = new Map(projections.map((entry) => [entry.teamName, entry] as const));
  const homeMatchups = matchups.flatMap((matchup) => {
    if (matchup.teams.length < 2) return [];
    const [away, home] = matchup.teams;
    return [{ homeTeam: home.teamName, awayTeam: away.teamName, homeScore: home.points, awayScore: away.points }];
  });
  const standingsTeam = rosterId != null
    ? standings.find((team) => team.rosterId === rosterId) || null
    : teamName ? standings.find((team) => team.teamName === teamName) || null : null;
  const rosterTeam = rosterId != null
    ? rosters?.teams.find((team) => team.rosterId === rosterId) || null
    : teamName ? rosters?.teams.find((team) => team.teamName === teamName) || null : null;
  const myTeam = standingsTeam
    ? { ...standingsTeam, players: rosterTeam?.players || standingsTeam.players }
    : rosterTeam;
  const myProjection = myTeam ? projectionByTeam.get(myTeam.teamName) || null : null;
  const playoffSpots = Math.max(1, settings?.playoffTeams || Math.ceil(Math.max(standings.length, 2) / 2));
  const providerLabel = mapped.provider === 'yahoo' ? 'Yahoo Fantasy' : 'Sleeper';

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">{mapped.season} · {providerLabel}</div><h1 className="mt-1 text-3xl font-black tracking-tight">Week {selectedWeek}</h1><p className="mt-1 text-sm text-[var(--muted)]">{matchups.length} league matchups</p></div>
          <div className="flex flex-wrap gap-2">{Array.from({ length: maxWeeks }, (_, index) => index + 1).map((week) => <Link key={week} href={`/l/${league.slug}?week=${week}`} className={`rounded-md border px-2.5 py-1.5 text-xs font-bold ${week === selectedWeek ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent,#fff)]' : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'}`}>{week}</Link>)}</div>
        </div>
      </section>

      {myTeam && (
        <section className="mb-10">
          <SectionHeader title="My Team" />
          <Card><CardContent className="p-5"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><Link href={`/l/${league.slug}/teams/${myTeam.rosterId}`} className="text-2xl font-black hover:text-[var(--accent)]">{myTeam.teamName}</Link><p className="mt-1 text-sm text-[var(--muted)]">{myTeam.wins}-{myTeam.losses}{myTeam.ties ? `-${myTeam.ties}` : ''} · {myTeam.fpts.toFixed(2)} PF · {myTeam.players.length} rostered</p>{myProjection && <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-[var(--surface-strong)] px-2.5 py-1.5"><strong>{myProjection.optimalTotal?.toFixed(1) ?? '—'}</strong> projected optimal</span>{myProjection.currentTotal != null && <span className="rounded-md bg-[var(--surface-strong)] px-2.5 py-1.5"><strong>{myProjection.currentTotal.toFixed(1)}</strong> submitted lineup</span>}{myProjection.potentialGain != null && myProjection.potentialGain > 0 && <span className="rounded-md bg-[var(--accent)]/10 px-2.5 py-1.5 text-[var(--accent)]"><strong>+{myProjection.potentialGain.toFixed(1)}</strong> lineup upside</span>}</div>}</div><div className="flex flex-wrap gap-2"><Link href={`/l/${league.slug}/teams/${myTeam.rosterId}/health`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold">Health Center</Link><Link href={`/l/${league.slug}/trade-block`} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-bold text-[var(--on-accent,#fff)]">Trade Block</Link></div></div></CardContent></Card>
        </section>
      )}

      <section className="mb-10 sm:mb-12">
        <SectionHeader title="Matchups" subtitle={`Week ${selectedWeek}`} actions={<Link href={`/l/${league.slug}/matchups?week=${selectedWeek}&year=${mapped.season}`} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">Full schedule →</Link>} />
        {matchups.length === 0 ? <Card><CardContent className="p-6 text-sm text-[var(--muted)]">No matchups were returned for this week.</CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{matchups.map((matchup) => {
          const sides = matchup.teams.slice(0, 2);
          return <Link key={matchup.matchupId} href={`/l/${league.slug}/matchups/${selectedWeek}/${matchup.matchupId}?year=${mapped.season}`} className="block"><Card className="h-full transition hover:border-[var(--accent)]"><CardContent className="p-5"><div className="space-y-4">{sides.map((side) => { const projection = projectionByTeam.get(side.teamName); return <div key={side.providerTeamId} className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate font-black">{side.teamName}</div>{projection?.optimalTotal != null && <div className="text-xs text-[var(--muted)]">Projected {projection.optimalTotal.toFixed(1)}</div>}</div><div className="text-2xl font-black tabular-nums">{side.points.toFixed(2)}</div></div>; })}</div></CardContent></Card></Link>;
        })}</div>}
      </section>

      {standings.length > 0 && (
        <section className="mb-10 sm:mb-12">
          <SectionHeader title="Standings" subtitle={`${playoffSpots} playoff spots`} actions={<div className="flex gap-3"><Link href={`/l/${league.slug}/standings/playoff-lab`} className="text-sm font-bold text-[var(--accent)]">Playoff Lab</Link><Link href={`/l/${league.slug}/standings`} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">Full standings →</Link></div>} />
          <Card className="overflow-x-auto"><CardContent className="p-0"><table className="min-w-full text-sm"><thead><tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--muted)]"><th className="px-4 py-3">Seed</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Record</th><th className="px-4 py-3 text-right">PF</th><th className="px-4 py-3 text-right">PA</th></tr></thead><tbody>{standings.map((team, index) => <tr key={team.rosterId} className={`border-b border-[var(--border)]/70 ${index + 1 <= playoffSpots ? 'bg-[var(--accent)]/[0.035]' : ''}`}><td className="px-4 py-3 font-black">{index + 1}</td><td className="px-4 py-3"><Link href={`/l/${league.slug}/teams/${team.rosterId}`} className="font-bold hover:text-[var(--accent)]">{team.teamName}</Link></td><td className="px-4 py-3">{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ''}</td><td className="px-4 py-3 text-right tabular-nums">{team.fpts.toFixed(2)}</td><td className="px-4 py-3 text-right tabular-nums">{team.fptsAgainst.toFixed(2)}</td></tr>)}</tbody></table></CardContent></Card>
        </section>
      )}

      <WeeklyLeaders week={selectedWeek} matchups={homeMatchups} />
      <AroundTheLeague myTeam={teamName ?? null} leagueSlug={league.slug} />
      <RecentTransactions leagueSlug={league.slug} season={String(mapped.season)} />
      <LeagueHistorySpotlight league={league} />
    </div>
  );
}
