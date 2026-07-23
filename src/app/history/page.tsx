import { Suspense } from 'react';
import HistoryContent from './HistoryContent';
import { getCurrentLeague } from '@/lib/server/league-context';
import { getFranchiseNamesByOwnerId } from '@/lib/server/franchise-identities';

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Legacy compatibility route. Canonical /l/[slug]/history gets this context from its layout. */
export default async function HistoryPage() {
  const league = await getCurrentLeague();
  const franchiseNamesByOwnerId = league
    ? await getFranchiseNamesByOwnerId({
        sleeperLeagueId: league.sleeperLeagueId,
        config: league.config,
      })
    : {};
  const identityJson = safeJson(franchiseNamesByOwnerId);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__LEAGUE_CONFIG__ = { ...(window.__LEAGUE_CONFIG__ || {}), franchiseNamesByOwnerId: ${identityJson} };`,
        }}
      />
      <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
        <HistoryContent />
      </Suspense>
    </>
  );
}
