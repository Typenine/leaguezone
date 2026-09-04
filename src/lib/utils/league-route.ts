const LEAGUE_PATH_PATTERN = /^\/l\/([^/]+)(?:\/|$)/;

export function getLeagueSlugFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const match = pathname.match(LEAGUE_PATH_PATTERN);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function getLeagueBasePath(pathname: string | null | undefined): string {
  const slug = getLeagueSlugFromPathname(pathname);
  return slug ? `/l/${encodeURIComponent(slug)}` : '';
}
