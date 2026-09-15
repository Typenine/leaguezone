import { getLeagueById } from '@/lib/server/league-context';
import { getFantasyStandings } from '@/lib/server/fantasy-data';

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

  try {
    const standings = await getFantasyStandings(leagueId);
    return standings.teams
      .map((team) => ({ rosterId: team.rosterId, teamName: team.teamName, ownerName: team.ownerName }))
      .filter((team) => team.rosterId > 0 && team.teamName)
      .sort((a, b) => a.rosterId - b.rosterId);
  } catch {
    return [];
  }
}
