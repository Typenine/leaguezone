import { PLATFORM_FEATURES } from '@/lib/config/features';

export type UserNavItem = {
  id: string;
  label: string;
  href?: string;
  description?: string;
  group?: string;
  children?: UserNavItem[];
};

export const HISTORY_TAB_IDS = [
  'champions',
  'brackets',
  'leaderboards',
  'weekly-highs',
  'franchises',
  'records',
] as const;

export const DRAFT_VIEW_IDS = ['next', 'past', 'team-prospect-draftboard'] as const;
export const DRAFT_NEXT_TAB_IDS = ['order'] as const;

export const USER_NAV_CONFIG: UserNavItem[] = [
  { id: 'home', label: 'Home', href: '/home' },
  {
    id: 'league',
    label: 'League',
    children: [
      { id: 'league.teams', label: 'Teams', href: '/teams' },
      { id: 'league.hall-of-fame', label: 'Team Hall of Fame', href: '/hall-of-fame', description: 'Franchise legends and induction classes' },
      { id: 'league.rosters', label: 'Rosters', href: '/rosters', description: 'Every team roster in one view' },
      { id: 'league.standings', label: 'Standings', href: '/standings' },
      { id: 'league.rules', label: 'Rules', href: '/rules' },
    ],
  },
  {
    id: 'history',
    label: 'History',
    children: [
      { id: 'history.champions', label: 'Champions', href: '/history?tab=champions' },
      { id: 'history.brackets', label: 'Brackets', href: '/history?tab=brackets' },
      { id: 'history.leaderboards', label: 'Leaderboards', href: '/history?tab=leaderboards' },
      { id: 'history.weekly-highs', label: 'Weekly Highs', href: '/history?tab=weekly-highs' },
      { id: 'history.franchises', label: 'Franchises', href: '/history?tab=franchises' },
      { id: 'history.records', label: 'Records', href: '/history?tab=records' },
      { id: 'history.franchise-history', label: 'Franchise History', href: '/history/franchises', description: 'Permanent franchise reference pages', group: 'League Archive' },
      { id: 'history.gamebooks', label: 'Weekly Gamebooks', href: '/history/gamebook', description: 'Week-by-week matchup and scoring archive', group: 'League Archive' },
      { id: 'history.milestones', label: 'Milestones', href: '/history/milestones', description: 'Career, franchise and record milestones', group: 'League Archive' },
      {
        id: 'history.stats',
        label: 'Stats',
        href: '/history/stats',
        description: 'League Football Reference-style statistical archive',
        group: 'Stats & Records',
        children: [
          { id: 'history.stats.players', label: 'Players', href: '/history/stats?tab=players' },
          { id: 'history.stats.franchises', label: 'Franchises', href: '/history/stats?tab=franchises' },
          { id: 'history.stats.seasons', label: 'Seasons', href: '/history/stats?tab=seasons' },
          { id: 'history.stats.games', label: 'Games', href: '/history/stats?tab=games' },
          { id: 'history.stats.records', label: 'Records', href: '/history/stats?tab=records' },
          { id: 'history.stats.explorer', label: 'Explorer', href: '/history/stats?tab=explorer' },
        ],
      },
    ],
  },
  {
    id: 'draft',
    label: 'Draft',
    children: [
      {
        id: 'draft.next',
        label: 'Next Draft',
        href: '/draft?view=next',
        children: [
          { id: 'draft.next.order', label: 'Draft Order', href: '/draft?view=next&next=order' },
        ],
      },
      { id: 'draft.past', label: 'Previous Drafts', href: '/draft?view=past' },
      { id: 'draft.team-prospect-draftboard', label: 'Team Prospect Draftboard', href: '/draft?view=team-prospect-draftboard' },
    ],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    children: [
      { id: 'transactions.free-agency', label: 'Free Agency & Waivers', href: '/transactions' },
      { id: 'transactions.trades', label: 'Trades', href: '/trades' },
      { id: 'transactions.trade-block', label: 'Trade Block', href: '/trades/block' },
      { id: 'transactions.trade-analyzer', label: 'Trade Analyzer', href: '/trades/analyzer' },
    ],
  },
  { id: 'suggestions', label: 'Suggestions', href: '/suggestions' },
  ...(PLATFORM_FEATURES.newsletter
    ? [{ id: 'newsletter', label: 'Newsletter', href: '/newsletter' } satisfies UserNavItem]
    : []),
  { id: 'settings', label: 'Settings', href: '/settings' },
];
