import { describe, expect, it } from 'vitest';
import { buildLeagueSwitchHref, getLeagueSwitchDestination } from '@/lib/navigation/league-switch';

describe('league switch navigation', () => {
  const target = { leagueSlug: 'new-league', isCommissioner: false };

  it('preserves equivalent canonical league-site pages and query strings', () => {
    expect(getLeagueSwitchDestination('/l/old-league/history', 'tab=records', target)).toBe('/l/new-league/history?tab=records');
    expect(getLeagueSwitchDestination('/l/old-league/teams', '', target)).toBe('/l/new-league/teams');
  });

  it('maps legacy league routes into the canonical league site', () => {
    expect(getLeagueSwitchDestination('/home', '', target)).toBe('/l/new-league');
    expect(getLeagueSwitchDestination('/rules', '', target)).toBe('/l/new-league/rulebook');
    expect(getLeagueSwitchDestination('/trades/block', '', target)).toBe('/l/new-league/trade-block');
  });

  it('falls back safely for dynamic or platform-specific pages', () => {
    expect(getLeagueSwitchDestination('/teams/12', '', target)).toBe('/l/new-league/teams');
    expect(getLeagueSwitchDestination('/app', '', target)).toBe('/l/new-league');
    expect(getLeagueSwitchDestination('/newsletter', '', target)).toBe('/l/new-league');
  });

  it('only preserves commissioner destinations for commissioners', () => {
    expect(getLeagueSwitchDestination('/settings', '', { leagueSlug: 'new-league', isCommissioner: true })).toBe('/l/new-league/admin');
    expect(getLeagueSwitchDestination('/settings', '', target)).toBe('/l/new-league');
  });

  it('retains legacy behavior when no target slug is supplied', () => {
    expect(getLeagueSwitchDestination('/history', 'tab=records')).toBe('/history?tab=records');
    expect(getLeagueSwitchDestination('/settings', '', { isCommissioner: false })).toBe('/home');
  });

  it('builds a league selection URL with an encoded canonical destination', () => {
    expect(buildLeagueSwitchHref('league-id', '/history', 'tab=records', { leagueSlug: 'new-league' })).toBe('/api/league/select?id=league-id&next=%2Fl%2Fnew-league%2Fhistory%3Ftab%3Drecords');
  });
});
