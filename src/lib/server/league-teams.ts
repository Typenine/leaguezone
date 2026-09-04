import { getLeagueById } from '@/lib/server/league-context';
import { getLeagueUsers, getTeamsData } from '@/lib/utils/sleeper-api';

export type LeagueTeamOption = {
  rosterId: number;
  teamName: string;
  ownerName: string | null;
};

export async function getLeagueTeamOptions(leagueId: string): Promise<LeagueTeamOption[]> {
  const league = await getLeagueById(leagueId);
  if (!league) return [];

  const configured = Array.isArray(league.config?.teams)
    ? (league.config.teams as Array<Record<string, unknown>>)
    : [];
  const fromConfig = configured
    .map((team) => ({
      rosterId: Number(team.rosterId ?? team.roster_id ?? 0),
      teamName: String(team.teamName ?? team.team_name ?? '').trim(),
      ownerName: team.ownerName || team.owner_name ? String(team.ownerName ?? team.owner_name) : null,
    }))
    .filter((team) => team.rosterId > 0 && team.teamName);
  if (fromConfig.length > 0) return fromConfig.sort((a, b) => a.rosterId - b.rosterId);

  if (!league.sleeperLeagueId) return [];
  try {
    const [teams, users] = await Promise.all([
      getTeamsData(league.sleeperLeagueId),
      getLeagueUsers(league.sleeperLeagueId).catch(() => []),
    ]);
    const ownerNames = new Map(
      users.map((user) => [user.user_id, user.display_name || user.username || null] as const),
    );
    return teams
      .map((team) => ({
        rosterId: Number(team.rosterId),
        teamName: String(team.teamName || '').trim(),
        ownerName: ownerNames.get(team.ownerId) ?? null,
      }))
      .filter((team) => team.rosterId > 0 && team.teamName)
      .sort((a, b) => a.rosterId - b.rosterId);
  } catch {
    return [];
  }
}
