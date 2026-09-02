import { NextRequest } from 'next/server';
import { requireActiveLeagueMembership, type ActiveLeagueMembership } from '@/lib/server/membership';
import {
  getTradeBlockDiscordWebhook,
  getTradeBlockLeagueById,
  listTradeBlockTeams,
  readLeagueTradeBlock,
  writeLeagueTradeBlock,
  type TradeAsset,
  type TradeWants,
} from '@/lib/server/trade-block-store';
import {
  loadTradeBlockLeagueContext,
  sanitizeTradeBlock,
  teamAssetsFromContext,
  TradeBlockProviderError,
} from '@/lib/server/trade-block-provider';
import { buildTradeBlockWebhookMessage } from '@/lib/server/trade-block-notifications';
import { postToDiscordWebhook } from '@/lib/utils/discord';

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
    tradeBlock: doc.tradeBlock,
    tradeWants: doc.tradeWants || { text: '', positions: [] },
  });
}

export async function PUT(req: NextRequest) {
  let membership: ActiveLeagueMembership;
  try {
    membership = await requireTeamMembership();
  } catch (error) {
    return error as Response;
  }

  const league = await getTradeBlockLeagueById(membership.leagueId);
  if (!league) return Response.json({ error: 'League not found.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const requestedBlock = Array.isArray(body?.tradeBlock) ? body.tradeBlock as TradeAsset[] : null;
  if (!requestedBlock) return Response.json({ error: 'tradeBlock array required' }, { status: 400 });
  const wants = (body?.tradeWants ?? {}) as TradeWants;

  let filtered: TradeAsset[];
  try {
    const teams = await listTradeBlockTeams(league.id);
    const ctx = await loadTradeBlockLeagueContext(league, teams);
    const assets = teamAssetsFromContext(membership.teamName, membership.rosterId, ctx);
    filtered = sanitizeTradeBlock(requestedBlock, assets);
  } catch (error) {
    if (error instanceof TradeBlockProviderError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('[me/trade-block] Failed to validate assets', error);
    return Response.json({ error: 'Failed to validate trade-block assets.' }, { status: 500 });
  }

  const oldDoc = await readLeagueTradeBlock({
    leagueId: membership.leagueId,
    userId: membership.userId,
    team: membership.teamName,
  });

  const positions = Array.isArray(wants.positions) ? wants.positions.map(String).slice(0, 12) : [];
  const text = typeof wants.text === 'string' ? wants.text.slice(0, 300) : undefined;
  const rawMethod = typeof wants.contactMethod === 'string' ? wants.contactMethod.toLowerCase() : undefined;
  const allowedMethods = new Set(['text', 'discord', 'snap', 'sleeper']);
  const contactMethod = allowedMethods.has(rawMethod || '')
    ? rawMethod as TradeWants['contactMethod']
    : undefined;
  const phone = contactMethod === 'text' && typeof wants.phone === 'string'
    ? wants.phone.replace(/[^0-9+]/g, '').slice(0, 20)
    : undefined;
  const snap = contactMethod === 'snap' && typeof wants.snap === 'string'
    ? wants.snap.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 30)
    : undefined;
  const newWants: TradeWants = { text, positions, contactMethod, phone, snap };

  let updatedAt: string;
  try {
    updatedAt = await writeLeagueTradeBlock({
      leagueId: membership.leagueId,
      userId: membership.userId,
      team: membership.teamName,
      tradeBlock: filtered,
      tradeWants: newWants,
    });
  } catch (error) {
    console.error('[me/trade-block] Persist failed', error);
    return Response.json({ error: 'Persist failed' }, { status: 500 });
  }

  try {
    const webhookUrl = await getTradeBlockDiscordWebhook(membership.leagueId);
    if (webhookUrl) {
      const message = await buildTradeBlockWebhookMessage({
        team: membership.teamName,
        oldBlock: oldDoc.tradeBlock,
        newBlock: filtered,
        oldWants: oldDoc.tradeWants,
        newWants,
      });
      if (message) {
        const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
        const tradeBlockUrl = siteUrl ? `${siteUrl}/l/${membership.leagueSlug}/trade-block` : undefined;
        await postToDiscordWebhook(webhookUrl, {
          embeds: [{
            author: { name: membership.teamName },
            description: message,
            url: tradeBlockUrl,
            color: 0xbe161e,
            footer: { text: `${membership.leagueName} · Trade Block` },
            timestamp: updatedAt,
          }],
        }).catch((error) => console.error('[me/trade-block] Discord webhook error', error));
      }
    }
  } catch (error) {
    console.error('[me/trade-block] Trade-block notification error', error);
  }

  return Response.json({ ok: true, tradeBlock: filtered, tradeWants: newWants, updatedAt });
}
