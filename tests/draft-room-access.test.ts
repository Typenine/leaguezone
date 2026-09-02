import { describe, expect, it } from 'vitest';
import { TEAM_NAMES } from '@/lib/constants/league';
import { canAccessDraftRoom } from '@/lib/draft/access';

describe('draft room offseason access', () => {
  it('admits configured league teams when the room is open', () => {
    expect(canAccessDraftRoom(TEAM_NAMES[0])).toBe(true);
  });

  it('admits admins even without a team session', () => {
    expect(canAccessDraftRoom(null, true)).toBe(true);
    expect(canAccessDraftRoom(undefined, true)).toBe(true);
  });

  it('treats every configured league team consistently', () => {
    for (const team of TEAM_NAMES) {
      expect(canAccessDraftRoom(team)).toBe(true);
    }
  });

  it('never admits a missing or non-league team without admin access', () => {
    expect(canAccessDraftRoom(null)).toBe(false);
    expect(canAccessDraftRoom(undefined)).toBe(false);
    expect(canAccessDraftRoom('Unknown Team')).toBe(false);
  });
});
