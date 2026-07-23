import { describe, expect, it } from 'vitest';
import { getLeagueSiteSection, getLeagueSlugFromPath, getNavigationSurface } from '@/lib/navigation/surfaces';

describe('navigation surfaces', () => {
  it('classifies nested platform and authentication routes consistently', () => {
    expect(getNavigationSurface('/setup/branding')).toBe('platform');
    expect(getNavigationSurface('/reset-password/token')).toBe('platform');
    expect(getNavigationSurface('/join/invite-code')).toBe('platform');
  });

  it('extracts league slugs and sections from canonical routes', () => {
    expect(getNavigationSurface('/l/east-v-west/teams')).toBe('league-site');
    expect(getLeagueSlugFromPath('/l/east-v-west/teams')).toBe('east-v-west');
    expect(getLeagueSiteSection('/l/east-v-west/teams')).toBe('teams');
  });

  it('keeps old top-level league pages as compatibility surfaces', () => {
    expect(getNavigationSurface('/home')).toBe('legacy-league');
    expect(getNavigationSurface('/teams/4')).toBe('legacy-league');
  });
});
