import { NextResponse } from 'next/server';
import { GET as getBaseValues } from '../route';
import { getCurrentLeague } from '@/lib/server/league-context';
import type { TradeValue } from '@/lib/types/trade-analyzer';
import { resolveTradeAnalyzerLeagueFormat } from '@/lib/trades/trade-analyzer-format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BaseFormat = {
  superflex?: boolean;
  teamCount?: number;
  ppr?: number;
  key?: string;
  draftRounds?: number;
};

type ValuesPayload = {
  values?: Record<string, TradeValue>;
  format?: BaseFormat;
  count?: number;
  [key: string]: unknown;
};

type MarketPlayer = {
  player?: {
    name?: string;
    sleeperId?: string;
    position?: string;
    maybeTeam?: string;
    maybeAge?: number;
  };
  value?: number;
  overallRank?: number;
  trend30Day?: number;
};

type PickDescriptor = {
  year: string;
  round: number;
  slot: number | null;
  tier: 'Early' | 'Mid' | 'Late' | null;
};

function parsePick(name: string): PickDescriptor | null {
  const value = name.trim();
  const year = value.match(/^\s*(\d{4})\b/)?.[1];
  if (!year) return null;

  const exact = value.match(/\b(\d{1,2})\.(\d{1,2})\b/);
  if (exact) {
    const round = Number(exact[1]);
    const slot = Number(exact[2]);
    if (round > 0 && slot > 0) return { year, round, slot, tier: null };
  }

  const ordinal = value.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)\b/i);
  const roundWord = value.match(/\bround\s*(\d{1,2})\b/i);
  const round = Number(ordinal?.[1] || roundWord?.[1] || 0);
  if (!round) return null;

  const tierMatch = value.match(/\b(early|mid|late)\b/i)?.[1]?.toLowerCase();
  const tier = tierMatch === 'early' ? 'Early' : tierMatch === 'late' ? 'Late' : tierMatch === 'mid' ? 'Mid' : null;
  return { year, round, slot: null, tier };
}

function parsePickFromKey(key: string): PickDescriptor | null {
  const exact = key.match(/^PICK_(\d{4})_(\d{1,2})_(\d{1,2})$/i);
  if (exact) return { year: exact[1], round: Number(exact[2]), slot: Number(exact[3]), tier: null };
  const tier = key.match(/^PICK_(\d{4})_(\d{1,2})_(EARLY|MID|LATE)$/i);
  if (tier) {
    const label = tier[3].toLowerCase();
    return { year: tier[1], round: Number(tier[2]), slot: null, tier: label === 'early' ? 'Early' : label === 'late' ? 'Late' : 'Mid' };
  }
  return null;
}

function pickKey(pick: PickDescriptor): string {
  if (pick.slot != null) return `PICK_${pick.year}_${pick.round}_${String(pick.slot).padStart(2, '0')}`;
  return `PICK_${pick.year}_${pick.round}_${(pick.tier || 'Mid').toUpperCase()}`;
}

function pickName(pick: PickDescriptor): string {
  if (pick.slot != null) return `${pick.year} ${pick.round}.${String(pick.slot).padStart(2, '0')}`;
  const suffix = pick.round === 1 ? 'st' : pick.round === 2 ? 'nd' : pick.round === 3 ? 'rd' : 'th';
  return `${pick.year} ${pick.tier || 'Mid'} ${pick.round}${suffix} · '${pick.year.slice(-2)}`;
}

function inferMaxRound(values: Record<string, TradeValue>): number | null {
  let max = 0;
  for (const [key, value] of Object.entries(values)) {
    if (!value.isPick) continue;
    const parsed = parsePickFromKey(key) || parsePick(value.name);
    if (parsed) max = Math.max(max, parsed.round);
  }
  return max || null;
}

function tierForSlot(slot: number, teamCount: number): 'Early' | 'Mid' | 'Late' {
  const position = (slot - 0.5) / Math.max(1, teamCount);
  if (position <= 1 / 3) return 'Early';
  if (position <= 2 / 3) return 'Mid';
  return 'Late';
}

