import { NextRequest } from 'next/server';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { createLeagueShareCard, type ShareCardKind } from '@/lib/branding/share-card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = new Set<ShareCardKind>(['league', 'matchup', 'standings', 'champion', 'draft', 'trade', 'record', 'power', 'newsletter', 'hall-of-fame']);
const DEFAULT_TITLES: Record<ShareCardKind, string> = {
  league: 'League Home',
  matchup: 'Weekly Matchup',
  standings: 'League Standings',
  champion: 'League Champion',
  draft: 'Draft Update',
  trade: 'Trade Alert',
  record: 'Record Book',
  power: 'Power Rankings',
  newsletter: 'League Newsletter',
  'hall-of-fame': 'Hall of Fame',
};

function clean(value: string | null, max: number): string | undefined {
  const text = value?.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : undefined;
}

export async function GET(req: NextRequest, context: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await context.params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return Response.json({ error: 'League not found' }, { status: 404 });

  const url = new URL(req.url);
  const requestedKind = (url.searchParams.get('type') || 'league') as ShareCardKind;
  const kind: ShareCardKind = KINDS.has(requestedKind) ? requestedKind : 'league';
  const title = clean(url.searchParams.get('title'), 90) || (kind === 'league' ? league.name : DEFAULT_TITLES[kind]);
  const subtitle = clean(url.searchParams.get('subtitle'), 180);
  const left = clean(url.searchParams.get('left'), 90);
  const right = clean(url.searchParams.get('right'), 90);
  const footer = clean(url.searchParams.get('footer'), 120);

  const response = createLeagueShareCard({
    league,
    kind,
    title,
    subtitle,
    left,
    right,
    footer,
    origin: url.origin,
  });
  response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  return response;
}
