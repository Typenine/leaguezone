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
  ownerId?: string;
  ownerName: string;
  logoUrl: string | null;
  isCurrentUser: boolean;
  isCommissioner: boolean;
};

export type FantasyPlayer = {
  provider: FantasyProviderId;
  playerId: string;
  providerPlayerId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  position: string | null;
  nflTeam: string | null;
  selectedPosition?: string | null;
  isStarter?: boolean;
};

export type FantasyTeamData = {
  providerTeamId: string;
  rosterId: number;
  teamName: string;
  ownerId: string;
  ownerName: string | null;
  logoUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  fpts: number;
  fptsAgainst: number;
  players: string[];
};

export type FantasyStreak = {
  type: 'W' | 'L' | 'T' | null;
  length: number;
};

export type FantasyStandingsData = {
  provider: FantasyProviderId;
  season: string;
  teams: FantasyTeamData[];
  streaks: Record<number, FantasyStreak>;
};

export type FantasyRostersData = {
  provider: FantasyProviderId;
  season: string;
  teams: FantasyTeamData[];
  players: Record<string, FantasyPlayer>;
};

export type FantasyMatchupTeam = {
  providerTeamId: string;
  rosterId: number;
  teamName: string;
  points: number;
  starters: string[];
  players: string[];
  playerPoints: Record<string, number>;
};

export type FantasyMatchup = {
  provider: FantasyProviderId;
  season: string;
  week: number;
  matchupId: number;
  teams: FantasyMatchupTeam[];
};

export type FantasyTransactionPlayer = {
  playerId: string;
  name: string | null;
  position?: string | null;
  nflTeam?: string | null;
};

export type FantasyTransaction = {
  id: string;
  type: 'waiver' | 'free_agent' | 'trade';
  season: string;
  week: number;
  created: number;
  team: string;
  teamsInvolved: string[];
  rosterId: number;
  added: FantasyTransactionPlayer[];
  dropped: FantasyTransactionPlayer[];
  faab: number;
  metadata?: Record<string, unknown> | null;
};

export type YahooRosterSnapshot = {
  providerTeamId: string;
  rosterId: number;
  players: FantasyPlayer[];
};
