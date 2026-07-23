import { describe, expect, it } from 'vitest';
import {
  buildLeagueSwitchHref,
  getLeagueSwitchDestination,
} from '@/lib/navigation/league-switch';

describe('league switch navigation', () => {
  it('preserves safe league-wide pages and query strings', () => {
    expect(getLeagueSwitchDestination('/history', 'tab=records')).toBe('/history?tab=records');
    expect(getLeagueSwitchDestination('/trades/block')).toBe('/trades/block');
  });

  it('returns to league home for dynamic or platform-specific pages', () => {
    expect(getLeagueSwitchDestination('/teams/12')).toBe('/home');
    expect(getLeagueSwitchDestination('/app')).toBe('/home');
    expect(getLeagueSwitchDestination('/newsletter')).toBe('/home');
  });

  it('only preserves settings for commissioners', () => {
    expect(getLeagueSwitchDestination('/settings', '', { isCommissioner: true })).toBe('/settings');
    expect(getLeagueSwitchDestination('/settings', '', { isCommissioner: false })).toBe('/home');
  });

  it('builds a league selection URL with an encoded destination', () => {
    expect(buildLeagueSwitchHref('league-id', '/history', 'tab=records')).toBe(
      '/api/league/select?id=league-id&next=%2Fhistory%3Ftab%3Drecords',
    );
  });
});
