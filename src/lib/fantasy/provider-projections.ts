import type { FantasyPlayer } from '@/lib/providers/types';
import { getFantasyCurrentWeek, getFantasyRosters } from '@/lib/server/fantasy-data';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';
import { getFantasyLeagueSettings } from '@/lib/server/provider-settings';
import { mapFantasyPlayersToSleeper } from '@/lib/server/provider-player-map';
import { projectWeeklyPlayersV3, PROJECTION_MODEL_VERSION } from '@/lib/fantasy/weekly-projections-next';
import { buildLeagueProjectionSnapshotsV3, buildTeamLineupOptimizerV3 } from '@/lib/fantasy/weekly-projections-next';
import type { LineupOptimizerResponse, WeeklyLineupEntry, WeeklyProjectedPlayer } from '@/lib/fantasy/lineup-types';

function normalizedPosition(value: string | null | undefined): string {
  const position = String(value || '').toUpperCase();
  if (position === 'D' || position === 'DST' || position === 'D/ST') return 'DEF';
  if (position === 'HB' || position === 'FB') return 'RB';
  if (position === 'PK') return 'K';
  return position;
}

function slotAccepts(slot: string, position: string): boolean {
  const normalizedSlot = slot.toUpperCase();
  const normalizedPlayer = normalizedPosition(position);
  if (normalizedSlot === normalizedPlayer) return true;
  if (normalizedSlot === 'FLEX') return ['RB', 'WR', 'TE'].includes(normalizedPlayer);
  if (normalizedSlot === 'SUPER_FLEX') return ['QB', 'RB', 'WR', 'TE'].includes(normalizedPlayer);
  if (normalizedSlot === 'REC_FLEX') return ['WR', 'TE'].includes(normalizedPlayer);
  return false;
}

function slotSpecificity(slot: string): number {
  if (slot === 'SUPER_FLEX') return 4;
  if (slot === 'FLEX') return 3;
  if (slot === 'REC_FLEX') return 2;
  return 1;
}

function assignOptimal(players: WeeklyProjectedPlayer[], slots: string[]): Array<{ slot: string; player: WeeklyProjectedPlayer | null }> {
  const orderedSlots = slots.map((slot, index) => ({ slot, index })).sort((a, b) => slotSpecificity(a.slot) - slotSpecificity(b.slot) || a.index - b.index);
  const unused = new Map(players.map((player) => [player.id, player] as const));
  const assigned = new Map<number, WeeklyProjectedPlayer | null>();
  for (const entry of orderedSlots) {
    const eligible = [...unused.values()]
      .filter((player) => slotAccepts(entry.slot, player.position))
      .sort((a, b) => b.projection - a.projection);
    const chosen = eligible[0] || null;
    assigned.set(entry.index, chosen);
    if (chosen) unused.delete(chosen.id);
  }
  return slots.map((slot, index) => ({ slot, player: assigned.get(index) || null }));
}

function confidence(players: WeeklyProjectedPlayer[]): 'low' | 'medium' | 'high' {
  if (!players.length) return 'low';
  const high = players.filter((player) => player.confidence === 'high').length;
  const low = players.filter((player) => player.confidence === 'low').length;
  if (high >= Math.ceil(players.length * 0.65)) return 'high';
  if (low >= Math.ceil(players.length * 0.5)) return 'low';
  return 'medium';
}

function lineupEntries(rows: Array<{ slot: string; player: WeeklyProjectedPlayer | null }>, comparison: Set<string>): WeeklyLineupEntry[] {
  return rows.map((row, slotIndex) => ({
    slot: row.slot,
    slotIndex,
    player: row.player,
    changed: Boolean(row.player && !comparison.has(row.player.id)),
  }));
}

