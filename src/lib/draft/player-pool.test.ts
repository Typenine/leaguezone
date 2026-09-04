import { describe, expect, it } from 'vitest';
import {
  isSleeperPlayerEligibleForDraft,
  normalizeDraftPlayerPoolType,
  sleeperDraftPlayerDisplayName,
} from './player-pool';

describe('draft player pool presets', () => {
  it('defaults unknown values to the standard pool', () => {
    expect(normalizeDraftPlayerPoolType('not-a-pool')).toBe('all_players');
  });

  it('keeps standard fantasy positions in an all-player draft', () => {
    expect(isSleeperPlayerEligibleForDraft({ position: 'QB', rookie_year: 2022 }, 2027, 'all_players')).toBe(true);
    expect(isSleeperPlayerEligibleForDraft({ position: 'DEF' }, 2027, 'all_players')).toBe(true);
    expect(isSleeperPlayerEligibleForDraft({ position: 'DL' }, 2027, 'all_players')).toBe(false);
  });

  it('limits rookie drafts to the configured draft year', () => {
    expect(isSleeperPlayerEligibleForDraft({ position: 'RB', rookie_year: 2027 }, 2027, 'rookies_only')).toBe(true);
    expect(isSleeperPlayerEligibleForDraft({ position: 'RB', rookie_year: 2026 }, 2027, 'rookies_only')).toBe(false);
    expect(isSleeperPlayerEligibleForDraft({ position: 'DEF' }, 2027, 'rookies_only')).toBe(false);
  });

  it('adds team defenses only for the rookies-plus-defenses preset', () => {
    expect(isSleeperPlayerEligibleForDraft({ position: 'DEF' }, 2027, 'rookies_plus_defenses')).toBe(true);
    expect(isSleeperPlayerEligibleForDraft({ position: 'WR', rookie_year: '2027' }, 2027, 'rookies_plus_defenses')).toBe(true);
    expect(isSleeperPlayerEligibleForDraft({ position: 'WR', rookie_year: '2026' }, 2027, 'rookies_plus_defenses')).toBe(false);
  });

  it('keeps veterans and excludes rookies and defenses from the veteran preset', () => {
    expect(isSleeperPlayerEligibleForDraft({ position: 'WR', rookie_year: 2024, years_exp: 3 }, 2027, 'veterans_only')).toBe(true);
    expect(isSleeperPlayerEligibleForDraft({ position: 'WR', rookie_year: 2027, years_exp: 0 }, 2027, 'veterans_only')).toBe(false);
    expect(isSleeperPlayerEligibleForDraft({ position: 'TE', years_exp: 2 }, 2027, 'veterans_only')).toBe(true);
    expect(isSleeperPlayerEligibleForDraft({ position: 'DEF' }, 2027, 'veterans_only')).toBe(false);
  });

  it('never fills a custom pool from Sleeper automatically', () => {
    expect(isSleeperPlayerEligibleForDraft({ position: 'QB', rookie_year: 2027 }, 2027, 'custom')).toBe(false);
  });

  it('gives defense entries a readable fallback name', () => {
    expect(sleeperDraftPlayerDisplayName({ player_id: 'GB', position: 'DEF', team: 'GB' })).toBe('GB Defense');
  });
});
