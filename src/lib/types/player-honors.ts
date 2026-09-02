export type PlayerHonorKind = 'all_league_first' | 'all_league_second' | 'mvp' | 'rookie_of_year';
export type PlayerHonor = { id: string; season: string; kind: PlayerHonorKind; label: string; position?: string | null; source: 'statistical' };
