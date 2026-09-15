import type { FantasyProviderId, FantasyRostersData, FantasyStandingsData, FantasyTeamData } from '@/lib/providers/types';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || 'League data could not be loaded.');
  return payload;
}

export async function getFantasySeasonsClient(): Promise<{
  currentSeason: string;
  provider: FantasyProviderId | null;
  seasons: Array<{ season: string; provider: FantasyProviderId }>;
}> {
  return getJson('/api/fantasy/seasons');
}

export async function getFantasyStandingsClient(season?: string): Promise<FantasyStandingsData> {
  const query = season ? `?season=${encodeURIComponent(season)}` : '';
  return getJson(`/api/fantasy/standings${query}`);
}

export async function getFantasyRostersClient(season?: string): Promise<FantasyRostersData> {
  const query = season ? `?season=${encodeURIComponent(season)}` : '';
  return getJson(`/api/fantasy/rosters${query}`);
}

export async function getFantasyTeamsClient(): Promise<{
  provider: FantasyProviderId | null;
  teams: FantasyTeamData[];
  allTimeByOwner: Record<string, { wins: number; losses: number; ties: number }>;
}> {
  return getJson('/api/fantasy/teams');
}
