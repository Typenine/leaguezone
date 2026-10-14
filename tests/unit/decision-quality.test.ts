import {describe,it,expect} from 'vitest';
import {marketById,rosterQuality,rankedActions} from '@/lib/fantasy/decision-quality';

const teams=[
 {rosterId:1,providerTeamId:'a',teamName:'A',ownerId:'1',ownerName:'A',logoUrl:null,wins:0,losses:0,ties:0,fpts:0,fptsAgainst:0,players:['qb1','wr1','wr2','rb1']},
 {rosterId:2,providerTeamId:'b',teamName:'B',ownerId:'2',ownerName:'B',logoUrl:null,wins:0,losses:0,ties:0,fpts:0,fptsAgainst:0,players:['qb2','wr3','wr4','rb2']},
];
const players=Object.fromEntries(['qb1','qb2','wr1','wr2','wr3','wr4','rb1','rb2'].map(id=>[id,{
 provider:'sleeper' as const,playerId:id,providerPlayerId:id,fullName:id,firstName:id,lastName:null,position:id.startsWith('wr')?'WR':id.startsWith('rb')?'RB':'QB',nflTeam:'DET'
}]));
const indexed=marketById(Object.fromEntries([
 ['qb1',4000],['qb2',5000],['wr1',2000],['wr2',300],['wr3',5000],['wr4',1500],['rb1',500],['rb2',2100]
].map(([id,value])=>[id,{name:id,position:String(id).slice(0,2).toUpperCase(),sleeperId:id,value:Number(value)}])));
describe('Decision board roster strength',()=>{
 it('compares real priced starters with league median instead of counting players',()=>{
  const q=rosterQuality({teams,players},indexed,1,['QB','RB','WR','WR','TE']);
  const wr=q.find(item=>item.pos==='WR');
  expect(wr).toMatchObject({starterCount:2,count:2,starterMarket:2300,coverage:1,assessment:'needs attention'});
  expect(wr?.leagueMedian).toBe(4400);
  expect(q.find(item=>item.pos==='RB')?.assessment).toBe('needs attention');
 });
 it('fails closed when trade-value coverage is insufficient',()=>{
  const onlyOne=marketById({wr1:{name:'WR 1',position:'WR',sleeperId:'wr1',value:2000}});
  const q=rosterQuality({teams,players},onlyOne,1,['QB','RB','WR']);
  expect(q.find(item=>item.pos==='WR')?.assessment).toBe('unverified');
  expect(q.find(item=>item.pos==='WR')?.ratio).toBeNull();
 });
 it('does not fabricate recommendations without qualifying evidence',()=>{
  expect(rankedActions([],[],{trade:0,waiver:0,risk:0},false)).toEqual([]);
  expect(rankedActions([],[],{trade:2,waiver:3,risk:1},true).map(x=>x.key)).toEqual(['waiver','trade','lineup','risk']);
 });
});