async function fetchMarketPicks(format: { superflex: boolean; teamCount: number; ppr: number }): Promise<MarketPlayer[]> {
  const url = `https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=${format.superflex ? 2 : 1}&numTeams=${format.teamCount}&ppr=${format.ppr}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'LeagueZoneHQ/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return [];
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows as MarketPlayer[] : [];
}

function marketTradeValue(row: MarketPlayer, pick: PickDescriptor, rankFallback: number): TradeValue | null {
  const value = Number(row.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  const key = pickKey(pick);
  return {
    name: row.player?.name?.trim() || pickName(pick),
    sleeperId: key,
    position: 'PICK',
    team: '',
    age: undefined,
    value: Math.round(value),
    fcValue: Math.round(value),
    ktcValue: null,
    rank: Number.isFinite(Number(row.overallRank)) ? Number(row.overallRank) : rankFallback,
    trend: Number.isFinite(Number(row.trend30Day)) ? Number(row.trend30Day) : 0,
    isPick: true,
  };
}

function mergeSourceValue(existing: TradeValue | undefined, incoming: TradeValue): TradeValue {
  if (!existing) return incoming;
  const fcValue = incoming.fcValue ?? existing.fcValue;
  const ktcValue = existing.ktcValue;
  const value = fcValue != null && ktcValue != null
    ? Math.round((fcValue + ktcValue) / 2)
    : fcValue ?? ktcValue ?? existing.value;
  return { ...existing, name: incoming.name || existing.name, fcValue, value };
}

export async function GET() {
  const baseResponse = await getBaseValues();
  const payload = await baseResponse.json().catch(() => ({})) as ValuesPayload;
  if (!baseResponse.ok || !payload.values) {
    return NextResponse.json(payload, { status: baseResponse.status });
  }

  const activeLeague = await getCurrentLeague().catch(() => null);
  const resolved = await resolveTradeAnalyzerLeagueFormat(activeLeague);
  const baseTeamCount = Number(payload.format?.teamCount || 0);
  const teamCount = resolved.teamCount || (baseTeamCount > 0 ? baseTeamCount : null);
  let draftRounds = resolved.draftRounds || inferMaxRound(payload.values);
  const superflex = resolved.superflex ?? Boolean(payload.format?.superflex);
  const basePpr = Number(payload.format?.ppr ?? 1);
  const ppr = resolved.ppr ?? (Number.isFinite(basePpr) ? basePpr : 1);

  if (!teamCount || !draftRounds) {
    return NextResponse.json({
      ...payload,
      format: { ...payload.format, teamCount: teamCount || payload.format?.teamCount, draftRounds },
    });
  }

  // The legacy value builder historically assumed 12 teams and four rounds.
  // Query FantasyCalc when the league shape differs, or when no provider draft
  // exists yet and the round count needs to be discovered from current market data.
  let marketRows: MarketPlayer[] = [];
  if (teamCount !== 12 || draftRounds !== 4 || resolved.draftRounds == null) {
    marketRows = await fetchMarketPicks({ superflex, teamCount, ppr }).catch(() => []);
  }

  const observedMarketRound = marketRows.reduce((max, row) => {
    const parsed = parsePick(row.player?.name || '');
    return parsed ? Math.max(max, parsed.round) : max;
  }, 0);
  if (!resolved.draftRounds && observedMarketRound > draftRounds) {
    draftRounds = observedMarketRound;
  }

  const values: Record<string, TradeValue> = {};
  for (const [key, value] of Object.entries(payload.values)) {
    if (!value.isPick) {
      values[key] = value;
      continue;
    }
    const parsed = parsePickFromKey(key) || parsePick(value.name);
    if (!parsed) {
      values[key] = value;
      continue;
    }
    if (parsed.round > draftRounds) continue;
    if (parsed.slot != null && parsed.slot > teamCount) continue;
    values[key] = value;
  }

  const exactByYearRound = new Map<string, Array<{ pick: PickDescriptor; value: TradeValue }>>();
  let rankFallback = Object.keys(values).length + 1;
  for (const row of marketRows) {
    const parsed = parsePick(row.player?.name || '');
    if (!parsed) continue;
    if (parsed.round > draftRounds) continue;
    if (parsed.slot != null && parsed.slot > teamCount) continue;
    const incoming = marketTradeValue(row, parsed, rankFallback++);
    if (!incoming) continue;
    const key = incoming.sleeperId;
    values[key] = mergeSourceValue(values[key], incoming);
    if (parsed.slot != null) {
      const groupKey = `${parsed.year}_${parsed.round}`;
      const group = exactByYearRound.get(groupKey) || [];
      group.push({ pick: parsed, value: incoming });
      exactByYearRound.set(groupKey, group);
    }
  }

  // Rebuild Early/Mid/Late FC values from the active league's exact slot count,
  // then retain KTC as the secondary source when it exists.
  for (const [groupKey, group] of exactByYearRound) {
    const [year, roundText] = groupKey.split('_');
    const round = Number(roundText);
    const byTier: Record<'Early' | 'Mid' | 'Late', TradeValue[]> = { Early: [], Mid: [], Late: [] };
    for (const item of group) {
      if (item.pick.slot == null) continue;
      byTier[tierForSlot(item.pick.slot, teamCount)].push(item.value);
    }
    for (const tier of ['Early', 'Mid', 'Late'] as const) {
      if (!byTier[tier].length) continue;
      const fcValue = Math.round(byTier[tier].reduce((sum, value) => sum + (value.fcValue ?? value.value), 0) / byTier[tier].length);
      const descriptor: PickDescriptor = { year, round, slot: null, tier };
      const key = pickKey(descriptor);
      const existing = values[key];
      const incoming: TradeValue = {
        name: pickName(descriptor),
        sleeperId: key,
        position: 'PICK',
        team: '',
        value: fcValue,
        fcValue,
        ktcValue: null,
        rank: existing?.rank ?? rankFallback++,
        trend: existing?.trend ?? 0,
        isPick: true,
      };
      values[key] = mergeSourceValue(existing, incoming);
    }
  }

  return NextResponse.json({
    ...payload,
    values,
    count: Object.keys(values).length,
    format: {
      ...payload.format,
      superflex,
      teamCount,
      ppr,
      draftRounds,
    },
  });
}
