import { XMLParser } from 'fast-xml-parser';
import type {
  FantasyMatchup,
  FantasyPlayer,
  FantasyTeamData,
  FantasyTransaction,
  YahooRosterSnapshot,
} from '@/lib/providers/types';

const YAHOO_FANTASY_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, trimValues: true, parseTagValue: false });

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) return text((value as Record<string, unknown>)['#text']);
  return '';
}
function asRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function intValue(value: unknown): number | null { const parsed = Number.parseInt(text(value), 10); return Number.isFinite(parsed) ? parsed : null; }
function numberValue(value: unknown): number { const parsed = Number.parseFloat(text(value)); return Number.isFinite(parsed) ? parsed : 0; }
function findFirstText(value: unknown, targetKey: string): string {
  if (Array.isArray(value)) { for (const item of value) { const found = findFirstText(item, targetKey); if (found) return found; } return ''; }
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (targetKey in record) { const found = text(record[targetKey]); if (found) return found; }
  for (const child of Object.values(record)) { const found = findFirstText(child, targetKey); if (found) return found; }
  return '';
}
function collectObjectsWithKey(value: unknown, targetKey: string, output: Array<Record<string, unknown>>): void {
  if (Array.isArray(value)) { value.forEach((item) => collectObjectsWithKey(item, targetKey, output)); return; }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (targetKey in record) output.push(record);
  Object.values(record).forEach((child) => collectObjectsWithKey(child, targetKey, output));
}
function collectNamedRecords(value: unknown, targetKey: string, output: Array<Record<string, unknown>>): void {
  if (Array.isArray(value)) { value.forEach((item) => collectNamedRecords(item, targetKey, output)); return; }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (targetKey in record) {
    const candidate = record[targetKey];
    if (Array.isArray(candidate)) for (const item of candidate) { const itemRecord = asRecord(item); if (itemRecord) output.push(itemRecord); }
    else { const candidateRecord = asRecord(candidate); if (candidateRecord) output.push(candidateRecord); }
  }
  Object.values(record).forEach((child) => collectNamedRecords(child, targetKey, output));
}
function teamNumberFromKey(teamKey: string): number | null { const match = teamKey.match(/\.t\.(\d+)(?:$|\.)/); return match ? Number.parseInt(match[1], 10) : null; }
function managerIdentity(team: Record<string, unknown>): { ownerId: string; ownerName: string | null } {
  const managers: Array<Record<string, unknown>> = []; collectObjectsWithKey(team.managers, 'manager_id', managers);
  const manager = managers[0]; const fallback = text(team.team_key) || text(team.team_id) || 'unknown';
  return { ownerId: manager ? text(manager.manager_id) || fallback : fallback, ownerName: manager ? text(manager.nickname) || null : null };
}
async function fetchYahooFantasyXml(path: string, accessToken: string): Promise<string> {
  const response = await fetch(`${YAHOO_FANTASY_BASE}/${path.replace(/^\/+/, '')}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/xml, text/xml;q=0.9' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Yahoo Fantasy API request failed with status ${response.status}.`);
  return response.text();
}

export function parseYahooStandingsXml(xml: string): { teams: FantasyTeamData[]; streaks: Record<number, { type: 'W' | 'L' | 'T' | null; length: number }> } {
  const parsed = parser.parse(xml) as unknown; const teamNodes: Array<Record<string, unknown>> = []; collectObjectsWithKey(parsed, 'team_key', teamNodes);
  const seen = new Set<string>(); const teams: FantasyTeamData[] = []; const streaks: Record<number, { type: 'W' | 'L' | 'T' | null; length: number }> = {};
  for (const team of teamNodes) {
    const providerTeamId = text(team.team_key); const standings = asRecord(team.team_standings);
    if (!providerTeamId || !standings || seen.has(providerTeamId)) continue; seen.add(providerTeamId);
    const rosterId = intValue(team.team_id) ?? teamNumberFromKey(providerTeamId) ?? teams.length + 1; const manager = managerIdentity(team);
    const outcomes = asRecord(standings.outcome_totals) || {}; const streak = asRecord(standings.streak) || {}; const streakRaw = text(streak.type).toLowerCase();
    const streakType = streakRaw.startsWith('win') ? 'W' : streakRaw.startsWith('loss') ? 'L' : streakRaw.startsWith('tie') ? 'T' : null;
    teams.push({ providerTeamId, rosterId, teamName: text(team.name) || `Team ${rosterId}`, ownerId: manager.ownerId, ownerName: manager.ownerName, logoUrl: findFirstText(team.team_logos, 'url') || null, wins: intValue(outcomes.wins) ?? 0, losses: intValue(outcomes.losses) ?? 0, ties: intValue(outcomes.ties) ?? 0, fpts: numberValue(standings.points_for), fptsAgainst: numberValue(standings.points_against), players: [] });
    streaks[rosterId] = { type: streakType, length: intValue(streak.value) ?? 0 };
  }
  return { teams: teams.sort((a, b) => a.rosterId - b.rosterId), streaks };
}

