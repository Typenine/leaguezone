export type LeagueSwitchTarget = {
  isCommissioner?: boolean;
};

const PRESERVED_LEAGUE_PATHS = new Set([
  '/home',
  '/teams',
  '/standings',
  '/rules',
  '/history',
  '/transactions',
  '/trades',
  '/trades/block',
  '/trades/analyzer',
  '/suggestions',
]);

function normalizeSearch(search: string): string {
  if (!search) return '';
  return search.startsWith('?') ? search : `?${search}`;
}

export function getLeagueSwitchDestination(
  pathname: string,
  search = '',
  target: LeagueSwitchTarget = {},
): string {
  const query = normalizeSearch(search);

  if (pathname === '/settings') {
    return target.isCommissioner ? `/settings${query}` : '/home';
  }

  if (PRESERVED_LEAGUE_PATHS.has(pathname)) {
    return `${pathname}${query}`;
  }

  return '/home';
}

export function buildLeagueSwitchHref(
  leagueId: string,
  pathname: string,
  search = '',
  target: LeagueSwitchTarget = {},
): string {
  const destination = getLeagueSwitchDestination(pathname, search, target);
  return `/api/league/select?id=${encodeURIComponent(leagueId)}&next=${encodeURIComponent(destination)}`;
}
