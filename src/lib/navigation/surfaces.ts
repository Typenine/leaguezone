export type NavigationSurface = 'platform' | 'league-site' | 'legacy-league';

const PLATFORM_PREFIXES = [
  '/app',
  '/demo',
  '/features',
  '/forgot-password',
  '/join',
  '/login',
  '/newsletter',
  '/pricing',
  '/register',
  '/reset-password',
  '/setup',
  '/super-admin',
  '/verify-email',
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isLeagueSitePath(pathname: string): boolean {
  return /^\/l\/[^/]+(?:\/|$)/.test(pathname) || matchesPrefix(pathname, '/leagues');
}

export function isPlatformPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PLATFORM_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function getNavigationSurface(pathname: string): NavigationSurface {
  if (isLeagueSitePath(pathname)) return 'league-site';
  if (isPlatformPath(pathname)) return 'platform';
  return 'legacy-league';
}

export function getLeagueSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/l\/([^/]+)(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function getLeagueSiteSection(pathname: string): string {
  const match = pathname.match(/^\/l\/[^/]+(?:\/(.*))?$/);
  return (match?.[1] || '').replace(/^\/+|\/+$/g, '');
}
