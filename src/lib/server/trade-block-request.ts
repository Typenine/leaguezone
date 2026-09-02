export function leagueSlugFromTradeBlockReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    const match = url.pathname.match(/^\/l\/([^/]+)\/trade-block\/?$/i);
    return match?.[1] ? decodeURIComponent(match[1]).trim().toLowerCase() : null;
  } catch {
    return null;
  }
}
