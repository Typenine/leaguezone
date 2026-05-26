// Mapping canonical team names to Sleeper accounts.
// IMPORTANT: Fill these in after connecting your Sleeper league.
// You can find user_id values in the Sleeper API response or from the
// console warning logs emitted by resolveCanonicalTeamName() when an
// owner is not recognized.
//
// Example entries:
//   '603801140211027968': 'Your Team Name',
//
// These mappings are the authoritative source of truth across all seasons.

export const CANONICAL_TEAM_BY_USER_ID: Record<string, string> = {
  // Add your league's Sleeper user_id → canonical team name mappings here:
  // '000000000000000000': 'Team Name',
};

// Optional: map Sleeper-visible team/display names or usernames to canonical names.
// Useful for resolving names without a user_id (e.g. from old season data).
//
// Example entries:
//   'sleeper_username': 'Team Name',
//   'old team display name': 'Team Name',

export const TEAM_ALIASES: Record<string, string> = {
  // Add aliases here as you discover unresolved names in production:
  // 'username_or_old_name': 'Canonical Team Name',
};

// Normalize a name for alias matching
export function normalizeName(s?: string | null): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
