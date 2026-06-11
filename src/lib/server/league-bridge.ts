/**
 * Pass-1 bridge for league-scoped routes.
 *
 * The full league pages (teams, draft, history, …) still live at their
 * original top-level routes and resolve the league from the
 * `active_league_id` cookie. Until those pages are moved under
 * /l/[leagueSlug], these bridges resolve the league from the route slug and
 * hand off through /api/league/select, which sets the cookie and redirects —
 * so /l/[leagueSlug]/* URLs are stable now and keep working after the move.
 */

import { notFound, redirect } from 'next/navigation';
import { getCurrentLeagueBySlug } from '@/lib/server/league-context';

type BridgeParams = { params: Promise<{ leagueSlug: string }> };

export function createLeagueBridge(target: string) {
  return async function LeagueBridgePage({ params }: BridgeParams) {
    const { leagueSlug } = await params;
    const league = await getCurrentLeagueBySlug(leagueSlug);
    if (!league) notFound();
    redirect(`/api/league/select?id=${encodeURIComponent(league.id)}&next=${encodeURIComponent(target)}`);
  };
}
