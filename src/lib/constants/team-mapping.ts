// Mapping canonical team names to Sleeper accounts.
//
// Traditional single-league deployments can keep static mappings below. LeagueZone
// setup-wizard deployments inject the selected league's current owner-to-franchise
// mapping at runtime so historical seasons retain one franchise identity after a
// team changes its display name.

const STATIC_CANONICAL_TEAM_BY_USER_ID: Record<string, string> = {
  // Add traditional deployment mappings here:
  // '000000000000000000': 'Team Name',
};

type RuntimeLeagueConfig = {
  franchiseNamesByOwnerId?: Record<string, string>;
};

function getRuntimeOwnerMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const runtimeWindow = window as typeof window & { __LEAGUE_CONFIG__?: RuntimeLeagueConfig };
  return runtimeWindow.__LEAGUE_CONFIG__?.franchiseNamesByOwnerId ?? {};
}

/**
 * A record-compatible view combining traditional static mappings with the active
 * LeagueZone league's current franchise names. The Proxy keeps existing direct
 * lookups and Object.entries() consumers working without hard-coding tenant data.
 */
export const CANONICAL_TEAM_BY_USER_ID: Record<string, string> = new Proxy(
  STATIC_CANONICAL_TEAM_BY_USER_ID,
  {
    get(target, property, receiver) {
      if (typeof property === 'string') {
        return getRuntimeOwnerMap()[property] ?? Reflect.get(target, property, receiver);
      }
      return Reflect.get(target, property, receiver);
    },
    ownKeys(target) {
      return Array.from(new Set([
        ...Reflect.ownKeys(target),
        ...Object.keys(getRuntimeOwnerMap()),
      ]));
    },
    getOwnPropertyDescriptor(target, property) {
      if (typeof property === 'string') {
        const runtimeValue = getRuntimeOwnerMap()[property];
        if (runtimeValue !== undefined) {
          return {
            configurable: true,
            enumerable: true,
            value: runtimeValue,
            writable: false,
          };
        }
      }
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  },
);

// Optional: map Sleeper-visible team/display names or usernames to canonical names.
// Useful for traditional deployments or exceptional aliases that are not tied to
// a stable Sleeper owner ID.
export const TEAM_ALIASES: Record<string, string> = {
  // 'old team display name': 'Current Team Name',
};

// Normalize a name for alias matching
export function normalizeName(s?: string | null): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
