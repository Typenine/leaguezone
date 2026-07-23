import {
  getLeagueSiteSection,
  isLeagueSitePath,
} from '@/lib/navigation/surfaces';

export type LeagueSwitchTarget = {
  isCommissioner?: boolean;
  leagueSlug?: string;
};

const PRESERVED_LEGACY_PATHS = new Set([
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

const LEGACY_TO_SITE_SECTION: Record<string, string> = {
  '/home': '',
  '/teams': 'teams',
  '/standings': 'standings',
  '/rules': 'rulebook',
  '/history': 'history',
  '/draft': 'draft',
  '/trades/block': 'trade-block',
  '/suggestions': 'suggestions',
};

const SAFE_SITE_SECTIONS = new Set([
  '',
  'teams',
  'standings',
  'rulebook',
  'draft',
  'trade-block',
  'suggestions',
  'history',
]);

function normalizeSearch(search: string): string {
  if (!search) return '';
  return search.startsWith('?') ? search : `?${search}`;
}

function sitePath(slug: string, section = '', search = ''): string {
  const base = section ? `/l/${encodeURIComponent(slug)}/${section}` : `/l/${encodeURIComponent(slug)}`;
  return `${base}${normalizeSearch(search)}`;
}

function getCanonicalSiteDestination(
  pathname: string,
  search: string,
  target: Required<Pick<LeagueSwitchTarget, 'leagueSlug'>> & LeagueSwitchTarget,
): string {
  const slug = target.leagueSlug;

  if (isLeagueSitePath(pathname)) {
    const section = getLeagueSiteSection(pathname);
    if (section === 'admin') {
      return target.isCommissioner ? sitePath(slug, 'admin', search) : sitePath(slug);
    }
    if (SAFE_SITE_SECTIONS.has(section)) return sitePath(slug, section, search);

    const firstSegment = section.split('/')[0];
    if (firstSegment === 'teams') return sitePath(slug, 'teams');
    return sitePath(slug);
  }

  if (pathname === '/settings' || pathname.startsWith('/admin')) {
    return target.isCommissioner ? sitePath(slug, 'admin', search) : sitePath(slug);
  }

  if (pathname.startsWith('/teams/')) return sitePath(slug, 'teams');

  const mappedSection = LEGACY_TO_SITE_SECTION[pathname];
  if (mappedSection !== undefined) return sitePath(slug, mappedSection, search);

  return sitePath(slug);
}

export function getLeagueSwitchDestination(
  pathname: string,
  search = '',
  target: LeagueSwitchTarget = {},
): string {
  if (target.leagueSlug) {
    return getCanonicalSiteDestination(pathname, search, {
      ...target,
      leagueSlug: target.leagueSlug,
    });
  }

  const query = normalizeSearch(search);

  if (pathname === '/settings') {
    return target.isCommissioner ? `/settings${query}` : '/home';
  }

  if (PRESERVED_LEGACY_PATHS.has(pathname)) {
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
