import { notFound } from 'next/navigation';
import PlayerHallOfFameBadges from '@/components/hall-of-fame/PlayerHallOfFameBadges';
import PlayerHonorsSection from '@/components/players/PlayerHonorsSection';
import PlayerProfileSections from '@/components/players/PlayerProfileSections';
import { getPlayerHallOfFameHonors } from '@/lib/hall-of-fame/service';
import { getPlayerHonors } from '@/lib/players/player-honors';
import { getPlayerProfile } from '@/lib/players/player-profile-service';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { getLeague as getSleeperLeague } from '@/lib/utils/sleeper-api';

export const dynamic = 'force-dynamic';

export default async function LeaguePlayerPage({ params }: { params: Promise<{ leagueSlug: string; playerId: string }> }) {
  const { leagueSlug, playerId } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league?.sleeperLeagueId) notFound();
  const sleeper = await getSleeperLeague(league.sleeperLeagueId).catch(() => null);
  const currentSeason = String(sleeper?.season || Object.keys(league.sleeperLeagueIds).sort().at(-1) || new Date().getUTCFullYear());
  const previousLeagueIds = Object.fromEntries(Object.entries(league.sleeperLeagueIds).filter(([season, id]) => season !== currentSeason && id !== league.sleeperLeagueId));
  const context = { currentSeason, currentLeagueId: league.sleeperLeagueId, previousLeagueIds, cacheKey: league.id };
  const [profile, honors, hallOfFame] = await Promise.all([getPlayerProfile(playerId, context), getPlayerHonors(playerId, context), getPlayerHallOfFameHonors(playerId, league.id)]);
  if (!profile) notFound();
  return <main className="container mx-auto space-y-8 px-4 py-8"><PlayerHallOfFameBadges honors={hallOfFame} /><PlayerHonorsSection honors={honors} /><PlayerProfileSections profile={profile} /><p className="text-xs text-[var(--muted)]">Player ID: {playerId} · Seasons: {profile.dataCoverage.seasonsAvailable.join(', ') || 'none'}</p></main>;
}
