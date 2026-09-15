import { XMLParser } from 'fast-xml-parser';

const YAHOO_FANTASY_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, trimValues: true, parseTagValue: false });

export type ProviderDraftResult = {
  pick: number;
  round: number;
  providerTeamId: string;
  providerPlayerId: string;
  teamName: string | null;
  playerName: string | null;
};

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) return text((value as Record<string, unknown>)['#text']);
  return '';
}
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function collectNamed(value: unknown, key: string, output: Array<Record<string, unknown>>): void {
  if (Array.isArray(value)) { value.forEach((item) => collectNamed(item, key, output)); return; }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (key in record) {
    const candidate = record[key];
    if (Array.isArray(candidate)) candidate.forEach((item) => { const r = asRecord(item); if (r) output.push(r); });
    else { const r = asRecord(candidate); if (r) output.push(r); }
  }
  Object.values(record).forEach((child) => collectNamed(child, key, output));
}

export function parseYahooDraftResultsXml(xml: string): ProviderDraftResult[] {
  const parsed = parser.parse(xml) as unknown;
  const nodes: Array<Record<string, unknown>> = [];
  collectNamed(parsed, 'draft_result', nodes);
  const results: ProviderDraftResult[] = [];
  for (const node of nodes) {
    const pick = Number.parseInt(text(node.pick), 10);
    const round = Number.parseInt(text(node.round), 10);
    const providerTeamId = text(node.team_key);
    const providerPlayerId = text(node.player_key);
    if (!Number.isFinite(pick) || !Number.isFinite(round) || !providerTeamId || !providerPlayerId) continue;
    results.push({
      pick,
      round,
      providerTeamId,
      providerPlayerId,
      teamName: text(node.team_name) || null,
      playerName: text(node.player_name) || null,
    });
  }
  return results.sort((a, b) => a.pick - b.pick);
}

export async function getYahooLeagueDraftResults(accessToken: string, leagueKey: string): Promise<ProviderDraftResult[]> {
  const response = await fetch(`${YAHOO_FANTASY_BASE}/league/${encodeURIComponent(leagueKey)}/draftresults`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/xml, text/xml;q=0.9' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Yahoo draft results request failed with status ${response.status}.`);
  return parseYahooDraftResultsXml(await response.text());
}
