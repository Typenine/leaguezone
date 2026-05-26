// League constants — configure these for your league each season.
// SLEEPER_LEAGUE_ID is read from the environment variable set during deployment.
// Multi-year IDs should be entered here once you have them from Sleeper.

// Sleeper League IDs — replace with your league's IDs from Sleeper
export const LEAGUE_IDS = {
  CURRENT: process.env.SLEEPER_LEAGUE_ID || '',
  PREVIOUS: {
    // Add prior-season IDs here after your first season:
    // '2025': 'your-2025-league-id',
    // '2024': 'your-2024-league-id',
  } as Record<string, string>,
};

// Update this to the current NFL season year each September
export const CURRENT_SEASON = process.env.CURRENT_SEASON || String(new Date().getFullYear());

export function getLeagueIdForSeason(season: string): string | null {
  if (season === CURRENT_SEASON) return LEAGUE_IDS.CURRENT || null;
  const prev = LEAGUE_IDS.PREVIOUS[season];
  return prev || null;
}

// Team names — populated by the Sleeper setup step; leave empty for new installs.
// Once your Sleeper league is connected, team names resolve automatically from Sleeper's API.
export const TEAM_NAMES: string[] = [];

// Current year for copyright and other displays
export const CURRENT_YEAR = new Date().getFullYear();

// Important dates — UPDATE THESE ANNUALLY before each season.
// All values can also be stored in the leagues.config DB column for multi-league support.
export const IMPORTANT_DATES = {
  NFL_WEEK_1_START: new Date(process.env.NFL_WEEK_1_START || `${new Date().getFullYear()}-09-04T20:20:00-04:00`),
  TRADE_DEADLINE:   new Date(process.env.TRADE_DEADLINE   || `${new Date().getFullYear()}-11-28T23:45:00-05:00`),
  PLAYOFFS_START:   new Date(process.env.PLAYOFFS_START   || `${new Date().getFullYear()}-12-18T20:20:00-05:00`),
  NEW_LEAGUE_YEAR:  new Date(process.env.NEW_LEAGUE_YEAR  || `${new Date().getFullYear() + 1}-02-08T18:30:00-05:00`),
  NEXT_DRAFT:       new Date(process.env.NEXT_DRAFT_DATE  || `${new Date().getFullYear()}-07-01T12:00:00-04:00`),
};

// Champions by year — add your league's champions here each season.
// Eventually these can move into the DB (leagues.config or a dedicated champions table).
export const CHAMPIONS: Record<string, { champion: string; runnerUp: string; thirdPlace: string }> = {
  // Add entries like:
  // '2025': { champion: 'Team Name', runnerUp: 'Team Name', thirdPlace: 'Team Name' },
};
