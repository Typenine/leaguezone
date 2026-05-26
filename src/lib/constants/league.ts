// League constants — configure these for your league each season.
//
// League IDs are resolved in priority order:
//   1. process.env.SLEEPER_LEAGUE_ID  (set in Vercel env vars — traditional deployments)
//   2. window.__LEAGUE_CONFIG__        (injected by root layout from DB — setup-wizard deployments)
//
// This means you do NOT need to set SLEEPER_LEAGUE_ID manually if you used the
// setup wizard; it is stored in the database and injected automatically.

// ---------------------------------------------------------------------------
// Runtime config reader (works both server-side and client-side)
// ---------------------------------------------------------------------------

interface _WindowLeagueConfig {
  currentLeagueId: string;
  previousLeagueIds: Record<string, string>;
}

function _getWindowConfig(): _WindowLeagueConfig | null {
  if (typeof window === 'undefined') return null;
  return (window as typeof window & { __LEAGUE_CONFIG__?: _WindowLeagueConfig }).__LEAGUE_CONFIG__ ?? null;
}

function _getCurrentLeagueId(): string {
  // Server-side: env var only (DB is read async via getLeagueIdsFromDb in server utilities)
  if (typeof window === 'undefined') {
    return process.env.SLEEPER_LEAGUE_ID || '';
  }
  // Client-side: window config (injected from DB by root layout) → env var fallback
  return _getWindowConfig()?.currentLeagueId || process.env.SLEEPER_LEAGUE_ID || '';
}

function _getPreviousLeagueIds(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  return _getWindowConfig()?.previousLeagueIds ?? {};
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// Sleeper League IDs. CURRENT and PREVIOUS are dynamic getters so they always
// reflect the injected window config after hydration.
export const LEAGUE_IDS = {
  get CURRENT(): string { return _getCurrentLeagueId(); },
  get PREVIOUS(): Record<string, string> { return _getPreviousLeagueIds(); },
};

// Update this to the current NFL season year each September, or set CURRENT_SEASON env var.
// Auto-detection: the NFL season "2025" runs from Sept 2025 – Feb 2026.
// Before July (months 0–5) we are still in the prior season's offseason, so subtract 1.
function _defaultNFLSeason(): string {
  const now = new Date();
  return String(now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear());
}
export const CURRENT_SEASON = process.env.CURRENT_SEASON || _defaultNFLSeason();

export function getLeagueIdForSeason(season: string): string | null {
  if (season === CURRENT_SEASON) return LEAGUE_IDS.CURRENT || null;
  const prev = LEAGUE_IDS.PREVIOUS[season];
  return prev || null;
}

// Team names — populated by Sleeper API after connection; leave empty for new installs.
export const TEAM_NAMES: string[] = [];

// Current year for copyright and other displays
export const CURRENT_YEAR = new Date().getFullYear();

// Important dates — UPDATE THESE ANNUALLY before each season.
// All values can also be stored in the leagues.config DB column.
export const IMPORTANT_DATES = {
  NFL_WEEK_1_START: new Date(process.env.NFL_WEEK_1_START || `${new Date().getFullYear()}-09-04T20:20:00-04:00`),
  TRADE_DEADLINE:   new Date(process.env.TRADE_DEADLINE   || `${new Date().getFullYear()}-11-28T23:45:00-05:00`),
  PLAYOFFS_START:   new Date(process.env.PLAYOFFS_START   || `${new Date().getFullYear()}-12-18T20:20:00-05:00`),
  NEW_LEAGUE_YEAR:  new Date(process.env.NEW_LEAGUE_YEAR  || `${new Date().getFullYear() + 1}-02-08T18:30:00-05:00`),
  NEXT_DRAFT:       new Date(process.env.NEXT_DRAFT_DATE  || `${new Date().getFullYear()}-07-01T12:00:00-04:00`),
};

// Champions by year — add entries here each season.
export const CHAMPIONS: Record<string, { champion: string; runnerUp: string; thirdPlace: string }> = {
  // '2025': { champion: 'Team Name', runnerUp: 'Team Name', thirdPlace: 'Team Name' },
};
