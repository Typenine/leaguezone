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

export function getLeagueBasePathForSlug(slug: string | null | undefined): string {
  const normalized = slug?.trim();
  return normalized ? `/l/${encodeURIComponent(normalized)}` : '';
}

export function getLeagueBasePath(pathname: string | null | undefined): string {
  return getLeagueBasePathForSlug(getLeagueSlugFromPathname(pathname));
}

/** Build a canonical hosted-league path while preserving legacy single-league routes. */
export function getLeagueScopedPath(slug: string | null | undefined, path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${getLeagueBasePathForSlug(slug)}${suffix}`;
}
