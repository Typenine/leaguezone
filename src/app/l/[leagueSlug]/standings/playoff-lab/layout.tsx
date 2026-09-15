import type { ReactNode } from 'react';
import ProviderFeatureNotice from '@/components/providers/ProviderFeatureNotice';
import { providerFeatureMessage } from '@/lib/providers/capabilities';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';

export default async function PlayoffLabProviderLayout({ children, params }: { children: ReactNode; params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  const current = league ? await resolveLeagueProviderSeason(league.id).catch(() => null) : null;
  if (current?.provider === 'yahoo') {
    return <ProviderFeatureNotice title="Playoff Scenario Lab" message={providerFeatureMessage('yahoo', 'projections') || 'Provider projections are not available.'} backHref={`/l/${leagueSlug}/standings`} backLabel="Back to standings" />;
  }
  return children;
}
