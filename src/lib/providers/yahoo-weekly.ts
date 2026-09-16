import { XMLParser } from 'fast-xml-parser';
import type { FantasyPlayer } from '@/lib/providers/types';

const YAHOO_FANTASY_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, trimValues: true, parseTagValue: false });

export type YahooWeeklyRoster = {
  providerTeamId: string;
  players: FantasyPlayer[];
  starters: string[];
  playerPoints: Record<string, number>;
};

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) return text((value as Record<string, unknown>)['#text']);
  return '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function findFirst(value: unknown, targetKey: string): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirst(item, targetKey);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = asRecord(value);
  if (!record) return undefined;
  if (targetKey in record) return record[targetKey];
  for (const child of Object.values(record)) {
    const found = findFirst(child, targetKey);
    if (found !== undefined) return found;
  }
  return undefined;
}

function collectObjectsWithKey(value: unknown, targetKey: string, output: Array<Record<string, unknown>>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjectsWithKey(item, targetKey, output));
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  if (targetKey in record) output.push(record);
  Object.values(record).forEach((child) => collectObjectsWithKey(child, targetKey, output));
}

function selectedPosition(player: Record<string, unknown>): string | null {
  const value = findFirst(player.selected_position, 'position');
  const position = text(value);
  return position || null;
}

export function parseYahooWeeklyRosterXml(xml: string, providerTeamId: string): YahooWeeklyRoster {
  const parsed = parser.parse(xml) as unknown;
  const nodes: Array<Record<string, unknown>> = [];
  collectObjectsWithKey(parsed, 'player_key', nodes);
  const seen = new Set<string>();
  const players: FantasyPlayer[] = [];
  const starters: string[] = [];
  const playerPoints: Record<string, number> = {};

  for (const player of nodes) {
    const providerPlayerId = text(player.player_key);
    if (!providerPlayerId || seen.has(providerPlayerId)) continue;
    seen.add(providerPlayerId);
    const name = asRecord(player.name) || {};
    const firstName = text(name.first) || null;
    const lastName = text(name.last) || null;
    const fullName = text(name.full) || [firstName, lastName].filter(Boolean).join(' ') || providerPlayerId;
    const slot = selectedPosition(player);
    const upperSlot = (slot || '').toUpperCase();
    const isStarter = Boolean(slot && !['BN', 'IR', 'IR+', 'NA', 'IL', 'DL'].includes(upperSlot));
    const pointsRaw = findFirst(player.player_points, 'total') ?? findFirst(player, 'total');
    const points = Number.parseFloat(text(pointsRaw));

    players.push({
      provider: 'yahoo',
      playerId: providerPlayerId,
      providerPlayerId,
      firstName,
      lastName,
      fullName,
      position: text(player.display_position) || null,
      nflTeam: text(player.editorial_team_abbr) || null,
      selectedPosition: slot,
      isStarter,
    });
    if (isStarter) starters.push(providerPlayerId);
    if (Number.isFinite(points)) playerPoints[providerPlayerId] = points;
  }

  return { providerTeamId, players, starters, playerPoints };
}

export async function getYahooWeeklyRoster(
  accessToken: string,
  providerTeamId: string,
  week: number,
): Promise<YahooWeeklyRoster> {
  const safeWeek = Math.max(1, Math.min(18, Math.trunc(week)));
  const path = `team/${encodeURIComponent(providerTeamId)}/roster;week=${safeWeek}/players/stats;type=week;week=${safeWeek}`;
  const response = await fetch(`${YAHOO_FANTASY_BASE}/${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/xml, text/xml;q=0.9',
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Yahoo weekly roster request failed with status ${response.status}.`);
  return parseYahooWeeklyRosterXml(await response.text(), providerTeamId);
}
