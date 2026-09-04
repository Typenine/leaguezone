/**
 * Utility functions for team-related operations
 * Includes functions for team logos, colors, and other team-specific operations
 */

import { TEAM_COLORS, TeamColors } from '../constants/team-colors';
import { TEAM_NAMES } from '../constants/league';
import { CANONICAL_TEAM_BY_USER_ID, TEAM_ALIASES, normalizeName } from '../constants/team-mapping';
import { contrastRatio, getReadableTextColor } from '../branding/colors';

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
 * Converts a team name to the stable slug used by locally hosted team logos and
 * runtime CSS branding variables.
 */
export const formatTeamNameForLogo = (teamName: string): string => {
  return teamName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035`']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const getTeamBrandCssKey = (teamName: string): string => {
  return formatTeamNameForLogo(teamName) || 'unknown-team';
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

const DEFAULT_TEAM_COLORS: TeamColors = {
  primary: '#3b5b8b',
  secondary: '#ba1010',
};

const getStaticTeamColors = (teamName: string): TeamColors => TEAM_COLORS[teamName] || DEFAULT_TEAM_COLORS;

function teamColorVar(teamName: string, slot: 'primary' | 'secondary' | 'tertiary' | 'quaternary', fallback: string): string {
  return `var(--team-brand-${getTeamBrandCssKey(teamName)}-${slot}, ${fallback})`;
}

/**
 * Gets a team's colors. The returned values are CSS variables with stable
 * fallbacks so legacy callers automatically pick up database-backed branding
 * when TeamLogoProvider hydrates the active league palette.
 */
export const getTeamColors = (teamName: string): TeamColors => {
  const fallback = getStaticTeamColors(teamName);
  return {
    primary: teamColorVar(teamName, 'primary', fallback.primary),
    secondary: teamColorVar(teamName, 'secondary', fallback.secondary),
    tertiary: teamColorVar(teamName, 'tertiary', fallback.tertiary || fallback.primary),
    quaternary: teamColorVar(teamName, 'quaternary', fallback.quaternary || fallback.secondary),
  };
};

/**
 * Generates a CSS style object for team-colored elements.
 * Foreground colors use a companion runtime variable calculated with WCAG
 * contrast rules rather than assuming white text.
 */
export const getTeamColorStyle = (
  teamName: string,
  variant: 'primary' | 'secondary' | 'tertiary' = 'primary'
): React.CSSProperties => {
  const colors = getTeamColors(teamName);
  const fallback = getStaticTeamColors(teamName);
  const bgColor = colors[variant] || colors.primary;
  const fallbackBg = fallback[variant] || fallback.primary;
  const textVar = `--team-brand-${getTeamBrandCssKey(teamName)}-${variant}-text`;

  return {
    backgroundColor: bgColor,
    color: `var(${textVar}, ${getReadableTextColor(fallbackBg)})`,
  };
};

/** Choose the best black/white text for a solid color or gradient palette. */
export const getReadableTextForColors = (colors: string[]): string => {
  const runtimeKey = colors
    .map((color) => color.match(/^var\(--team-brand-([a-z0-9-]+)-(?:primary|secondary|tertiary|quaternary),/i)?.[1])
    .find(Boolean);
  if (runtimeKey) {
    return `var(--team-brand-${runtimeKey}-gradient-text, #ffffff)`;
  }

  const valid = colors.filter((color) => /^#[0-9a-fA-F]{6}$/.test(color));
  if (!valid.length) return '#ffffff';
  if (valid.length === 1) return getReadableTextColor(valid[0]);

  const light = '#ffffff';
  const dark = '#000000';
  const lightScore = Math.min(...valid.map((color) => contrastRatio(color, light)));
  const darkScore = Math.min(...valid.map((color) => contrastRatio(color, dark)));
  return darkScore >= lightScore ? dark : light;
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
  // First-write-wins: seasons are loaded most-recent-first, so the first cached
  // name for an owner is their current team name. Don't overwrite it with an
  // older season's name — that ensures franchise stats stay consistent even when
  // teams have renamed between seasons.
  if (ownerId && name && name !== 'Unknown Team' && !OWNER_NAME_CACHE.has(ownerId)) {
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
