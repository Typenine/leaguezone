/**
 * Platform configuration — shared identity for LeagueZone research and
 * hosted league websites. League-specific values live in the `leagues`
 * DB table; this file holds platform branding, marketing copy structure, the
 * default/demo league slug, and the league-site navigation definition.
 */

export const PLATFORM = {
  name: 'LeagueZone HQ',
  tagline: 'Research the game. Run your league.',
  description:
    'A home for fantasy football research and league management. Explore player statistics, opportunity trends, and career development alongside connected league websites, drafts, trades, and history.',
  contactEmail: process.env.PLATFORM_CONTACT_EMAIL || 'hello@leaguezonehq.com',
  disclaimer:
    'LeagueZone HQ is an independent product and is not affiliated with, endorsed by, or sponsored by the NFL, Sleeper, ESPN, Yahoo, or any other league platform.',
} as const;

export const DEFAULT_LEAGUE_SLUG = 'east-v-west';

export const PRODUCT_FEATURES = [
  {
    eyebrow: 'Home',
    title: 'Custom league homepage',
    description: 'A branded front door with your league name, logo, colors, and the sections your league actually uses.',
    icon: 'command',
  },
  {
    eyebrow: 'Franchises',
    title: 'Team & franchise pages',
    description: 'Every franchise gets an identity — rosters, records, head-to-head history, and team branding.',
    icon: 'managers',
  },
  {
    eyebrow: 'Constitution',
    title: 'Rulebook & constitution hub',
    description: 'One canonical, searchable home for league rules, amendments, and settings. No more buried group-chat PDFs.',
    icon: 'history',
  },
  {
    eyebrow: 'Draft',
    title: 'Draft hub',
    description: 'Draft order, pick history, draft boards, and draft-night tools that make the rookie draft feel like an event.',
    icon: 'draft',
  },
  {
    eyebrow: 'Market',
    title: 'Trade block',
    description: 'A living trade block where managers post availability and needs, with trade history and trade trees.',
    icon: 'trade',
  },
  {
    eyebrow: 'Voice',
    title: 'Suggestions & voting',
    description: 'Structured rule suggestions, endorsements, and votes — so league decisions are visible and on the record.',
    icon: 'commissioner',
  },
  {
    eyebrow: 'Legacy',
    title: 'League history & records',
    description: 'Champions, brackets, all-time records, and franchise lineage preserved across every season.',
    icon: 'trophy',
  },
  {
    eyebrow: 'Activity',
    title: 'Discord announcements',
    description: 'Trades, trade-block updates, and league news pushed straight to your league Discord.',
    icon: 'data',
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Connect your league',
    description: 'Choose a supported fantasy provider and import the league. Rosters, standings, matchups, and transactions stay connected to LeagueZone.',
  },
  {
    step: '02',
    title: 'Customize teams & branding',
    description: 'Set your league name, logo, and colors, and give every franchise its own identity.',
  },
  {
    step: '03',
    title: 'Launch your league site',
    description: 'Your league gets its own home on the web — a branded headquarters managers actually visit.',
  },
  {
    step: '04',
    title: 'Run the league',
    description: 'Manage the rulebook, draft, trade block, suggestions, and league history from one commissioner desk.',
  },
] as const;

export type LeagueFeatureKey =
  | 'teams'
  | 'rulebook'
  | 'draft'
  | 'tradeBlock'
  | 'suggestions'
  | 'history'
  | 'matchups'
  | 'calendar'
  | 'rosters'
  | 'hallOfFame'
  | 'news';

export const DEFAULT_LEAGUE_FEATURES: Record<LeagueFeatureKey, boolean> = {
  teams: true,
  rulebook: true,
  draft: true,
  tradeBlock: true,
  suggestions: true,
  history: true,
  matchups: true,
  calendar: true,
  rosters: true,
  hallOfFame: true,
  news: true,
};

export type LeagueNavItem = {
  segment: string;
  label: string;
  feature?: LeagueFeatureKey;
  adminOnly?: boolean;
};

export const LEAGUE_NAV: LeagueNavItem[] = [
  { segment: '', label: 'League Home' },
  { segment: 'teams', label: 'Teams', feature: 'teams' },
  { segment: 'standings', label: 'Standings' },
  { segment: 'matchups', label: 'Schedule', feature: 'matchups' },
  { segment: 'rosters', label: 'Rosters', feature: 'rosters' },
  { segment: 'calendar', label: 'Calendar', feature: 'calendar' },
  { segment: 'news', label: 'News', feature: 'news' },
  { segment: 'rulebook', label: 'Rulebook', feature: 'rulebook' },
  { segment: 'draft', label: 'Draft', feature: 'draft' },
  { segment: 'trade-block', label: 'Trade Block', feature: 'tradeBlock' },
  { segment: 'suggestions', label: 'Suggestions', feature: 'suggestions' },
  { segment: 'history', label: 'History', feature: 'history' },
  { segment: 'hall-of-fame', label: 'Hall of Fame', feature: 'hallOfFame' },
  { segment: 'admin', label: 'Commissioner', adminOnly: true },
];

export function leagueUrl(slug: string, segment = ''): string {
  return segment ? `/l/${slug}/${segment}` : `/l/${slug}`;
}
