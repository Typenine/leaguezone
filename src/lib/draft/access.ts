import { IMPORTANT_DATES, TEAM_NAMES } from '@/lib/constants/league';

export const NEXT_DRAFT_ROOM_DATE = IMPORTANT_DATES.NEXT_DRAFT;

/**
 * The deployment-level default can be disabled while commissioners configure
 * their league. League-specific draft state is enforced by the route/API layer.
 */
export const DRAFT_ROOM_PUBLIC_OPEN = process.env.NEXT_PUBLIC_DRAFT_ROOM_OPEN !== 'false';

export function canAccessDraftRoom(
  team: string | null | undefined,
  isAdmin = false,
): boolean {
  if (isAdmin) return true;
  if (!team || !TEAM_NAMES.includes(team)) return false;
  return DRAFT_ROOM_PUBLIC_OPEN;
}
