import type { ReactNode } from 'react';
import ProviderFeatureNotice from '@/components/providers/ProviderFeatureNotice';
import { providerFeatureMessage } from '@/lib/providers/capabilities';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';

export default async function TeamHealthProviderLayout({ children, params }: { children: ReactNode; params: Promise<{ leagueSlug: string; id: string }> }) {
  const { leagueSlug, id } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  const current = league ? await resolveLeagueProviderSeason(league.id).catch(() => null) : null;
  if (current?.provider === 'yahoo') {
    return <ProviderFeatureNotice title="Team Health Center" message={providerFeatureMessage('yahoo', 'health') || 'Provider health data is not available.'} backHref={`/l/${leagueSlug}/teams/${id}`} backLabel="Back to team" />;
  }
  return children;
}
