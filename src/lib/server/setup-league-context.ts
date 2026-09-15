import { cookies } from 'next/headers';
import { requireSetupLeagueOwnership } from '@/lib/server/setup-ownership';

export async function resolveOwnedSetupLeagueId(
  userId: string,
  explicitLeagueId?: string | null,
): Promise<string | null> {
  const jar = await cookies();
  const leagueId =
    (typeof explicitLeagueId === 'string' && explicitLeagueId.trim() ? explicitLeagueId.trim() : null) ||
    jar.get('setup_league_id')?.value ||
    jar.get('active_league_id')?.value ||
    null;

  if (!leagueId) return null;
  const ownership = await requireSetupLeagueOwnership(userId, leagueId);
  return ownership ? leagueId : null;
}
