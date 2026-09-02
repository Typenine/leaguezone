import { cookies } from 'next/headers';
import { isAdminCookieValue } from '@/lib/auth/admin';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { getCurrentLeague } from '@/lib/server/league-context';
import { getTeamsData } from '@/lib/utils/sleeper-api';

export interface HallOfFameActor {
  isAdmin: boolean;
  teamName: string | null;
  franchiseId: string | null;
  sessionValid: boolean;
}

export async function getHallOfFameActor(): Promise<HallOfFameActor> {
  const jar = await cookies();
  const legacyAdmin = isAdminCookieValue(jar.get('evw_admin')?.value);
  const league = await getCurrentLeague();
  const result = await getActiveLeagueMembership(league?.id);
  if (!result.ok) return { isAdmin: legacyAdmin, teamName: null, franchiseId: null, sessionValid: false };
  const { teamName, isCommissioner } = result.membership;
  const teams = league?.sleeperLeagueId ? await getTeamsData(league.sleeperLeagueId).catch(() => []) : [];
  const franchiseId = teams.find((team) => team.teamName.toLowerCase() === teamName.toLowerCase())?.ownerId ?? null;

  return {
    isAdmin: legacyAdmin || isCommissioner,
    teamName,
    franchiseId,
    sessionValid: true,
  };
}

export function canManageFranchise(actor: HallOfFameActor, franchiseId: string): boolean {
  if (actor.isAdmin) return true;
  return actor.sessionValid && actor.franchiseId === franchiseId;
}
