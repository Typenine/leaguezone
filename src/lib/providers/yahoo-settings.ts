import { XMLParser } from 'fast-xml-parser';

const YAHOO_FANTASY_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

export type YahooRosterPosition = {
  position: string;
  count: number;
};

export type YahooLeagueSettings = {
  teamCount: number | null;
  playoffTeams: number | null;
  playoffStartWeek: number | null;
  rosterPositions: YahooRosterPosition[];
  scoringSettings: Record<string, number>;
  ppr: number | null;
  superflex: boolean | null;
  usesFaab: boolean;
  waiverBudget: number | null;
  canTradeDraftPicks: boolean;
  draftType: string | null;
};

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return text((value as Record<string, unknown>)['#text']);
  }
  return '';
}

function numberValue(value: unknown): number | null {
  const parsed = Number.parseFloat(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function truthy(value: unknown): boolean {
  const normalized = text(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function collectNamed(value: unknown, key: string, output: Array<Record<string, unknown>>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectNamed(item, key, output);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  if (key in record) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const child = asRecord(item);
        if (child) output.push(child);
      }
    } else {
      const child = asRecord(candidate);
      if (child) output.push(child);
    }
  }
  for (const child of Object.values(record)) collectNamed(child, key, output);
}

function findFirst(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirst(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = asRecord(value);
  if (!record) return undefined;
  if (key in record) return record[key];
  for (const child of Object.values(record)) {
    const found = findFirst(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function scoringKey(name: string): string | null {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (/^passing yards?$/.test(normalized)) return 'pass_yd';
  if (/^passing touchdowns?$/.test(normalized)) return 'pass_td';
  if (/^(interceptions thrown|interceptions)$/.test(normalized)) return 'pass_int';
  if (/^rushing yards?$/.test(normalized)) return 'rush_yd';
  if (/^rushing touchdowns?$/.test(normalized)) return 'rush_td';
  if (/^receptions?$/.test(normalized)) return 'rec';
  if (/^receiving yards?$/.test(normalized)) return 'rec_yd';
  if (/^receiving touchdowns?$/.test(normalized)) return 'rec_td';
  if (/^fumbles lost$/.test(normalized)) return 'fum_lost';
  if (/^(two point conversions|2 point conversions|two point conversion)$/.test(normalized)) return 'bonus_2pt';
  if (/^field goals made/.test(normalized)) return 'fgm';
  if (/^extra points made/.test(normalized)) return 'xpm';
  if (/^sacks?$/.test(normalized)) return 'def_sack';
  if (/^defensive interceptions?$/.test(normalized)) return 'def_int';
  if (/^fumble recoveries$/.test(normalized)) return 'def_fum_rec';
  if (/^(defensive touchdowns?|touchdowns defense special teams)$/.test(normalized)) return 'def_td';
  return null;
}

export function parseYahooLeagueSettingsXml(xml: string): YahooLeagueSettings {
  const parsed = parser.parse(xml) as unknown;

  const rosterNodes: Array<Record<string, unknown>> = [];
  collectNamed(parsed, 'roster_position', rosterNodes);
  const rosterPositions: YahooRosterPosition[] = rosterNodes
    .map((node) => ({
      position: text(node.position),
      count: Math.max(0, Math.trunc(numberValue(node.count) ?? 0)),
    }))
    .filter((row) => row.position && row.count > 0);

  const categoryRoot = findFirst(parsed, 'stat_categories');
  const modifierRoot = findFirst(parsed, 'stat_modifiers');
  const categoryNodes: Array<Record<string, unknown>> = [];
  const modifierNodes: Array<Record<string, unknown>> = [];
  collectNamed(categoryRoot, 'stat', categoryNodes);
  collectNamed(modifierRoot, 'stat', modifierNodes);

  const nameByStatId = new Map<string, string>();
  for (const node of categoryNodes) {
    const id = text(node.stat_id);
    const name = text(node.name) || text(node.display_name);
    if (id && name) nameByStatId.set(id, name);
  }

  const scoringSettings: Record<string, number> = {};
  let ppr: number | null = null;
  for (const node of modifierNodes) {
    const id = text(node.stat_id);
    const value = numberValue(node.value);
    if (!id || value == null) continue;
    const name = nameByStatId.get(id) || '';
    const key = scoringKey(name);
    if (key) scoringSettings[key] = value;
    if (/^receptions?$/i.test(name.trim())) ppr = value;
  }

  const expandedSlots = rosterPositions.flatMap((row) => Array.from({ length: row.count }, () => row.position.toUpperCase()));
  const superflex = expandedSlots.some((slot) => ['Q/W/R/T', 'Q/W/R', 'SUPER_FLEX', 'OP'].includes(slot))
    || expandedSlots.filter((slot) => slot === 'QB').length > 1;

  const budgetCandidates = ['faab_budget', 'waiver_budget', 'waiver_budget_amount'];
  let waiverBudget: number | null = null;
  for (const key of budgetCandidates) {
    const value = numberValue(findFirst(parsed, key));
    if (value != null && value >= 0) {
      waiverBudget = value;
      break;
    }
  }
  const waiverType = text(findFirst(parsed, 'waiver_type')).toLowerCase();
  const usesFaab = truthy(findFirst(parsed, 'uses_faab'))
    || waiverBudget != null
    || waiverType.includes('faab')
    || waiverType.includes('fab');

  return {
    teamCount: numberValue(findFirst(parsed, 'max_teams')) ?? numberValue(findFirst(parsed, 'num_teams')),
    playoffTeams: numberValue(findFirst(parsed, 'num_playoff_teams')),
    playoffStartWeek: numberValue(findFirst(parsed, 'playoff_start_week')),
    rosterPositions,
    scoringSettings,
    ppr,
    superflex,
    usesFaab,
    waiverBudget,
    canTradeDraftPicks: truthy(findFirst(parsed, 'can_trade_draft_picks')),
    draftType: text(findFirst(parsed, 'draft_type')) || null,
  };
}

export async function getYahooLeagueSettings(accessToken: string, leagueKey: string): Promise<YahooLeagueSettings> {
  const response = await fetch(`${YAHOO_FANTASY_BASE}/league/${encodeURIComponent(leagueKey)}/settings`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/xml, text/xml;q=0.9',
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Yahoo Fantasy settings request failed with status ${response.status}.`);
  return parseYahooLeagueSettingsXml(await response.text());
}