export function parseYahooRosterXml(xml: string, providerTeamId: string): YahooRosterSnapshot {
  const parsed = parser.parse(xml) as unknown; const playerNodes: Array<Record<string, unknown>> = []; collectObjectsWithKey(parsed, 'player_key', playerNodes);
  const seen = new Set<string>(); const players: FantasyPlayer[] = [];
  for (const player of playerNodes) {
    const providerPlayerId = text(player.player_key); if (!providerPlayerId || seen.has(providerPlayerId)) continue; seen.add(providerPlayerId);
    const name = asRecord(player.name) || {}; const firstName = text(name.first) || null; const lastName = text(name.last) || null; const fullName = text(name.full) || [firstName, lastName].filter(Boolean).join(' ') || providerPlayerId;
    const selectedPosition = findFirstText(player.selected_position, 'position') || null; const selected = (selectedPosition || '').toUpperCase();
    players.push({ provider: 'yahoo', playerId: providerPlayerId, providerPlayerId, firstName, lastName, fullName, position: text(player.display_position) || null, nflTeam: text(player.editorial_team_abbr) || null, selectedPosition, isStarter: Boolean(selectedPosition && !['BN', 'IR', 'IR+', 'NA'].includes(selected)) });
  }
  return { providerTeamId, rosterId: teamNumberFromKey(providerTeamId) ?? 0, players };
}

function scoreboardTeam(team: Record<string, unknown>): FantasyMatchup['teams'][number] | null {
  const providerTeamId = text(team.team_key); const rosterId = intValue(team.team_id) ?? teamNumberFromKey(providerTeamId); if (!providerTeamId || !rosterId) return null;
  return { providerTeamId, rosterId, teamName: text(team.name) || `Team ${rosterId}`, points: numberValue(findFirstText(team.team_points, 'total')), starters: [], players: [], playerPoints: {} };
}
export function parseYahooScoreboardXml(xml: string, season: string, week: number): FantasyMatchup[] {
  const parsed = parser.parse(xml) as unknown; const matchupNodes: Array<Record<string, unknown>> = []; collectNamedRecords(parsed, 'matchup', matchupNodes); const pairs: FantasyMatchup['teams'][] = [];
  for (const matchup of matchupNodes) {
    const nodes: Array<Record<string, unknown>> = []; collectObjectsWithKey(matchup, 'team_key', nodes); const unique = new Map<string, Record<string, unknown>>();
    for (const team of nodes) { const key = text(team.team_key); if (key && !unique.has(key)) unique.set(key, team); }
    const teams = Array.from(unique.values()).map(scoreboardTeam).filter((team): team is FantasyMatchup['teams'][number] => Boolean(team)); if (teams.length >= 2) pairs.push(teams.slice(0, 2));
  }
  pairs.sort((a, b) => { const aa = a.map((team) => team.rosterId).sort((x, y) => x - y); const bb = b.map((team) => team.rosterId).sort((x, y) => x - y); return (aa[0] - bb[0]) || (aa[1] - bb[1]); });
  return pairs.map((teams, index) => ({ provider: 'yahoo', season, week, matchupId: index + 1, teams }));
}

