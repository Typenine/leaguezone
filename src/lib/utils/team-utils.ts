/**
 * Utility functions for team-related operations
 * Includes functions for team logos, colors, and other team-specific operations
 */

import { TEAM_COLORS, TeamColors } from '../constants/team-colors';
import { TEAM_NAMES } from '../constants/league';
import { CANONICAL_TEAM_BY_USER_ID, TEAM_ALIASES, normalizeName } from '../constants/team-mapping';

/**
 * Shared position ranking for roster sorting
 * Order: QB > RB > WR > TE > K > DEF/DST > IDPs (DL/DE/DT/EDGE > LB > DB/CB/S)
 */
export const POSITION_RANK: Record<string, number> = {
  // Offense
  QB: 0,
  RB: 1,
  HB: 1,
  FB: 1,
  WR: 2,
  TE: 3,
  FLEX: 3,
  K: 4,
  PK: 4,
  // Team defense
  DEF: 5,
  DST: 5,
  // IDP front
  DL: 6,
  DE: 6,
  DT: 6,
  EDGE: 6,
  // IDP linebackers
  LB: 7,
  // IDP secondary
  DB: 8,
  CB: 8,
  S: 8,
  FS: 8,
  SS: 8,
};

/**
 * Converts a team name to a URL-friendly format for logo paths
 * @param teamName The team name to format
 * @returns Formatted team name for logo path
 */
export const formatTeamNameForLogo = (teamName: string): string => {
  return teamName
    .toLowerCase()
    .replace(/[''\.]/g, '')
    .replace(/\s+/g, '-');
};

/**
 * Gets the path to a team's logo.
 * Place team logo files in /public/assets/teams/logos/ named as the
 * URL-encoded result of formatTeamNameForLogo(teamName) + ".png".
 * Example: "My Team Name" → /assets/teams/logos/my-team-name.png
 * @param teamName The team name
 * @returns Path to the team's logo
 */
export const getTeamLogoPath = (teamName: string): string => {
  return `/assets/teams/logos/${encodeURIComponent(formatTeamNameForLogo(teamName))}.png`;
};

/**
 * Gets a team's colors
 * @param teamName The team name
 * @returns The team's colors object
 */
export const getTeamColors = (teamName: string): TeamColors => {
  return TEAM_COLORS[teamName] || {
    primary: '#3b5b8b',
    secondary: '#ba1010'
  };
};

/**
 * Generates a CSS style object for team-colored elements
 * @param teamName The team name
 * @param variant 'primary' | 'secondary' | 'tertiary' - which color to use as background
 * @returns CSS style object with background and text colors
 */
export const getTeamColorStyle = (
  teamName: string, 
  variant: 'primary' | 'secondary' | 'tertiary' = 'primary'
): React.CSSProperties => {
  const colors = getTeamColors(teamName);
  const bgColor = colors[variant] || colors.primary;
  
  // Calculate if text should be light or dark based on background color
  const isLight = (color: string): boolean => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance (perceived brightness)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  };
  
  return {
    backgroundColor: bgColor,
    color: isLight(bgColor) ? '#000000' : '#ffffff',
  };
};

/**
 * Canonical name resolution helpers
 */

// Precompute normalized canonical names for quick matching
const CANONICAL_BY_NORMALIZED = new Map<string, string>(
  TEAM_NAMES.map((n) => [normalizeName(n), n])
);

// Precompute normalized alias map
const ALIAS_BY_NORMALIZED = new Map<string, string>(
  Object.entries(TEAM_ALIASES).map(([alias, canon]) => [normalizeName(alias), canon])
);

/**
 * Runtime cache: ownerId → resolved team name.
 * Populated by getTeamsData() in sleeper-api.ts whenever a league's teams are
 * fetched with full user/roster data. This allows resolveCanonicalTeamName()
 * called with only an ownerId (e.g. in records/franchise pages) to still return
 * the correct name without requiring the caller to pass user data.
 */
const OWNER_NAME_CACHE = new Map<string, string>();

/**
 * Store a resolved owner→name mapping in the runtime cache.
 * Call this from getTeamsData() after building TeamData objects.
 */
export function cacheOwnerName(ownerId: string, name: string): void {
  if (ownerId && name && name !== 'Unknown Team') {
    OWNER_NAME_CACHE.set(ownerId, name);
  }
}

/**
 * Resolve a canonical team name using owner_id first, then aliases, then best-effort matches.
 */
export function resolveCanonicalTeamName(params: {
  ownerId?: string | null;
  rosterTeamName?: string | null;
  userDisplayName?: string | null;
  username?: string | null;
}): string {
  const { ownerId, rosterTeamName, userDisplayName, username } = params;

  // 1) Direct mapping by user_id (source of truth across seasons)
  if (ownerId && CANONICAL_TEAM_BY_USER_ID[ownerId]) {
    return CANONICAL_TEAM_BY_USER_ID[ownerId];
  }

  const tryMap = (name?: string | null): string | undefined => {
    if (!name) return undefined;
    const key = normalizeName(name);
    return ALIAS_BY_NORMALIZED.get(key) || CANONICAL_BY_NORMALIZED.get(key);
  };

  // 2) Roster/team display name on Sleeper
  const fromRosterName = tryMap(rosterTeamName);
  if (fromRosterName) return fromRosterName;

  // 3) User display name or username as alias
  const fromDisplay = tryMap(userDisplayName) || tryMap(username);
  if (fromDisplay) return fromDisplay;

  // 4) No canonical mapping found — fall back to raw Sleeper data so teams are
  //    never shown as "Unknown Team" on a fresh install. The canonical mapping in
  //    team-mapping.ts is only needed for cross-season consistency (e.g. if someone
  //    renames their team between seasons). Add mappings there when needed.
  const rawFallback = rosterTeamName || userDisplayName || username;
  if (rawFallback) return rawFallback;

  // 5) Runtime cache populated by getTeamsData() — covers ownerId-only call sites
  //    (records, franchise pages, streak calculations) after any league's teams
  //    have been fetched in the same request chain.
  if (ownerId && OWNER_NAME_CACHE.has(ownerId)) {
    return OWNER_NAME_CACHE.get(ownerId)!;
  }

  // 6) Absolute last resort — no data at all from Sleeper
  try {
    console.warn('[team-utils] No team name data found. Check that the league ID is correct.', {
      ownerId,
      rosterTeamName,
      userDisplayName,
      username,
    });
  } catch {}
  return 'Unknown Team';
}
