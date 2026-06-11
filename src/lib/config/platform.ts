/**
 * Platform configuration — the product-level identity and defaults for the
 * hosted league-website service. League-specific values live in the `leagues`
 * DB table; this file holds platform branding, marketing copy structure, the
 * default/demo league slug, and the league-site navigation definition.
 */

export const PLATFORM = {
  name: 'League HQ',
  tagline: 'Custom fantasy football league websites for serious dynasty commissioners.',
  description:
    'A branded league headquarters that works alongside Sleeper — team pages, rulebook, draft hub, trade block, suggestions, voting, and league history in one polished home.',
  /** Contact target for setup requests while self-serve creation is not built. */
  contactEmail: 'commissioner@example.com',
  disclaimer:
    'League HQ is an independent product and is not affiliated with, endorsed by, or sponsored by the NFL, Sleeper, ESPN, Yahoo, or any other league platform.',
} as const;

/** Slug of the first seeded/default league, used for the public demo. */
export const DEFAULT_LEAGUE_SLUG = 'east-v-west';

// ---------------------------------------------------------------------------
// Marketing content
// ---------------------------------------------------------------------------

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
    title: 'Connect Sleeper',
    description: 'Link your Sleeper league once. Rosters, standings, matchups, and transactions stay in sync automatically.',
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

export const PRICING_TIERS = [
  {
    name: 'Starter',
    price: 'Free',
    period: 'during beta',
    description: 'A league homepage with Sleeper-connected standings, teams, and history.',
    features: ['League homepage', 'Team pages', 'Standings & matchups', 'Season history'],
    cta: 'View demo',
    href: '/demo',
    highlighted: false,
  },
  {
    name: 'Commissioner',
    price: 'TBD',
    period: 'per season',
    description: 'The full league headquarters for serious dynasty leagues.',
    features: ['Everything in Starter', 'Rulebook & constitution hub', 'Draft hub & draft tools', 'Trade block & trade trees', 'Suggestions & voting'],
    cta: 'Request setup',
    href: '/register',
    highlighted: true,
  },
  {
    name: 'Premium',
    price: 'TBD',
    period: 'per season',
    description: 'Custom branding and white-glove setup for leagues that want everything.',
    features: ['Everything in Commissioner', 'Custom branding & colors', 'Discord announcements', 'Newsletter & podcast hub', 'Priority support'],
    cta: 'Request setup',
    href: '/register',
    highlighted: false,
  },
] as const;

// ---------------------------------------------------------------------------
// League-site navigation (feature-aware)
// ---------------------------------------------------------------------------

export type LeagueFeatureKey =
  | 'teams'
  | 'rulebook'
  | 'draft'
  | 'tradeBlock'
  | 'suggestions'
  | 'history';

/** All features enabled by default; leagues can disable via `leagues.config.features`. */
export const DEFAULT_LEAGUE_FEATURES: Record<LeagueFeatureKey, boolean> = {
  teams: true,
  rulebook: true,
  draft: true,
  tradeBlock: true,
  suggestions: true,
  history: true,
};

export type LeagueNavItem = {
  /** Path segment appended to /l/[leagueSlug] ('' = league home). */
  segment: string;
  label: string;
  /** Feature flag controlling visibility; undefined = always shown. */
  feature?: LeagueFeatureKey;
  /** Only shown to commissioners/admins. */
  adminOnly?: boolean;
};

export const LEAGUE_NAV: LeagueNavItem[] = [
  { segment: '', label: 'Home' },
  { segment: 'teams', label: 'Teams', feature: 'teams' },
  { segment: 'rulebook', label: 'Rulebook', feature: 'rulebook' },
  { segment: 'draft', label: 'Draft', feature: 'draft' },
  { segment: 'trade-block', label: 'Trade Block', feature: 'tradeBlock' },
  { segment: 'suggestions', label: 'Suggestions', feature: 'suggestions' },
  { segment: 'history', label: 'History', feature: 'history' },
  { segment: 'admin', label: 'Admin', adminOnly: true },
];

export function leagueUrl(slug: string, segment = ''): string {
  return segment ? `/l/${slug}/${segment}` : `/l/${slug}`;
}
