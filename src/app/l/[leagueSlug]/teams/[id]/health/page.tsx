import Link from 'next/link';
import { notFound } from 'next/navigation';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { buildPlayerAvailabilitySnapshot } from '@/lib/utils/player-availability';
import { getAllPlayersCached, getLeagueRosters, getNFLState, getRosterIdToTeamNameMap, getSleeperInjuriesCached, type SleeperInjury, type SleeperPlayer } from '@/lib/utils/sleeper-api';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type LoosePlayer = SleeperPlayer & { injury_status?: string | null; status?: string | null; bye_week?: number | string | null; practice_participation?: string | null };
type LooseInjury = SleeperInjury & { status?: string | null; practice_participation?: string | null };
type HealthRow = { playerId: string; name: string; position: string; nflTeam: string; status: string; practice: string; rosterState: string; byeWeek: number | null; availabilityPct: number; severity: number };

function severity(status: string, practice: string, reserve: boolean, availability: number) {
  const value = `${status} ${practice}`.toLowerCase();
  if (reserve || /\bout\b|injured reserve|\bir\b|pup|suspend|inactive/.test(value)) return 4;
  if (/doubtful/.test(value)) return 3;
  if (/questionable|dnp|did not practice/.test(value) || availability < 75) return 2;
  if (/limited/.test(value) || availability < 90) return 1;
  return 0;
}

function statusClass(level: number) {
  if (level >= 4) return 'border-red-500/40 bg-red-500/10 text-red-200';
  if (level >= 2) return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100';
  if (level === 1) return 'border-amber-400/30 bg-amber-400/5 text-amber-100';
  return 'border-emerald-500/25 bg-emerald-500/5 text-emerald-100';
}

function HealthTable({ rows, playerBasePath }: { rows: HealthRow[]; playerBasePath: string }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-[var(--border)] text-left text-[10px] font-black uppercase tracking-wider text-[var(--muted)]"><th className="px-3 py-2">Player</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Practice</th><th className="px-3 py-2">Availability</th><th className="px-3 py-2">Roster</th><th className="px-3 py-2">Bye</th></tr></thead><tbody>{rows.map((row) => <tr key={row.playerId} className="border-b border-[var(--border)]/70"><td className="px-3 py-3"><Link href={`${playerBasePath}/${row.playerId}`} className="font-bold hover:text-[var(--accent)]">{row.name}</Link><div className="text-[11px] text-[var(--muted)]">{row.position || '—'} · {row.nflTeam || 'FA'}</div></td><td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusClass(row.severity)}`}>{row.status}</span></td><td className="px-3 py-3 text-xs text-[var(--muted)]">{row.practice || 'No official report'}</td><td className="px-3 py-3 font-bold">{row.availabilityPct}%</td><td className="px-3 py-3 text-xs text-[var(--muted)]">{row.rosterState}</td><td className="px-3 py-3">{row.byeWeek ?? '—'}</td></tr>)}</tbody></table></div>;
}

export default async function TeamHealthPage({ params }: { params: Promise<{ leagueSlug: string; id: string }> }) {
  const { leagueSlug, id } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league?.sleeperLeagueId) notFound();
  const rosterId = Number(id);
  const [rosters, players, injuries, names, state] = await Promise.all([getLeagueRosters(league.sleeperLeagueId), getAllPlayersCached().catch(() => ({} as Record<string, SleeperPlayer>)), getSleeperInjuriesCached().catch(() => [] as SleeperInjury[]), getRosterIdToTeamNameMap(league.sleeperLeagueId), getNFLState().catch(() => ({ week: 1, season_type: 'regular' }))]);
  const roster = rosters.find((entry) => entry.roster_id === rosterId);
  if (!roster) notFound();
  const playerIds = [...new Set((roster.players || []).filter(Boolean))];
  const reserve = new Set(roster.reserve || []); const taxi = new Set(roster.taxi || []);
  const currentWeek = Math.max(1, Number((state as { week?: number }).week || 1));
  const availability = await buildPlayerAvailabilitySnapshot({ leagueId: league.sleeperLeagueId, uptoWeek: currentWeek, playerIds });
  const injuryMap = new Map((injuries as LooseInjury[]).map((injury) => [injury.player_id, injury]));
  const rows: HealthRow[] = playerIds.map((playerId) => {
    const player = players[playerId] as LoosePlayer | undefined; const injury = injuryMap.get(playerId); const entry = availability[playerId];
    const rawStatus = String(injury?.status || player?.injury_status || player?.status || '').trim();
    const status = !rawStatus || rawStatus.toLowerCase() === 'active' ? 'Healthy' : rawStatus;
    const practice = String(injury?.practice_participation || player?.practice_participation || '').trim();
    const availabilityPct = Math.round((entry?.weight ?? 0.92) * 100); const rawBye = Number(player?.bye_week); const reservePlayer = reserve.has(playerId);
    return { playerId, name: player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() || playerId : playerId, position: player?.position || '', nflTeam: player?.team || '', status, practice, rosterState: reservePlayer ? 'Reserve' : taxi.has(playerId) ? 'Taxi' : 'Active', byeWeek: Number.isFinite(rawBye) && rawBye > 0 ? rawBye : null, availabilityPct, severity: severity(status, practice, reservePlayer, availabilityPct) };
  }).sort((a, b) => b.severity - a.severity || a.position.localeCompare(b.position));
  const attention = rows.filter((row) => row.severity > 0); const clear = rows.filter((row) => row.severity === 0); const reports = rows.filter((row) => row.practice).length;
  return <main className="container mx-auto px-4 py-8"><SectionHeader title={`${names.get(rosterId) || `Roster ${rosterId}`} Health Center`} subtitle="Injuries, official practice participation, reserve status, and availability" actions={<Link href={`/l/${league.slug}/teams/${rosterId}`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold">Back to team</Link>} /><div className="mt-5 grid gap-3 sm:grid-cols-3"><Card><CardContent className="pt-5"><div className="text-2xl font-black">{attention.length}</div><div className="text-xs text-[var(--muted)]">Need attention</div></CardContent></Card><Card><CardContent className="pt-5"><div className="text-2xl font-black">{attention.filter((row) => row.severity >= 4).length}</div><div className="text-xs text-[var(--muted)]">Out or reserve</div></CardContent></Card><Card><CardContent className="pt-5"><div className="text-2xl font-black">{reports}</div><div className="text-xs text-[var(--muted)]">Official practice reports</div></CardContent></Card></div><div className="mt-5 space-y-5"><Card><CardHeader><CardTitle>Needs Attention</CardTitle></CardHeader><CardContent className="!p-0">{attention.length ? <HealthTable rows={attention} playerBasePath={`/l/${league.slug}/players`} /> : <p className="p-5 text-sm text-[var(--muted)]">No current health flags.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Clear or Healthy</CardTitle></CardHeader><CardContent className="!p-0"><HealthTable rows={clear} playerBasePath={`/l/${league.slug}/players`} /></CardContent></Card></div></main>;
}
