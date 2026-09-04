/**
 * Static team-color fallbacks.
 *
 * LeagueZone stores user-configured team palettes in the league record and
 * hydrates them into per-team CSS variables at runtime. Entries here are only
 * optional file-level fallbacks for installations that want bundled defaults.
 */

export interface TeamColors {
  primary: string;
  secondary: string;
  tertiary?: string;
  quaternary?: string;
}

export const TEAM_COLORS: Record<string, TeamColors> = {
  // 'Team Name': { primary: '#000000', secondary: '#ffffff' },
};

export const LEAGUE_COLORS = {
  primary: '#0b5f98',
  secondary: '#be161e',
  tertiary: '#bf9944',
  quaternary: '#fcfcfc',
  dark: '#050505',
};

function teamCssKey(teamName: string): string {
  return teamName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035`']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-team';
}

/**
 * Backward-compatible low-level helper. Prefer the helpers in team-utils.ts for
 * new UI work because they also derive readable foreground colors.
 */
export const getTeamColors = (teamName: string): TeamColors => {
  const fallback = TEAM_COLORS[teamName] || {
    primary: LEAGUE_COLORS.primary,
    secondary: LEAGUE_COLORS.secondary,
  };
  const key = teamCssKey(teamName);
  return {
    primary: `var(--team-brand-${key}-primary, ${fallback.primary})`,
    secondary: `var(--team-brand-${key}-secondary, ${fallback.secondary})`,
    tertiary: `var(--team-brand-${key}-tertiary, ${fallback.tertiary || fallback.primary})`,
    quaternary: `var(--team-brand-${key}-quaternary, ${fallback.quaternary || fallback.secondary})`,
  };
};

// Removed getTeamColorByIndex; always resolve by canonical team name instead.
