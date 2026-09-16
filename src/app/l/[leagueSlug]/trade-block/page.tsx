import TradeBlockPage from '@/app/trades/block/page';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';

export default async function LeagueTradeBlockPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  const current = league ? await resolveLeagueProviderSeason(league.id).catch(() => null) : null;
  return (
    <>
      {current?.provider === 'yahoo' && (
        <div className="container mx-auto px-4 pt-6">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
            Yahoo trade blocks support rostered players, team needs, and FAAB when Yahoo exposes the league budget. Future-pick ownership is omitted because Yahoo does not provide a reliable traded-pick ownership feed for LeagueZone to validate.
          </div>
        </div>
      )}
      <TradeBlockPage />
    </>
  );
}
