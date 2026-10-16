import {describe,expect,it,vi,beforeEach} from 'vitest';
import {NextRequest} from 'next/server';

const mocks=vi.hoisted(()=>({
 fetchLeagueContext:vi.fn(),
 researchSleeperRosters:vi.fn(),
 rateLimitByIpStrict:vi.fn(),
}));
vi.mock('@/lib/server/sleeper-research',()=>({
 validLeagueId:(id:unknown)=>typeof id==='string'&&/^[0-9]{7,25}$/.test(id),
 fetchLeagueContext:mocks.fetchLeagueContext,
 researchSleeperRosters:mocks.researchSleeperRosters,
}));
vi.mock('@/lib/server/rate-limit',()=>({rateLimitByIpStrict:mocks.rateLimitByIpStrict}));
import {GET} from '@/app/api/public-fantasy/league/route';

const id='1312872384503484416';
beforeEach(()=>{
 mocks.rateLimitByIpStrict.mockResolvedValue({allowed:true});
 mocks.fetchLeagueContext.mockResolvedValue({
  league:{name:'East Vs. West',season:'2026'},
  rosters:[{roster_id:1,owner_id:'owner1'},{roster_id:2,owner_id:'owner2'}],
  users:[{user_id:'owner1',display_name:'Belltown Raptors'},
         {user_id:'owner2',display_name:'Belleview Badgers'}],
 });
 mocks.researchSleeperRosters.mockResolvedValue({
  rosters:{provider:'sleeper',season:'2026',
   players:{'4984':{fullName:'Josh Allen',position:'QB'}},
   teams:[
    {rosterId:1,teamName:'Belltown Raptors',players:['player-a'],wins:4},
    {rosterId:2,teamName:'Belleview Badgers',players:['4984'],wins:3},
   ]},
  catalog:[],starterSlots:['QB','RB','SUPER_FLEX'],
  taxiContext:null,leaguePpr:0.5,
 });
});

describe('public Sleeper league context preserves full roster data',()=>{
 it('returns only light team summaries in the preview',async()=>{
  const res=await GET(new NextRequest('https://leaguezonehq.com/api/public-fantasy/league?leagueId='+id));
  const json=await res.json();
  expect(res.status).toBe(200);
  expect(json.teams).toEqual([
   {rosterId:1,teamName:'Belltown Raptors'},
   {rosterId:2,teamName:'Belleview Badgers'},
  ]);
  expect(json.players).toBeUndefined();
  expect(mocks.researchSleeperRosters).not.toHaveBeenCalled();
 });
 it('retains every team player list in the detailed context, rather than overwriting it with the preview',async()=>{
  const res=await GET(new NextRequest('https://leaguezonehq.com/api/public-fantasy/league?leagueId='+id+'&rosterId=2'));
  const json=await res.json();
  expect(res.status).toBe(200);
  expect(json.viewerRosterId).toBe(2);
  expect(json.teams).toHaveLength(2);
  expect(json.teams[0].players).toEqual(['player-a']);
  expect(json.teams[1].players).toEqual(['4984']);
  expect(json.players['4984'].fullName).toBe('Josh Allen');
  expect(json.starterSlots).toContain('SUPER_FLEX');
  expect(json.leaguePpr).toBe(0.5);
  expect(json.teamName).toBe('Belleview Badgers');
 });
});
