import { getCurrentLeague } from '@/lib/server/league-context';

export async function resolveActiveFantasyLeagueId(): Promise<string | null> {
  const league = await getCurrentLeague();
  return league?.id || null;
}
