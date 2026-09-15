import { XMLParser } from 'fast-xml-parser';
import { providerTokenEncryptionConfigured } from '@/lib/providers/crypto';
import type { ProviderLeagueSummary, ProviderTeamSummary } from '@/lib/providers/types';

const YAHOO_AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';
const YAHOO_FANTASY_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

export type YahooTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  xoauth_yahoo_guid?: string;
};

type YahooConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return text((value as Record<string, unknown>)['#text']);
  }
  return '';
}

function intValue(value: unknown): number | null {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function truthyYahoo(value: unknown): boolean {
  const normalized = text(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function findFirstText(value: unknown, targetKey: string): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstText(item, targetKey);
      if (found) return found;
    }
    return '';
  }
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  if (targetKey in record) {
    const found = text(record[targetKey]);
    if (found) return found;
  }
  for (const child of Object.values(record)) {
    const found = findFirstText(child, targetKey);
    if (found) return found;
  }
  return '';
}

function collectObjectsWithKey(value: unknown, targetKey: string, output: Array<Record<string, unknown>>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjectsWithKey(item, targetKey, output));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  if (targetKey in record) output.push(record);
  Object.values(record).forEach((child) => collectObjectsWithKey(child, targetKey, output));
}

function collectLeagueObjects(
  value: unknown,
  output: Array<{ league: Record<string, unknown>; seasonHint: number | null; gameKeyHint: string | null }>,
  context: { season: number | null; gameKey: string | null } = { season: null, gameKey: null },
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectLeagueObjects(item, output, context));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  const nextContext = {
    season: intValue(record.season) ?? context.season,
    gameKey: text(record.game_key) || context.gameKey,
  };

  if (text(record.league_key)) {
    output.push({ league: record, seasonHint: nextContext.season, gameKeyHint: nextContext.gameKey });
  }

  Object.values(record).forEach((child) => collectLeagueObjects(child, output, nextContext));
}

