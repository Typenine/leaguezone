import { NextRequest, NextResponse } from 'next/server';
import { validLeagueId } from '@/lib/server/sleeper-research';
import {deriveTradeValueFormat} from '@/lib/fantasy/trade-value-format';
import type { TradeValue } from '@/lib/types/trade-analyzer';
import { getObjectText } from '@/server/storage/r2';
import { getCurrentLeague } from '@/lib/server/league-context';
import { getLeague } from '@/lib/utils/sleeper-api';

const KTC_R2_KEY = 'trade-analyzer/ktc.json';
const KTC_R2_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- Types ---

interface FantasyCalcPlayer {
  player: {
    id: number;
    name: string;
    sleeperId?: string;
    position?: string;
    maybeTeam?: string;
    maybeAge?: number;
  };
  value: number;
  overallRank: number;
  positionRank: number;
  trend30Day?: number;
}

interface KTCPlayer {
  playerName: string;
  position: string;
  team: string;
  age?: number;
  value: number; // superflex value (from KTC's window.playersArray via scripts/refresh-ktc.ts)
}

export type { TradeValue };

// --- Cache ---

interface ValueSources { fantasyCalc: boolean; keepTradeCut: boolean; fcCount: number; ktcCount: number; ktcMatched: number; ktcMatchRate: number }
type ValueFormat = { superflex: boolean; teamCount: number; ppr: number; key: string };
const cache = new Map<string, { ts: number; data: Record<string, TradeValue>; sources: ValueSources }>();
const CACHE_TTL = 6 * 60 * 60 *¶»§q«^