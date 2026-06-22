import { NextRequest } from 'next/server';
import { requireActiveLeagueMembership } from '@/lib/server/membership';
import { readUserDoc, writeUserDoc, TradeAsset, TradeWants } from '@/lib/server/user-store';
import { getTeamAssets } from '@/lib/server/trade-assets';
import { postToDiscordWebhook } from '@/lib/utils/discord';
import { getDiscordWebhooks } from '@/lib/server/league-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let membership;
  try { membership = await requireActiveLeagueMembership(); } catch (e) { return e as Response; }
  const doc = await readUserDoc(membership.userId, membership.teamName, membership.leagueId);
  return Response.json({ tradeBlock: doc.tradeBlock || [], tradeWants: doc.tradeWants || { text: '', positions: [] } });
}

export async function PUT(req: NextRequest) {
  let membership;
  try { membership = await requireActiveLeagueMembership(); } catch (e) { return e as Response; }

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body?.tradeBlock) ? (body.tradeBlock as TradeAsset[]) : null;
  const wants = (body?.tradeWants ?? {}) as TradeWants;
  if (!items) return Response.json({ error: 'tradeBlock array required' }, { status: 400 });

  const assets = await getTeamAssets(membership.teamName, membership.leagueId, membership.rosterId);
  const allowedPickYears = new Set(assets.picks.map((p) => p.year));

  const filtered: TradeAsset[] = [];
  const isPlayer = (x: unknown): x is { type: 'player'; playerId: string } =>
    !!x && typeof x === 'object' && (x as Record<string, unknown>).type === 'player' && typeof (x as Record<string, unknown>).playerId === 'string';
  const isPick = (x: unknown): x is { type: 'pick'; year: number; round: number; originalTeam?: string } => {
    if (!x || typeof x !== 'object') return false;
    const o = x as Record<string, unknown>;
    return o.type === 'pick' && typeof o.year === 'number' && typeof o.round === 'number';
  };
  const isFaab = (x: unknown): x is { type: 'faab'; amount?: number } =>
    !!x && typeof x === 'object' && (x as Record<string, unknown>).type === 'faab';

  for (const it of items.slice(0, 200)) {
    if (isPlayer(it)) {
      if (it.playerId && assets.players.includes(it.playerId)) filtered.push({ type: 'player', playerId: it.playerId });
    } else if (isPick(it)) {
      const { year: yr, round: rd } = it;
      if (Number.isFinite(yr) && allowedPickYears.has(yr) && Number.isFinite(rd) && rd >= 1 && rd <= 10) {
        const reqOrig = typeof (it as { originalTeam?: string }).originalTeam === 'string' ? (it as { originalTeam?: string }).originalTeam : undefined;
        let owned = reqOrig ? assets.picks.find((p) => p.year === yr && p.round === rd && p.originalTeam === reqOrig) : undefined;
        if (!owned) owned = assets.picks.find((p) => p.year === yr && p.round === rd);
        if (owned) filtered.push({ type: 'pick', year: yr, round: rd, originalTeam: owned.originalTeam });
      }
    } else if (isFaab(it)) {
      const amtRaw = (it as Record<string, unknown>).amount;
      const amt = typeof amtRaw === 'number' ? amtRaw : assets.faab;
      const safe = Math.max(0, Math.min(assets.faab, Number.isFinite(amt) ? amt : 0));
      filtered.push({ type: 'faab', amount: safe });
    }
  }

  const doc = await readUserDoc(membership.userId, membership.teamName, membership.leagueId);
  const oldBlock = doc.tradeBlock || [];
  const oldWants = doc.tradeWants || null;

  doc.leagueId = membership.leagueId;
  doc.team = membership.teamName;
  doc.tradeBlock = filtered;
  const pos = Array.isArray(wants.positions) ? wants.positions.map(String).slice(0, 12) : [];
  const text = typeof wants.text === 'string' ? wants.text.slice(0, 300) : undefined;
  const mRaw = typeof wants.contactMethod === 'string' ? wants.contactMethod.toLowerCase() : undefined;
  const allowed = new Set(['text', 'discord', 'snap', 'sleeper']);
  const contactMethod = allowed.has(mRaw as string) ? (mRaw as 'text' | 'discord' | 'snap' | 'sleeper') : undefined;
  let phone: string | undefined;
  let snap: string | undefined;
  if (contactMethod === 'text') {
    const raw = typeof wants.phone === 'string' ? wants.phone : '';
    phone = raw.replace(/[^0-9+]/g, '').slice(0, 20);
  } else if (contactMethod === 'snap') {
    const raw = typeof wants.snap === 'string' ? wants.snap : '';
    snap = raw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 30);
  }
  const newWants: TradeWants = { text, positions: pos, contactMethod, phone, snap };
  doc.tradeWants = newWants;
  doc.version = (doc.version || 0) + 1;
  const updatedAt = new Date().toISOString();
  doc.updatedAt = updatedAt;
  const ok = await writeUserDoc(doc);
  if (!ok) return Response.json({ error: 'Persist failed' }, { status: 500 });

  // Post trade block update to Discord (best-effort)
  try {
    const { computeDiff, buildTradeBlockReport, getTradeBlockBaseUrl, getLeagueMarketContext } = await import('@/lib/server/trade-block-narrative');
    const ownedPlayerSet = new Set(assets.players);
    const ownedPickKeys = new Set(assets.picks.map((p) => `${p.year}-${p.round}-${p.originalTeam}`));
    const sanitizedOldBlock = (oldBlock as TradeAsset[]).filter((a) => {
      if (a.type === 'player') return ownedPlayerSet.has(a.playerId);
      if (a.type === 'pick') return ownedPickKeys.has(`${a.year}-${a.round}-${a.originalTeam ?? ''}`);
      return true;
    });
    const diff = await computeDiff(sanitizedOldBlock, filtered, oldWants as TradeWants | null, newWants);
    const baseUrl = getTradeBlockBaseUrl();
    const leagueContext = await getLeagueMarketContext(membership.leagueId).catch(() => undefined);
    const currentPlayers = filtered.filter((a) => a.type === 'player');
    const message = await buildTradeBlockReport({
      teamName: membership.teamName,
      diff,
      currentPlayers,
      baseUrl,
      updatedAt,
      leagueContext,
    });
    if (message) {
      const { tradeBlock: webhookUrl } = await getDiscordWebhooks(membership.leagueId);
      if (webhookUrl) {
        const tradeBlockUrl = baseUrl ? `${baseUrl}/trades/block` : `${process.env.SITE_URL ?? ''}/l/${membership.leagueSlug}/trade-block`;
        const urlSuffix = `\n\n${tradeBlockUrl}`;
        const descriptionText = message.endsWith(urlSuffix) ? message.slice(0, -urlSuffix.length).trim() : message.trim();
        await postToDiscordWebhook(webhookUrl, {
          embeds: [{
            author: { name: membership.teamName },
            description: descriptionText,
            url: tradeBlockUrl,
            color: 0xbe161e,
            footer: { text: `${membership.leagueName} · Trade Block` },
            timestamp: new Date().toISOString(),
          }],
        }).catch((e) => console.error('Discord webhook error:', e));
      }
    }
  } catch (e) {
    console.error('Trade block webhook error:', e);
  }

  return Response.json({ ok: true, tradeBlock: doc.tradeBlock, tradeWants: doc.tradeWants });
}
