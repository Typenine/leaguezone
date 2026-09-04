import { describe, expect, it } from 'vitest';
import { buildDraftRoundOrders, validateDraftTeamOrder } from './draft-order';

const teams = ['A', 'B', 'C', 'D'];

describe('draft order configuration', () => {
  it('repeats a linear order every round', () => {
    expect(buildDraftRoundOrders(teams, 3, 'linear')).toEqual({
      1: ['A', 'B', 'C', 'D'],
      2: ['A', 'B', 'C', 'D'],
      3: ['A', 'B', 'C', 'D'],
    });
  });

  it('reverses even rounds for a snake draft', () => {
    expect(buildDraftRoundOrders(teams, 4, 'snake')).toEqual({
      1: ['A', 'B', 'C', 'D'],
      2: ['D', 'C', 'B', 'A'],
      3: ['A', 'B', 'C', 'D'],
      4: ['D', 'C', 'B', 'A'],
    });
  });

  it('rejects an invalid custom round order', () => {
    expect(() => buildDraftRoundOrders(teams, 2, 'custom', {
      1: ['B', 'A', 'D', 'C'],
      2: ['C', 'C', 'A', 'D'],
    })).toThrow(/Round 2/);
  });

  it('rejects duplicate or missing teams', () => {
    expect(validateDraftTeamOrder(['A', 'A', 'C', 'D'], teams)).toContain('more than once');
    expect(validateDraftTeamOrder(['A', 'B', 'C'], teams)).toContain('Expected 4 teams');
  });

  it('builds a valid traded-pick style custom order', () => {
    const custom = {
      1: ['B', 'A', 'D', 'C'],
      2: ['C', 'D', 'A', 'B'],
    };
    expect(buildDraftRoundOrders(teams, 2, 'custom', custom)).toEqual(custom);
  });
});
