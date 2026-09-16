/**
 * Server-side league news endpoint.
 * League rosters come from LeagueZone's normalized provider layer. Sleeper's
 * player catalog is used only as a shared NFL identity/news-matching source.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllRss, RssItem } from '@/lib/feeds/rss-fetcher';
import { RSS_SOURCES, SourceProfile } from '@/lib/feeds/rss-sources';
import { getAllPlayersCached, type SleeperPlayer } from '@/lib/utils/sleeper-api';
import { getCurrentLeague, getLeagueBySlug } from '@/lib/server/league-context';
import { getFantasyRosters } from '@/lib/server/fantasy-data';
import { mapFantasyPlayersToSleeper } from '@/lib/server/provider-player-map';
import {
  classifyStory,
  isListicleOrRoundup,
  isWatchOrTVGuide,
  isBettingContent,
  normalizeText,
  type StoryCategory,
} from '@/lib/news/news-classifier';
import { getHomepagePhase, type HomepagePhase } from '@/lib/utils/countdown-resolver';
import {
  escapeRegExp,
  canonicalizeUrl,
  containsPhrase,
  stripSuffixes,
  NICKNAMES,
} from '@/lib/news/news-matching';
import { getNewsModerationRules, type NewsModerationRule } from '@/server/db/news-moderation-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
export type { StoryCategory };

const CATEGORY_PHASE_BOOST: Record<HomepagePhase, Partial<Record<StoryCategory, number>>> = {
  post_championship_pre_draft: { trade: 0.4, nfl_transaction: 0.4, contract: 0.3, retirement: 0.3, trade_rumor: 0.2, injury: 0.1 },
  post_draft_pre_fa: { nfl_transaction: 0.4, rookie_development: 0.3, trade: 0.3, depth_chart_role: 0.2, contract: 0.2 },
  fa_open_pre_season: { nfl_transaction: 0.4, depth_chart_role: 0.3, rookie_development: 0.2, trade: 0.2, injury: 0.2 },
  regular_season: { injury: 0.5, practice_availability: 0.5, performance: 0.3, nfl_transaction: 0.2, depth_chart_role: 0.2 },
  post_deadline_pre_postseason: { injury: 0.4, practice_availability: 0.4, performance: 0.2 },
  postseason: { injury: 0.6, practice_availability: 0.6, performance: 0.3 },
};

const SOURCE_PROFILE_MAP = new Map<string, SourceProfile>(RSS_SOURCES.map((source) => [source.id, source.profile]));
const SOURCE_WEIGHT_MAP = new Map<string, number>(RSS_SOURCES.map((source) => [source.id, source.weight]));

type MatchType = 'full' | 'alias' | 'initial';
type MatchConfidence = 'high' | 'medium' | 'low';
type LeagueNewsMatch = { playerId: string; name: string; position?: string; nflTeam?: string; evTeam?: string; evTeamSlug?: string; matchType?: MatchType; confidence?: MatchConfidence };
export type LeagueNewsItem = RssItem & { matches: LeagueNewsMatch[]; category: StoryCategory; score?: number; alsoReportedBy?: string[] };
export type LeagueNewsResponse = { generatedAt: string; count: number; sinceHours: number; items: LeagueNewsItem[] };

type ModerationCache = { ts: number; rules: NewsModerationRule[] };
const moderationCache = new Map<string, ModerationCache>();
const MODERATION_CACHE_TTL_MS = 0;
async function getModerationRules(leagueId: string): Promise<NewsModerationRule[]> {
  const cached = moderationCache.get(leagueId);
  if (cached && Date.now() - cached.ts < MODERATION_CACHE_TTL_MS) return cached.rules;
  const rules = await getNewsModerationRules(leagueId).catch(() => []);
  moderationCache.set(leagueId, { ts: Date.now(), rules });
  return rules;
}

type RosterCache = { ts: number; playerToTeam: Map<string, string>; playerToTeamSlug: Map<string, string>; allPlayerIds: string[] };
const rosterCache = new Map<string, RosterCache>();
const ROSTER_CACHE_TTL_MS = 5 * 60 * 1000;

async function getLeagueRosterMaps(leagueId: string): Promise<RosterCache> {
  const cached = rosterCache.get(leagueId);
  if (cached && Date.now() - cached.ts < ROSTER_CACHE_TTL_MS) return cached;
  const rosters = await getFantasyRosters(leagueId);
  const mappedPlayers = await mapFantasyPlayersToSleeper(Object.values(rosters.players)).catch(() => ({
    providerToSleeper: {} as Record<string, string>,
    sleeperToProvider: {} as Record<string, string>,
    sleeperPlayers: {} as Record<string, SleeperPlayer>,
  }));
  const playerToTeam = new Map<string, string>();
  const playerToTeamSlug = new Map<string, string>();
  const playerIdSet = new Set<string>();
  for (const team of rosters.teams) {
    const slug = team.teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    for (const providerPlayerId of team.players || []) {
      const newsPlayerId = rosters.provider === 'sleeper' ? providerPlayerId : mappedPlayers.providerToSleeper[providerPlayerId];
      if (!newsPlayerId) continue;
      playerToTeam.set(newsPlayerId, team.teamName);
      playerToTeamSlug.set(newsPlayerId, slug);
      playerIdSet.add(newsPlayerId);
    }
  }
  const next = { ts: Date.now(), playerToTeam, playerToTeamSlug, allPlayerIds: Array.from(playerIdSet) };
  rosterCache.set(leagueId, next);
  return next;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const explicitSlug = searchParams.get('league')?.trim();
    const league = explicitSlug ? await getLeagueBySlug(explicitSlug) : await getCurrentLeague();
    if (!league) return NextResponse.json({ error: 'No active league selected' }, { status: 400 });
    const limit = clamp(Math.floor(Number(searchParams.get('limit')) || 30), 1, 100);
    const sinceHours = clamp(Math.floor(Number(searchParams.get('sinceHours')) || 168), 1, 24 * 90);
    const hideLowConfidence = searchParams.get('hideLow') !== 'false';
    const teamFilter = searchParams.get('teamFilter') ?? null;

    const [{ playerToTeam, playerToTeamSlug, allPlayerIds }, playersIndex, moderationRules] = await Promise.all([
      getLeagueRosterMaps(league.id),
      getAllPlayersCached(12 * 60 * 60 * 1000) as Promise<Record<string, SleeperPlayer>>,
      getModerationRules(league.id),
    ]);

    const hiddenUrls = new Set<string>();
    const blockedMatches = new Set<string>();
    const blockedHeadlines: string[] = [];
    for (const rule of moderationRules) {
      if (rule.type === 'hide_url') hiddenUrls.add(rule.value);
      else if (rule.type === 'block_match') blockedMatches.add(rule.value);
      else if (rule.type === 'block_headline') blockedHeadlines.push(rule.value.toLowerCase());
    }

    const activePlayerIds = teamFilter ? allPlayerIds.filter((id) => playerToTeam.get(id) === teamFilter) : allPlayerIds;
    const selectedPlayers = activePlayerIds
      .map((id) => { const player = playersIndex[id]; return player ? { id, player } : null; })
      .filter(Boolean) as Array<{ id: string; player: SleeperPlayer }>;

    if (!selectedPlayers.length) {
      return NextResponse.json({ generatedAt: new Date().toISOString(), count: 0, sinceHours, items: [] } satisfies LeagueNewsResponse);
    }

    const matchers = selectedPlayers.map(({ id, player }) => {
      const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
      const fullNoSuffix = stripSuffixes(fullName);
      const parts = fullNoSuffix.split(' ');
      const firstNorm = normalizeText(parts[0] || '');
      const lastNorm = normalizeText(parts.slice(1).join(' ') || '');
      const fullRe = new RegExp(`\\b${escapeRegExp(fullName)}\\b`, 'i');
      const aliasNorms = (NICKNAMES[firstNorm] || []).map((nick) => `${normalizeText(nick)} ${lastNorm}`);
      const compactFirst = firstNorm.replace(/\s+/g, '');
      if (compactFirst.length >= 2 && compactFirst.length <= 3) aliasNorms.push(`${compactFirst} ${lastNorm}`);
      const initialLastNorm = firstNorm ? `${firstNorm[0]} ${lastNorm}` : '';
      return {
        id,
        name: fullName,
        fullRe,
        aliasNorms,
        initialLastNorm,
        isDst: ['DST', 'DEF'].includes((player.position || '').toUpperCase()),
        firstTokenRe: firstNorm ? new RegExp(`\\b${escapeRegExp(firstNorm)}\\b`, 'i') : null,
        lastTokenRe: lastNorm ? new RegExp(`\\b${escapeRegExp(lastNorm)}\\b`, 'i') : null,
        teamCodeRe: player.team ? new RegExp(`\\b${escapeRegExp(player.team)}\\b`, 'i') : null,
        position: player.position,
        nflTeam: player.team,
        evTeam: playerToTeam.get(id),
        evTeamSlug: playerToTeamSlug.get(id),
      };
    });

    const allItems = await fetchAllRss();
    const cutoff = Date.now() - sinceHours * 60 * 60 * 1000;
    type ScoredItem = LeagueNewsItem & { score: number; alsoReportedBy: string[] };
    const byKey = new Map<string, ScoredItem>();
    const now = Date.now();
    const phaseBoosts = CATEGORY_PHASE_BOOST[getHomepagePhase(new Date())];

    for (const item of allItems) {
      const title = item.title || '';
      if (isWatchOrTVGuide(title, item.description) || isBettingContent(title, item.description)) continue;
      const profile = SOURCE_PROFILE_MAP.get(item.sourceId) ?? 'broad_news';
      const isBroadSource = profile === 'broad_news' || profile === 'major_news';
      if (isBroadSource && isListicleOrRoundup(title)) continue;
      const hay = `${title} ${item.description}`;
      const hayNorm = normalizeText(hay);
      const matches: LeagueNewsMatch[] = [];

      for (const matcher of matchers) {
        let matchedType: MatchType | null = null;
        let confidence: MatchConfidence = 'low';
        if (matcher.isDst) {
          if (matcher.fullRe.test(title) || matcher.lastTokenRe?.test(title) || matcher.firstTokenRe?.test(title) || matcher.teamCodeRe?.test(title)) { matchedType = 'full'; confidence = 'high'; }
        } else if (profile === 'player_news' || profile === 'transaction_news' || profile === 'official_news') {
          if (matcher.fullRe.test(hay)) { matchedType = 'full'; confidence = matcher.fullRe.test(title) ? 'high' : 'medium'; }
          else if (matcher.aliasNorms.some((alias) => containsPhrase(hayNorm, alias)) && matcher.lastTokenRe?.test(title)) { matchedType = 'alias'; confidence = 'medium'; }
          else if (matcher.initialLastNorm && containsPhrase(hayNorm, matcher.initialLastNorm) && matcher.lastTokenRe?.test(title)) { matchedType = 'initial'; confidence = 'low'; }
        } else {
          if (matcher.fullRe.test(title)) { matchedType = 'full'; confidence = 'high'; }
          else if (matcher.fullRe.test(hay) && matcher.lastTokenRe?.test(title)) { matchedType = 'full'; confidence = 'medium'; }
          else if (matcher.aliasNorms.some((alias) => containsPhrase(hayNorm, alias)) && matcher.lastTokenRe?.test(title)) { matchedType = 'alias'; confidence = 'low'; }
        }
        if (matchedType) matches.push({ playerId: matcher.id, name: matcher.name, position: matcher.position, nflTeam: matcher.nflTeam, evTeam: matcher.evTeam, evTeamSlug: matcher.evTeamSlug, matchType: matchedType, confidence });
      }

      if (!matches.length || matches.length >= 5) continue;
      const ts = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
      if (!(ts === 0 || ts >= cutoff)) continue;
      if (hideLowConfidence && isBroadSource && matches.every((match) => match.confidence === 'low')) continue;

      const sourceWeight = SOURCE_WEIGHT_MAP.get(item.sourceId) ?? 1;
      const hours = ts > 0 ? (now - ts) / 3_600_000 : 1e9;
      const recency = Math.max(0, 1.5 - hours / 48);
      let bestQuality = 0;
      for (const match of matches) bestQuality = Math.max(bestQuality, match.confidence === 'high' ? 0.6 : match.confidence === 'medium' ? 0.4 : 0.2);
      const headlineBoost = matches.some((match) => {
        const selected = selectedPlayers.find((candidate) => candidate.id === match.playerId);
        return selected ? new RegExp(`\\b${escapeRegExp(`${selected.player.first_name} ${selected.player.last_name}`)}\\b`, 'i').test(title) : false;
      }) ? 0.3 : 0;
      const category = classifyStory(title, item.description);
      const score = sourceWeight + recency + bestQuality + headlineBoost + (phaseBoosts[category] ?? 0);
      const linkKey = canonicalizeUrl(item.link);
      const key = linkKey || `t:${normalizeText(item.title || '')}`;
      if (hiddenUrls.has(linkKey ?? '') || hiddenUrls.has(item.link ?? '')) continue;
      if (blockedHeadlines.some((headline) => normalizeText(title).includes(headline))) continue;
      const effectiveMatches = matches.filter((match) => !blockedMatches.has(match.playerId) && !(linkKey && blockedMatches.has(`${match.playerId}:${linkKey}`)));
      if (!effectiveMatches.length) continue;

      const previous = byKey.get(key);
      if (!previous) {
        byKey.set(key, { ...item, matches: effectiveMatches, category, score, alsoReportedBy: [] });
        continue;
      }
      const merged = new Map(previous.matches.map((match) => [match.playerId, match] as const));
      for (const match of effectiveMatches) if (!merged.has(match.playerId)) merged.set(match.playerId, match);
      const newerPublished = (item.publishedAt ? Date.parse(item.publishedAt) : 0) > (previous.publishedAt ? Date.parse(previous.publishedAt) : 0) ? item.publishedAt : previous.publishedAt;
      if (score >= previous.score) {
        byKey.set(key, { ...item, publishedAt: newerPublished, matches: [...merged.values()], category, score, alsoReportedBy: [...new Set([...previous.alsoReportedBy, previous.sourceName])].filter((source) => source !== item.sourceName) });
      } else {
        byKey.set(key, { ...previous, publishedAt: newerPublished, matches: [...merged.values()], alsoReportedBy: [...new Set([...previous.alsoReportedBy, item.sourceName])].filter((source) => source !== previous.sourceName) });
      }
    }

    const byTitle = new Map<string, ScoredItem>();
    for (const item of byKey.values()) {
      const titleKey = normalizeText(item.title || '') || `__notitle__:${item.link}`;
      const previous = byTitle.get(titleKey);
      if (!previous) { byTitle.set(titleKey, item); continue; }
      const merged = new Map(previous.matches.map((match) => [match.playerId, match] as const));
      for (const match of item.matches) if (!merged.has(match.playerId)) merged.set(match.playerId, match);
      const [winner, loser] = item.score >= previous.score ? [item, previous] : [previous, item];
      const newerPublished = (item.publishedAt ? Date.parse(item.publishedAt) : 0) > (previous.publishedAt ? Date.parse(previous.publishedAt) : 0) ? item.publishedAt : previous.publishedAt;
      byTitle.set(titleKey, { ...winner, publishedAt: newerPublished, matches: [...merged.values()], alsoReportedBy: [...new Set([...winner.alsoReportedBy, ...loser.alsoReportedBy, loser.sourceName])].filter((source) => source !== winner.sourceName) });
    }

    const limited = [...byTitle.values()].sort((a, b) => b.score - a.score || (b.publishedAt ? Date.parse(b.publishedAt) : 0) - (a.publishedAt ? Date.parse(a.publishedAt) : 0)).slice(0, limit);
    return NextResponse.json({ generatedAt: new Date().toISOString(), count: limited.length, sinceHours, items: limited } satisfies LeagueNewsResponse, { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' } });
  } catch (error) {
    console.error('League News API error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
