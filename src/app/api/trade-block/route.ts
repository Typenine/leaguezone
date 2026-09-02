import { NextRequest } from 'next/server';
import { requireActiveLeagueMembership, type ActiveLeagueMembership } from '@/lib/server/membership';
import { readLeagueTradeBlock, writeLeagueTradeBlock } from '@/lib/server/trade-block-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireTeamMembership(): Promise<ActiveLeagueMembership> {
  const membership = await requireActiveLeagueMembership();
  if (!membership.teamName) {
    throw Response.json({ error: 'A team membership is required.' }, { status: 403 });
  }
  return membership;
}

export async function GET() {
  let membership: ActiveLeagueMembership;
  try {
    membership = await requireTeamMembership();
  } catch (error) {
    return error as Response;
  }

  const doc = await readLeagueTradeBlock({
    leagueId: membership.leagueId,
    userId: membership.userId,
    team: membership.teamName,
  });
  return Response.json({
    team: membership.teamName,
    wants: doc.tradeWants?.text || '',
    offers: doc.tradeWants?.offers || '',
    updatedAt: doc.updatedAt || new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  let membership: ActiveLeagueMembership;
  try {
    membership = await requireTeamMembership();
  } catch (error) {
    return error as Response;
  }

  const body = await req.json().catch(() => ({}));
  const wants = typeof body.wants === 'string' ? body.wants.slice(0, 300) : '';
  const offers = typeof body.offers === 'string' ? body.offers.slice(0, 1000) : '';
  const existing = await readLeagueTradeBlock({
    leagueId: membership.leagueId,
    userId: membership.userId,
    team: membership.teamName,
  });
  const updatedAt = await writeLeagueTradeBlock({
    leagueId: membership.leagueId,
    userId: membership.userId,
    team: membership.teamName,
    tradeBlock: existing.tradeBlock,
    tradeWants: { ...(existing.tradeWants || {}), text: wants, offers },
  });

  return Response.json({ team: membership.teamName, wants, offers, updatedAt });
}
