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
 * Resolve the current canonical franchise name for each Sleeper owner in a league.
 *
 * Priority, lowest to highest:
 *  1. team identities saved during setup
 *  2. current names from the active Sleeper league
 *  3. explicit commissioner overrides in config.franchiseNamesByOwnerId
 *
 * Historical seasons can then display the current franchise identity even when the
 * same owner used a different team name in an earlier season.
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

  const sleeperNames = await fetchCurrentFranchiseNames(params.sleeperLeagueId);
  return { ...storedTeams, ...sleeperNames, ...explicitOverrides };
}
