import type { ProviderLeagueSummary } from '@/lib/providers/types';

function value(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function aliases(league: ProviderLeagueSummary): Set<string> {
  const out = new Set<string>();
  const leagueId = value(league.metadata?.leagueId);
  const gameKey = value(league.providerGameId);
  out.add(league.providerLeagueId);
  if (gameKey && leagueId) {
    out.add(`${gameKey}.l.${leagueId}`);
    out.add(`${gameKey}_${leagueId}`);
  }
  return out;
}

function relationValues(league: ProviderLeagueSummary): string[] {
  return [value(league.metadata?.renew), value(league.metadata?.renewed)].filter(Boolean);
}

function linked(a: ProviderLeagueSummary, b: ProviderLeagueSummary): boolean {
  const aAliases = aliases(a);
  const bAliases = aliases(b);
  return relationValues(a).some((candidate) => bAliases.has(candidate))
    || relationValues(b).some((candidate) => aAliases.has(candidate));
}

/**
 * Walk Yahoo's explicit renew/renewed metadata only. League names, team slots, and
 * owner display names are intentionally not used to guess historical continuity.
 */
export function findLinkedYahooLeagueHistory(
  selected: ProviderLeagueSummary,
  available: ProviderLeagueSummary[],
): ProviderLeagueSummary[] {
  const byKey = new Map(available.map((league) => [league.providerLeagueId, league] as const));
  byKey.set(selected.providerLeagueId, selected);
  const all = Array.from(byKey.values());
  const visited = new Set<string>();
  const queue: ProviderLeagueSummary[] = [selected];
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.providerLeagueId)) continue;
    visited.add(current.providerLeagueId);
    for (const candidate of all) {
      if (visited.has(candidate.providerLeagueId)) continue;
      if (linked(current, candidate)) queue.push(candidate);
    }
  }
  return all
    .filter((league) => visited.has(league.providerLeagueId))
    .sort((a, b) => b.season - a.season);
}
