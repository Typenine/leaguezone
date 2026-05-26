/**
 * Team colors for your fantasy football league.
 * Each team has up to 4 colors used for branding and UI elements.
 * Keys must match the canonical team names in team-mapping.ts.
 *
 * Example entry:
 *   'My Team Name': { primary: '#123456', secondary: '#abcdef' },
 */

// Type for team colors
export interface TeamColors {
  primary: string;
  secondary: string;
  tertiary?: string;
  quaternary?: string;
}

// Map of team names to their colors.
// Add an entry here for each team in your league after setup.
export const TEAM_COLORS: Record<string, TeamColors> = {
  // 'Team Name': { primary: '#000000', secondary: '#ffffff' },
};

// League colors for global UI elements
export const LEAGUE_COLORS = {
  primary: '#0b5f98',    // Accent / brand
  secondary: '#be161e',  // Danger
  tertiary: '#bf9944',   // Gold highlight
  quaternary: '#fcfcfc', // White
  dark: '#050505',       // Near-black
};

// Function to get team colors by team name
export const getTeamColors = (teamName: string): TeamColors => {
  return TEAM_COLORS[teamName] || {
    primary: LEAGUE_COLORS.primary,
    secondary: LEAGUE_COLORS.secondary
  };
};

// Removed getTeamColorByIndex; always resolve by canonical team name instead.
