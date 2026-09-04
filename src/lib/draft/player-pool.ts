export const DRAFT_PLAYER_POOL_TYPES = [
  'all_players',
  'rookies_only',
  'rookies_plus_defenses',
  'veterans_only',
  'custom',
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
  {
    value: 'veterans_only',
    label: 'Veterans only',
    description: 'Non-rookie NFL players only. Team defenses are excluded.',
  },
  {
    value: 'custom',
    label: 'Custom player pool',
    description: 'Import a CSV or JSON list. Sleeper player IDs can be retained for headshots and player metadata.',
  },
];

const ELIGIBLE_FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'FB', 'RB/FB', 'DEF']);

export function normalizeDraftPlayerPoolType(value: unknown): DraftPlayerPoolType {
  return DRAFT_PLAYER_POOL_TYPES.includes(value as DraftPlayerPoolType)
    ? (value as DraftPlayerPoolType)
    : 'all_players';
}

export function isSleeperPlayerEligibleForDraft(
  player: {
    position?: string | null;
    rookie_year?: string | number | null;
    years_exp?: string | number | null;
  },
  year: number,
  poolType: DraftPlayerPoolType,
): boolean {
  const position = String(player.position || '').toUpperCase();
  if (!ELIGIBLE_FANTASY_POSITIONS.has(position)) return false;
  if (poolType === 'custom') return false;
  if (poolType === 'all_players') return true;
  if (position === 'DEF') return poolType === 'rookies_plus_defenses';

  const rookieYear = player.rookie_year == null ? null : Number(player.rookie_year);
  if (poolType === 'rookies_only' || poolType === 'rookies_plus_defenses') {
    return Number.isFinite(rookieYear) && rookieYear === year;
  }

  if (poolType === 'veterans_only') {
    if (Number.isFinite(rookieYear)) return (rookieYear as number) < year;
    const yearsExp = player.years_exp == null ? null : Number(player.years_exp);
    return Number.isFinite(yearsExp) && (yearsExp as number) > 0;
  }

  return false;
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
