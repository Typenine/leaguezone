export const DRAFT_ORDER_TYPES = ['linear', 'snake', 'custom'] as const;

export type DraftOrderType = (typeof DRAFT_ORDER_TYPES)[number];

export const DRAFT_ORDER_OPTIONS: Array<{
  value: DraftOrderType;
  label: string;
  description: string;
}> = [
  {
    value: 'linear',
    label: 'Linear',
    description: 'The same team order repeats every round. Common for rookie drafts.',
  },
  {
    value: 'snake',
    label: 'Snake',
    description: 'Odd rounds use the selected order and even rounds reverse it.',
  },
  {
    value: 'custom',
    label: 'Custom by round',
    description: 'Set a different team order for each round, including traded-pick layouts.',
  },
];

export function normalizeDraftOrderType(value: unknown): DraftOrderType {
  return DRAFT_ORDER_TYPES.includes(value as DraftOrderType)
    ? (value as DraftOrderType)
    : 'linear';
}

export function validateDraftTeamOrder(order: string[], teams: string[]): string | null {
  if (order.length !== teams.length) return `Expected ${teams.length} teams, received ${order.length}.`;
  const allowed = new Set(teams);
  const seen = new Set<string>();
  for (const team of order) {
    if (!allowed.has(team)) return `Unknown team in draft order: ${team}`;
    if (seen.has(team)) return `Team appears more than once in the same round: ${team}`;
    seen.add(team);
  }
  return null;
}

export function buildDraftRoundOrders(
  teams: string[],
  rounds: number,
  orderType: DraftOrderType,
  customRoundOrders?: Record<number, string[]>,
): Record<number, string[]> {
  if (teams.length === 0) throw new Error('At least one team is required.');
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error('Rounds must be a positive integer.');

  const normalized = normalizeDraftOrderType(orderType);
  const result: Record<number, string[]> = {};

  for (let round = 1; round <= rounds; round += 1) {
    let order: string[];
    if (normalized === 'snake') {
      order = round % 2 === 1 ? [...teams] : [...teams].reverse();
    } else if (normalized === 'custom') {
      order = [...(customRoundOrders?.[round] || [])];
    } else {
      order = [...teams];
    }

    const error = validateDraftTeamOrder(order, teams);
    if (error) throw new Error(`Round ${round}: ${error}`);
    result[round] = order;
  }

  return result;
}
