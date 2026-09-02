import { describe, expect, it } from 'vitest';
import { leagueSlugFromTradeBlockReferer } from '@/lib/server/trade-block-request';

describe('trade-block public request context', () => {
  it('derives the LeagueZone slug from the league trade-block URL only', () => {
    expect(leagueSlugFromTradeBlockReferer('https://leaguezonehq.vercel.app/l/east-v-west/trade-block')).toBe('east-v-west');
    expect(leagueSlugFromTradeBlockReferer('https://leaguezonehq.vercel.app/l/the-ccl/trade-block/')).toBe('the-ccl');
    expect(leagueSlugFromTradeBlockReferer('https://leaguezonehq.vercel.app/trades/block')).toBeNull();
    expect(leagueSlugFromTradeBlockReferer(null)).toBeNull();
  });
});
