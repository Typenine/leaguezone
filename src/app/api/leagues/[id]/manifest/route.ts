import { NextRequest, NextResponse } from 'next/server';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { normalizeHexColor } from '@/lib/branding/colors';
import { guardPublicDataRequest } from '@/lib/server/public-api-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guarded = await guardPublicDataRequest(req, {
    action: 'league-manifest',
    requireBrowserGate: false,
    allowAutomatedClients: false,
    limit: { maxRequests: 30, windowSeconds: 5 * 60 },
  });
  if (guarded) return guarded;

  const { id: leagueSlug } = await context.params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const icon = league.logoUrl || '/assets/LeagueZone%20HQ%20Logo.png';
  const theme = normalizeHexColor(league.primaryColor) || '#08111f';
  return NextResponse.json({
    name: `${league.name} on LeagueZone`,
    short_name: league.shortName || league.name.slice(0, 24),
    description: `${league.name} fantasy league site on LeagueZone.`,
    start_url: `/l/${league.slug}`,
    scope: `/l/${league.slug}/`,
    display: 'standalone',
    background_color: '#08111f',
    theme_color: theme,
    lang: 'en-US',
    categories: ['sports', 'entertainment'],
    icons: [{ src: icon, sizes: 'any', purpose: 'any' }],
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'X-LeagueZone-Data-Mode': league._reliability?.stale ? 'stale' : 'live',
    },
  });
}
