export const DRAFT_PLAYER_POOL_TYPES = [
  'all_players',
  'rookies_only',
  'rookies_plus_defenses',
] as const;

export type DraftPlayerPoolType = (typeof DRAFT_PLAYER_POOL_TYPES)[number];

export const DRAFT_PLAYER_POOL_OPTIONS: Array<{
  value: DraftPlayerPoolType;
  label: string;
  description: string;
}> = [
  {
    value: 'all_players',
    label: 'All players',
    description: 'Standard redraft, startup, or keeper-style pool from Sleeper.',
  },
  {
    value: 'rookies_only',
    label: 'Rookies only',
    description: 'Only players whose Sleeper rookie year matches the draft year.',
  },
  {
    value: 'rookies_plus_defenses',
    label: 'Rookies + defenses',
    description: 'Draft-year rookies plus team defense/special teams entries.',
  },
];

const ELIGIBLE_FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'FB', 'RB/FB', 'DEF']);

export function normalizeDraftPlayerPoolType(value: unknown): DraftPlayerPoolType {
  return DRAFT_PLAYER_POOL_TYPES.includes(value as DraftPlayerPoolType)
    ? (value as DraftPlayerPoolType)
    : 'all_players';
}

export function isSleeperPlayerEligibleForDraft(
  player: { position?: string | null; rookie_year?: string | number | null },
  year: number,
  poolType: DraftPlayerPoolType,
): boolean {
  const position = String(player.position || '').toUpperCase();
  if (!ELIGIBLE_FANTASY_POSITIONS.has(position)) return false;

  if (poolType === 'all_players') return true;
  if (position === 'DEF') return poolType === 'rookies_plus_defenses';

  return player.rookie_year != null && String(player.rookie_year) === String(year);
}

export function sleeperDraftPlayerDisplayName(player: {
  player_id: string;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  team?: string | null;
}): string {
  const name = `${player.first_name || ''} ${player.last_name || ''}`.trim();
  if (name) return name;
  const position = String(player.position || '').toUpperCase();
  if (position === 'DEF') return `${player.team || player.player_id} Defense`;
  return player.team || player.player_id;
}
