import type { FantasyProviderId } from '@/lib/providers/types';

export type ProviderCapabilities = {
  standings: boolean;
  rosters: boolean;
  matchups: boolean;
  transactions: boolean;
  teamDetail: boolean;
  playerDetail: boolean;
  matchupPlayerScoring: boolean;
  historicalRecords: boolean;
  headToHead: boolean;
  draftHistory: boolean;
  playoffBrackets: boolean;
  taxi: boolean;
  health: boolean;
  projections: boolean;
  tradedDraftPicks: boolean;
};

const CAPABILITIES: Record<FantasyProviderId, ProviderCapabilities> = {
  sleeper: {
    standings: true, rosters: true, matchups: true, transactions: true, teamDetail: true,
    playerDetail: true, matchupPlayerScoring: true, historicalRecords: true, headToHead: true,
    draftHistory: true, playoffBrackets: true, taxi: true, health: true, projections: true,
    tradedDraftPicks: true,
  },
  yahoo: {
    standings: true, rosters: true, matchups: true, transactions: true, teamDetail: true,
    playerDetail: true, matchupPlayerScoring: true, historicalRecords: true, headToHead: true,
    draftHistory: true, playoffBrackets: false, taxi: false, health: true, projections: true,
    tradedDraftPicks: false,
  },
};

export function getProviderCapabilities(provider: FantasyProviderId): ProviderCapabilities {
  return CAPABILITIES[provider];
}

export function providerFeatureMessage(provider: FantasyProviderId, feature: keyof ProviderCapabilities): string | null {
  if (CAPABILITIES[provider][feature]) return null;
  const label = provider === 'yahoo' ? 'Yahoo Fantasy' : 'Sleeper';
  const names: Partial<Record<keyof ProviderCapabilities, string>> = {
    playoffBrackets: 'provider-supplied playoff bracket imports',
    taxi: 'taxi-squad validation',
    tradedDraftPicks: 'provider-tracked future draft picks',
  };
  return `${names[feature] || feature} is not currently available from ${label}. LeagueZone will leave this section unavailable rather than infer or fabricate data.`;
}
