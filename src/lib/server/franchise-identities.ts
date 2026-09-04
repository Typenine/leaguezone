import { getFranchiseBrandHistory, resolveLeagueSeasonForSleeperId } from '@/lib/server/franchise-branding';

export type FranchiseNamesByOwnerId = Record<string, string>;

type StoredTeamIdentity = {
  ownerId?: unknown;
  teamName?: unknown;
};

type SleeperRosterIdentity = {
  owner_id?: string | null;
  metadata?: { team_name?: string | null } | null;
};

type SleeperUserIdentity = {
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  metadata?: { team_name?: string | null } | null;
};

function cleanIdentityMap(value: unknown): FranchiseNamesByOwnerId {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const result: FranchiseNamesByOwnerId = {};
  for (const [ownerId, teamName] of Object.entries(value as Record<string, unknown>)) {
    if (!ownerId.trim()) continue;
    if (typeof teamName !== 'string' || !teamName.trim()) continue;
    result[ownerId.trim()] = teamName.trim();
  }
  return result;
}

function identitiesFromStoredTeams(value: unknown): FranchiseNamesByOwnerId {
  if (!Array.isArray(value)) return {};

  const result: FranchiseNamesByOwnerId = {};
  for (const item of value as StoredTeamIdentity[]) {
    const ownerId = typeof item?.ownerId === 'string' ? item.ownerId.trim() : '';
    const teamName = typeof item?.teamName === 'string' ? item.teamName.trim() : '';
    if (ownerId && teamName) result[ownerId] = teamName;
  }
  return result;
}

async function fetchCurrentFranchiseNames(sleeperLeagueId: string): Promise<FranchiseNamesByOwnerId> {
  const base = 'https://api.sleeper.app/v1';
  const requestOptions = {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(8000),
  } as const;

  try {
    const [rostersResponse, usersResponse] = await Promise.all([
      fetch(`${base}/league/${encodeURIComponent(sleeperLeagueId)}/rosters`, requestOptions),
      fetch(`${base}/league/${encodeURIComponent(sleeperLeagueId)}/users`, requestOptions),
    ]);

    if (!rostersResponse.ok) return {};

    const rosters = await rostersResponse.json() as SleeperRosterIdentity[];
    const users = usersResponse.ok
      ? await usersResponse.json() as SleeperUserIdentity[]
      : [];
    const usersById = new Map(
      users
        .filter((user) => Boolean(user.user_id))
        .map((user) => [String(user.user_id), user]),
    );

    const result: FranchiseNamesByOwnerId = {};
    for (const roster of rosters) {
      const ownerId = typeof roster.owner_id === 'string' ? roster.owner_id.trim() : '';
      if (!ownerId) continue;

      const user = usersById.get(ownerId);
      const teamName = (
        user?.metadata?.team_name
        || roster.metadata?.team_name
        || user?.display_name
        || user?.username
        || ''
      ).trim();
      if (teamName) result[ownerId] = teamName;
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Resolve canonical franchise names for a Sleeper league season.
 * Historical Sleeper league IDs use the normalized season snapshot when available,
 * so a later rename does not rewrite old standings, drafts, records, or matchup pages.
 * Current-season identity still follows live Sleeper data plus commissioner overrides.
 */
export async function getFranchiseNamesByOwnerId(params: {
  sleeperLeagueId: string | null | undefined;
  config?: Record<string, unknown> | null;
}): Promise<FranchiseNamesByOwnerId> {
  const config = params.config ?? {};
  const storedTeams = identitiesFromStoredTeams(config.teams);
  const explicitOverrides = cleanIdentityMap(config.franchiseNamesByOwnerId);

  if (!params.sleeperLeagueId) {
    return { ...storedTeams, ...explicitOverrides };
  }

  const resolved = await resolveLeagueSeasonForSleeperId(params.sleeperLeagueId);
  if (resolved && !resolved.isCurrent) {
    const snapshots = await getFranchiseBrandHistory({ leagueId: resolved.leagueId, season: resolved.season });
    const historical: FranchiseNamesByOwnerId = {};
    for (const snapshot of snapshots) {
      if (snapshot.sleeperOwnerId && snapshot.teamName) {
        historical[snapshot.sleeperOwnerId] = snapshot.teamName;
      }
    }
    if (Object.keys(historical).length > 0) return historical;
  }

  const sleeperNames = await fetchCurrentFranchiseNames(params.sleeperLeagueId);
  return { ...storedTeams, ...sleeperNames, ...explicitOverrides };
}
