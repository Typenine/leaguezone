export type FantasyProviderId = 'sleeper' | 'yahoo';

export type ProviderLeagueSummary = {
  provider: FantasyProviderId;
  providerLeagueId: string;
  providerGameId: string | null;
  name: string;
  season: number;
  numTeams: number | null;
  logoUrl: string | null;
  isFinished: boolean;
  metadata?: Record<string, unknown>;
};

export type ProviderTeamSummary = {
  providerTeamId: string;
  rosterId: number;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
  isCurrentUser: boolean;
  isCommissioner: boolean;
};
