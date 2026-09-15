import { notFound } from 'next/navigation';
import PlayerHallOfFameBadges from '@/components/hall-of-fame/PlayerHallOfFameBadges';
import PlayerHonorsSection from '@/components/players/PlayerHonorsSection';
import PlayerProfileSections from '@/components/players/PlayerProfileSections';
import ProviderPlayerDetail from '@/components/providers/ProviderPlayerDetail';
import { getPlayerHallOfFameHonors } from '@/lib/hall-of-fame/service';
import { getPlayerHonors } from '@/lib/players/player-honors';
import { getPlayerProfile } from '@/lib/players/player-profile-service';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { listLeagueProviderSeasons, resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';

export default async function LeaguePlayerPage({ params }: { params: Promise<{ leagueSlug: string; playerId: string }> }) {
  const { leagueSlug, playerId } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  const current = await resolveLeagueProviderSeason(league.id).catch(() => null);

  if (current?.provider === 'yahoo' || playerId.includes('.p.')) {
    return <ProviderPlayerDetail leagueId={league.id} leagueSlug={league.slug} playerId={playerId} />;
  }

  const seasons = await listLeagueProviderSeasons(league.id);
  const sleeperSeasons = seasons.filter((row) => row.provider === 'sleeper');
  const currentSleeper = sleeperSeasons.find((row) => row.isCurrent) || sleeperSeasons[0];
  if (!currentSleeper) notFound();
  const currentSeason = String(currentSleeper.season);
  const previousLeagueIds = Object.fromEntries(
    sleeperSeasons
      .filter((row) => row.providerLeagueId !== currentSleeper.providerLeagueId)
      .map((row) => [String(row.season), row.providerLeagueId]),
  );
  const context = { currentSeason, currentLeagueId: currentSleeper.providerLeagueId, previousLeagueIds, cacheKey: league.id };
  const [profile, honors, hallOfFame] = await Promise.all([
    getPlayerProfile(playerId, context),
    getPlayerHonors(playerId, context),
    getPlayerHallOfFameHonors(playerId, league.id),
  ]);
  if (!profile) notFound();
  return <main className="container mx-auto space-y-8 px-4 py-8"><PlayerHallOfFameBadges honors={hallOfFame} /><PlayerHonorsSection honors={honors} /><PlayerProfileSections profile={profile} /><p className="text-xs text-[var(--muted)]">Player ID: {playerId} · Seasons: {profile.dataCoverage.seasonsAvailable.join(', ') || 'none'}</p></main>;
}
