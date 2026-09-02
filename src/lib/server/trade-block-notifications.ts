import { getAllPlayersCached } from '@/lib/utils/sleeper-api';
import type { TradeAsset, TradeWants } from '@/lib/server/trade-block-store';

function assetKey(asset: TradeAsset): string {
  if (asset.type === 'player') return `player:${asset.playerId}`;
  if (asset.type === 'pick') return `pick:${asset.year}:${asset.round}:${asset.originalTeam}`;
  return `faab:${asset.amount ?? 0}`;
}

function ordinal(round: number): string {
  const mod100 = round % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${round}th`;
  if (round % 10 === 1) return `${round}st`;
  if (round % 10 === 2) return `${round}nd`;
  if (round % 10 === 3) return `${round}rd`;
  return `${round}th`;
}

export async function buildTradeBlockWebhookMessage(args: {
  team: string;
  oldBlock: TradeAsset[];
  newBlock: TradeAsset[];
  oldWants: TradeWants | null;
  newWants: TradeWants | null;
}): Promise<string | null> {
  const oldByKey = new Map(args.oldBlock.map((asset) => [assetKey(asset), asset] as const));
  const newByKey = new Map(args.newBlock.map((asset) => [assetKey(asset), asset] as const));
  const added = [...newByKey.entries()].filter(([key]) => !oldByKey.has(key)).map(([, asset]) => asset);
  const removed = [...oldByKey.entries()].filter(([key]) => !newByKey.has(key)).map(([, asset]) => asset);

  let playerNames: Record<string, string> = {};
  const playerIds = [...added, ...removed]
    .filter((asset): asset is Extract<TradeAsset, { type: 'player' }> => asset.type === 'player')
    .map((asset) => asset.playerId);
  if (playerIds.length) {
    try {
      const players = await getAllPlayersCached();
      playerNames = Object.fromEntries(playerIds.map((id) => {
        const row = players[id] as unknown as { full_name?: string; first_name?: string; last_name?: string } | undefined;
        const fallback = [row?.first_name, row?.last_name].filter(Boolean).join(' ');
        return [id, row?.full_name || fallback || id];
      }));
    } catch {
      playerNames = Object.fromEntries(playerIds.map((id) => [id, id]));
    }
  }

  const label = (asset: TradeAsset): string => {
    if (asset.type === 'player') return playerNames[asset.playerId] || asset.playerId;
    if (asset.type === 'pick') return `${asset.year} ${ordinal(asset.round)} (${asset.originalTeam})`;
    return `$${asset.amount ?? 0} FAAB`;
  };

  const lines: string[] = [];
  if (added.length) lines.push(`**Added:** ${added.map(label).join(', ')}`);
  if (removed.length) lines.push(`**Removed:** ${removed.map(label).join(', ')}`);

  const oldText = args.oldWants?.text?.trim() || '';
  const newText = args.newWants?.text?.trim() || '';
  const oldPositions = [...(args.oldWants?.positions || [])].sort().join(',');
  const newPositions = [...(args.newWants?.positions || [])].sort().join(',');
  if (oldText !== newText || oldPositions !== newPositions) {
    const wanted: string[] = [];
    if (newText) wanted.push(newText);
    if (args.newWants?.positions?.length) wanted.push(args.newWants.positions.join(', '));
    lines.push(wanted.length ? `**Looking for:** ${wanted.join(' · ')}` : '**Looking for:** No specific needs listed');
  }

  return lines.length ? lines.join('\n') : null;
}