function yahooConfigValues(): YahooConfig | null {
  const clientId = process.env.YAHOO_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.YAHOO_CLIENT_SECRET?.trim() || '';
  const redirectUri = process.env.YAHOO_REDIRECT_URI?.trim() || '';
  if (!clientId || !clientSecret || !redirectUri || !providerTokenEncryptionConfigured()) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isYahooConfigured(): boolean {
  return Boolean(yahooConfigValues());
}

export function isYahooFantasyEnabled(): boolean {
  return process.env.YAHOO_FANTASY_ENABLED?.trim().toLowerCase() === 'true';
}

export function isYahooAvailable(): boolean {
  return isYahooConfigured() && isYahooFantasyEnabled();
}

export function buildYahooAuthorizationUrl(state: string): string {
  const config = yahooConfigValues();
  if (!config) throw new Error('Yahoo Fantasy integration is not configured.');

  const url = new URL(YAHOO_AUTH_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('language', 'en-us');
  return url.toString();
}

async function requestYahooToken(body: URLSearchParams): Promise<YahooTokenResponse> {
  const config = yahooConfigValues();
  if (!config) throw new Error('Yahoo Fantasy integration is not configured.');

  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`, 'utf8').toString('base64');
  const response = await fetch(YAHOO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Yahoo OAuth token request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as Partial<YahooTokenResponse>;
  if (!data.access_token || !data.expires_in) {
    throw new Error('Yahoo OAuth response did not include an access token.');
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type || 'bearer',
    xoauth_yahoo_guid: data.xoauth_yahoo_guid,
  };
}

export async function exchangeYahooAuthorizationCode(code: string): Promise<YahooTokenResponse> {
  const config = yahooConfigValues();
  if (!config) throw new Error('Yahoo Fantasy integration is not configured.');
  return requestYahooToken(new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
    code,
  }));
}

export async function refreshYahooAccessToken(refreshToken: string): Promise<YahooTokenResponse> {
  const config = yahooConfigValues();
  if (!config) throw new Error('Yahoo Fantasy integration is not configured.');
  return requestYahooToken(new URLSearchParams({
    grant_type: 'refresh_token',
    redirect_uri: config.redirectUri,
    refresh_token: refreshToken,
  }));
}

async function fetchYahooFantasyXml(path: string, accessToken: string): Promise<string> {
  const response = await fetch(`${YAHOO_FANTASY_BASE}/${path.replace(/^\/+/, '')}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/xml, text/xml;q=0.9',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Yahoo Fantasy API request failed with status ${response.status}.`);
  }
  return response.text();
}

export function parseYahooLeaguesXml(xml: string): ProviderLeagueSummary[] {
  const parsed = parser.parse(xml) as unknown;
  const leagueNodes: Array<{ league: Record<string, unknown>; seasonHint: number | null; gameKeyHint: string | null }> = [];
  collectLeagueObjects(parsed, leagueNodes);

  const seen = new Set<string>();
  const leagues: ProviderLeagueSummary[] = [];
  for (const { league, seasonHint, gameKeyHint } of leagueNodes) {
    const providerLeagueId = text(league.league_key);
    if (!providerLeagueId || seen.has(providerLeagueId)) continue;
    seen.add(providerLeagueId);

    const season = intValue(league.season) ?? seasonHint;
    if (!season) continue;
    const gameKey = text(league.game_key) || gameKeyHint || providerLeagueId.split('.')[0] || null;

    leagues.push({
      provider: 'yahoo',
      providerLeagueId,
      providerGameId: gameKey,
      name: text(league.name) || 'Yahoo Fantasy League',
      season,
      numTeams: intValue(league.num_teams),
      logoUrl: text(league.logo_url) || null,
      isFinished: truthyYahoo(league.is_finished),
      metadata: {
        leagueId: text(league.league_id) || null,
        url: text(league.url) || null,
        draftStatus: text(league.draft_status) || null,
        scoringType: text(league.scoring_type) || null,
        renew: text(league.renew) || null,
        renewed: text(league.renewed) || null,
      },
    });
  }

  return leagues.sort((a, b) => b.season - a.season || a.name.localeCompare(b.name));
}

export function parseYahooTeamsXml(xml: string): ProviderTeamSummary[] {
  const parsed = parser.parse(xml) as unknown;
  const teamNodes: Array<Record<string, unknown>> = [];
  collectObjectsWithKey(parsed, 'team_key', teamNodes);

  const seen = new Set<string>();
  const teams: ProviderTeamSummary[] = [];
  for (const team of teamNodes) {
    const providerTeamId = text(team.team_key);
    if (!providerTeamId || seen.has(providerTeamId)) continue;
    seen.add(providerTeamId);

    const numericTeamId = intValue(team.team_id);
    const managerNodes: Array<Record<string, unknown>> = [];
    collectObjectsWithKey(team.managers, 'manager_id', managerNodes);
    const currentManager = managerNodes.find((manager) => truthyYahoo(manager.is_current_login));
    const primaryManager = currentManager || managerNodes[0];

    teams.push({
      providerTeamId,
      rosterId: numericTeamId ?? teams.length + 1,
      teamName: text(team.name) || `Team ${numericTeamId ?? teams.length + 1}`,
      ownerName: primaryManager ? text(primaryManager.nickname) || `Manager ${numericTeamId ?? teams.length + 1}` : `Manager ${numericTeamId ?? teams.length + 1}`,
      logoUrl: findFirstText(team.team_logos, 'url') || null,
      isCurrentUser: Boolean(currentManager),
      isCommissioner: Boolean(currentManager && truthyYahoo(currentManager.is_commissioner)),
    });
  }

  return teams.sort((a, b) => a.rosterId - b.rosterId);
}

export async function getYahooLeagues(accessToken: string): Promise<ProviderLeagueSummary[]> {
  const xml = await fetchYahooFantasyXml('users;use_login=1/games;game_codes=nfl/leagues', accessToken);
  return parseYahooLeaguesXml(xml);
}

export async function getYahooLeague(accessToken: string, leagueKey: string): Promise<ProviderLeagueSummary | null> {
  const xml = await fetchYahooFantasyXml(`league/${encodeURIComponent(leagueKey)}`, accessToken);
  return parseYahooLeaguesXml(xml).find((league) => league.providerLeagueId === leagueKey) || null;
}

export async function getYahooLeagueTeams(accessToken: string, leagueKey: string): Promise<ProviderTeamSummary[]> {
  const xml = await fetchYahooFantasyXml(`league/${encodeURIComponent(leagueKey)}/teams`, accessToken);
  return parseYahooTeamsXml(xml);
}