async function yahooLeagueProjections(args: {
  leagueId: string;
  season: string;
  week: number;
  teamNames?: string[];
}): Promise<LineupOptimizerResponse[]> {
  const [rosters, settings] = await Promise.all([
    getFantasyRosters(args.leagueId, args.season),
    getFantasyLeagueSettings(args.leagueId, args.season),
  ]);
  if (!Object.keys(settings.scoringSettings).length) {
    throw new Error('Yahoo scoring settings are not available for projections.');
  }
  const selectedTeams = rosters.teams.filter((team) => !args.teamNames || args.teamNames.includes(team.teamName));
  const providerPlayers = selectedTeams.flatMap((team) => team.players.map((id) => rosters.players[id]).filter((player): player is FantasyPlayer => Boolean(player)));
  const mapping = await mapFantasyPlayersToSleeper(providerPlayers);
  const sleeperIds = [...new Set(Object.values(mapping.providerToSleeper))];
  if (!sleeperIds.length) throw new Error('Yahoo roster players could not be matched to the LeagueZone NFL player catalog.');
  const projection = await projectWeeklyPlayersV3({
    season: args.season,
    week: args.week,
    playerIds: sleeperIds,
    scoringSettings: settings.scoringSettings,
    saveOverrides: false,
  });
  const bySleeperId = new Map(projection.players.map((player) => [player.id, player] as const));

  return selectedTeams.map((team) => {
    const fantasyPlayers = team.players.map((id) => rosters.players[id]).filter((player): player is FantasyPlayer => Boolean(player));
    const projected = fantasyPlayers.flatMap((providerPlayer) => {
      const sleeperId = mapping.providerToSleeper[providerPlayer.playerId];
      const source = sleeperId ? bySleeperId.get(sleeperId) : undefined;
      return source ? [{ ...source, id: providerPlayer.playerId, name: providerPlayer.fullName, position: normalizedPosition(providerPlayer.position) || source.position, nflTeam: providerPlayer.nflTeam || source.nflTeam }] : [];
    });
    const byProviderId = new Map(projected.map((player) => [player.id, player] as const));
    const currentRows = fantasyPlayers
      .filter((player) => player.isStarter)
      .map((player) => ({ slot: player.selectedPosition || normalizedPosition(player.position) || 'START', player: byProviderId.get(player.playerId) || null }));
    const currentIds = new Set(currentRows.flatMap((row) => row.player ? [row.player.id] : []));
    const optimalRows = assignOptimal(projected, settings.starterSlots);
    const optimalIds = new Set(optimalRows.flatMap((row) => row.player ? [row.player.id] : []));
    const currentTotal = currentRows.reduce((sum, row) => sum + (row.player?.projection || 0), 0);
    const optimalTotal = optimalRows.reduce((sum, row) => sum + (row.player?.projection || 0), 0);
    const available = currentRows.some((row) => row.player) && optimalRows.some((row) => row.player);
    const lineupConfidence = confidence(optimalRows.flatMap((row) => row.player ? [row.player] : []));
    return {
      generatedAt: new Date().toISOString(),
      teamName: team.teamName,
      season: args.season,
      week: args.week,
      available,
      reason: available ? null : 'Yahoo has not returned a usable current lineup for this team yet.',
      currentTotal: available ? Number(currentTotal.toFixed(1)) : null,
      optimalTotal: optimalRows.some((row) => row.player) ? Number(optimalTotal.toFixed(1)) : null,
      potentialGain: available ? Number(Math.max(0, optimalTotal - currentTotal).toFixed(1)) : null,
      currentLineup: lineupEntries(currentRows, optimalIds),
      optimalLineup: lineupEntries(optimalRows, currentIds),
      projectedPlayers: projected,
      modelVersion: `${PROJECTION_MODEL_VERSION}-provider-neutral`,
      projectionPhase: projection.preseason ? 'preseason' : 'in_season',
      confidence: lineupConfidence,
      confidenceNote: 'LeagueZone projection using NFL workload, role, schedule, injury, and market context with Yahoo league scoring settings.',
      teamOpportunityPlans: Object.fromEntries(Object.entries(projection.plans).map(([teamCode, plan]) => [teamCode, {
        passAttempts: Number(plan.passAttempts.toFixed(1)),
        rushAttempts: Number(plan.rushAttempts.toFixed(1)),
        targetPool: Number(plan.targetPool.toFixed(1)),
        source: plan.source,
      }])),
    };
  });
}

export async function buildProviderLeagueProjectionSnapshots(args: {
  leagueId: string;
  season?: string;
  week?: number;
  teamNames?: string[];
  saveSnapshots?: boolean;
}): Promise<LineupOptimizerResponse[]> {
  const mapped = await resolveLeagueProviderSeason(args.leagueId, args.season);
  if (!mapped) return [];
  if (mapped.provider === 'sleeper') {
    return buildLeagueProjectionSnapshotsV3({
      season: String(mapped.season),
      week: args.week,
      saveSnapshots: args.saveSnapshots ?? false,
      dbLeagueId: args.leagueId,
    });
  }
  const week = args.week ?? await getFantasyCurrentWeek();
  return yahooLeagueProjections({ leagueId: args.leagueId, season: String(mapped.season), week, teamNames: args.teamNames });
}

export async function buildProviderTeamLineupOptimizer(
  leagueId: string,
  teamName: string,
): Promise<LineupOptimizerResponse> {
  const mapped = await resolveLeagueProviderSeason(leagueId);
  if (!mapped) throw new Error('No fantasy provider is configured for this league.');
  if (mapped.provider === 'sleeper') return buildTeamLineupOptimizerV3(teamName, leagueId);
  const rows = await buildProviderLeagueProjectionSnapshots({ leagueId, season: String(mapped.season), teamNames: [teamName] });
  const row = rows[0];
  if (!row) throw new Error('Team roster not found');
  return row;
}
