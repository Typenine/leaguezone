import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/auth', () => ({verifySession: vi.fn()}));
vi.mock('@/lib/server/league-context', () => ({getCurrentLeagueBySlug: vi.fn()}));
vi.mock('@/lib/server/user-auth', () => ({getUserLeagues: vi.fn()}));
vi.mock('@/lib/server/fantasy-data', () => ({getFantasyRostersResult: vi.fn()}));
vi.mock('@/lib/server/public-api-guard', () => ({guardPublicDataRequest: vi.fn(async () => null)}));
vi.mock('@/lib/utils/sleeper-api', () => ({getAllPlayersCached: vi.fn()}));
vi.mock('@/lib/server/provider-settings', () => ({getFantasyLeagueSettings: vi.fn()}));
vi.mock('@/lib/server/reliability-cache', () => ({reliabilityResponseHeaders: vi.fn(() => ({'X-LeagueZone-Data-Mode':'live'}))}));

import { GET } from '@/app/api/league-opportunities/[slug]/route';
import { verifySession } from '@/lib/server/auth';
import { getCurrentLeagueBySlug } from '@/lib/server/league-context';
import { getUserLeagues } from '@/lib/server/user-auth';
import { getFantasyRostersResult } from '@/lib/server/fantasy-data';
import { getAllPlayersCached } from '@/lib/utils/sleeper-api';
import { getFantasyLeagueSettings } from '@/lib/server/provider-settings';

const call = () => GET(new NextRequest('https://example.test/api/league-opportunities/example', {
  headers: { cookie: 'evw_session=valid-test-token' },
}), {params:Promise.resolve({slug:'example'})});

describe('League roster opportunity data access', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentLeagueBySlug).mockResolvedValue({id:'league-1'} as never);
    vi.mocked(getFantasyRostersResult).mockResolvedValue({
      value:{provider:'sleeper',season:'2026',teams:[],players:{}},stale:false,
    } as never);
    vi.mocked(getAllPlayersCached).mockResolvedValue({} as never);
    vi.mocked(getFantasyLeagueSettings).mockResolvedValue({ppr:0.5} as never);
  });
  it('rejects signed-out requests before loading any provider data', async () => {
    vi.mocked(verifySession).mockReturnValue(null);
    const response=await call();
    expect(response.status).toBe(401);
    expect(getFantasyRostersResult).not.toHaveBeenCalled();
  });
  it('rejects authenticated users who are not league members', async () => {
    vi.mocked(verifySession).mockReturnValue({type:'user',sub:'someone'});
    vi.mocked(getUserLeagues).mockResolvedValue([] as never);
    const response=await call();
    expect(response.status).toBe(403);
    expect(getFantasyRostersResult).not.toHaveBeenCalled();
  });
  it('returns a member-scoped private response with the owner roster and scoring', async () => {
    vi.mocked(verifySession).mockReturnValue({type:'user',sub:'member-1'});
    vi.mocked(getUserLeagues).mockResolvedValue([{leagueId:'league-1',rosterId:7}] as never);
    const response=await call();
    const data=await response.json();
    expect(response.status).toBe(200);
    expect(data.viewerRosterId).toBe(7);
    expect(data.leaguePpr).toBe(0.5);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(getFantasyRostersResult).toHaveBeenCalledWith('league-1');
  });
});