function transactionPlayer(player: Record<string, unknown>) {
  const playerId = text(player.player_key) || text(player.player_id); const name = asRecord(player.name) || {};
  return { playerId, name: text(name.full) || [text(name.first), text(name.last)].filter(Boolean).join(' ') || playerId || null, position: text(player.display_position) || null, nflTeam: text(player.editorial_team_abbr) || null };
}
export function parseYahooTransactionsXml(xml: string, season: string): FantasyTransaction[] {
  const parsed = parser.parse(xml) as unknown; const nodes: Array<Record<string, unknown>> = []; collectNamedRecords(parsed, 'transaction', nodes); const seen = new Set<string>(); const output: FantasyTransaction[] = [];
  for (const transaction of nodes) {
    const id = text(transaction.transaction_key) || text(transaction.transaction_id); if (!id || seen.has(id)) continue; seen.add(id);
    const status = text(transaction.status).toLowerCase(); if (status && !['successful', 'complete', 'completed'].includes(status)) continue;
    const rawType = text(transaction.type).toLowerCase(); const faab = numberValue(transaction.faab_bid); const players: Array<Record<string, unknown>> = []; collectObjectsWithKey(transaction.players, 'player_key', players);
    const added: FantasyTransaction['added'] = []; const dropped: FantasyTransaction['dropped'] = []; const teamNames = new Set<string>(); let primaryRosterId = 0; let waiver = false;
    for (const player of players) {
      const base = transactionPlayer(player); if (!base.playerId) continue; const dataNodes: Array<Record<string, unknown>> = []; collectNamedRecords(player, 'transaction_data', dataNodes);
      for (const data of dataNodes) {
        const movement = text(data.type).toLowerCase(); if (text(data.source_type).toLowerCase().includes('waiver')) waiver = true;
        const sourceName = text(data.source_team_name); const destinationName = text(data.destination_team_name); const sourceRoster = teamNumberFromKey(text(data.source_team_key)) ?? 0; const destinationRoster = teamNumberFromKey(text(data.destination_team_key)) ?? 0;
        if (sourceName) teamNames.add(sourceName); if (destinationName) teamNames.add(destinationName); if (!primaryRosterId) primaryRosterId = destinationRoster || sourceRoster;
        if (movement === 'add' || movement === 'trade') added.push({ ...base, name: rawType === 'trade' && destinationName && base.name ? `${base.name} (to ${destinationName})` : base.name });
        if (movement === 'drop' || movement === 'trade') dropped.push({ ...base, name: rawType === 'trade' && sourceName && base.name ? `${base.name} (from ${sourceName})` : base.name });
      }
    }
    if (added.length === 0 && dropped.length === 0) continue;
    const type: FantasyTransaction['type'] = rawType === 'trade' ? 'trade' : waiver || faab > 0 ? 'waiver' : 'free_agent'; const teamsInvolved = Array.from(teamNames); const seconds = Number.parseInt(text(transaction.timestamp), 10);
    output.push({ id, type, season, week: intValue(transaction.week) ?? 0, created: Number.isFinite(seconds) ? seconds * 1000 : 0, team: type === 'trade' ? teamsInvolved.join(' · ') || 'Trade' : teamsInvolved[0] || 'Team', teamsInvolved, rosterId: primaryRosterId, added, dropped, faab, metadata: { yahooType: rawType || null } });
  }
  return output.sort((a, b) => b.created - a.created);
}

export async function getYahooLeagueStandings(accessToken: string, leagueKey: string) { return parseYahooStandingsXml(await fetchYahooFantasyXml(`league/${encodeURIComponent(leagueKey)}/standings`, accessToken)); }
export async function getYahooTeamRoster(accessToken: string, teamKey: string): Promise<YahooRosterSnapshot> { return parseYahooRosterXml(await fetchYahooFantasyXml(`team/${encodeURIComponent(teamKey)}/roster`, accessToken), teamKey); }
export async function getYahooLeagueScoreboard(accessToken: string, leagueKey: string, season: string, week: number): Promise<FantasyMatchup[]> { return parseYahooScoreboardXml(await fetchYahooFantasyXml(`league/${encodeURIComponent(leagueKey)}/scoreboard;week=${week}`, accessToken), season, week); }
export async function getYahooLeagueTransactions(accessToken: string, leagueKey: string, season: string): Promise<FantasyTransaction[]> { return parseYahooTransactionsXml(await fetchYahooFantasyXml(`league/${encodeURIComponent(leagueKey)}/transactions`, accessToken), season); }
