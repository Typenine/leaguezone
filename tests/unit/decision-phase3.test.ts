import {describe,expect,it} from 'vitest';
import {tradeTeamImpact,rankProspects,evaluateReceipt} from '@/lib/fantasy/decision-phase3';
import type {FantasyRostersData} from '@/lib/providers/types';
const rosters={teams:[
 {rosterId:1,teamName:'Alpha',players:['a1','a2']},
 {rosterId:2,teamName:'Beta',players:['b1','b2']}
],players:{
 a1:{position:'WR',fullName:'WR A'},a2:{position:'RB',fullName:'RB A'},
 b1:{position:'RB',fullName:'RB B'},b2:{position:'WR',fullName:'WR B'}
}} as unknown as Pick<FantasyRostersData,'teams'|'players'>;
const market=Object.fromEntries([['a1',3000],['a2',1000],['b1',2000],['b2',500]]
 .map(([id,value])=>[id,{name:String(id),position:String(id).startsWith('a')?'WR':'RB',
 sleeperId:String(id),value:Number(value)}]));
describe('Phase 3 verified trade impact',()=>{
 const args={rosters,market,starterSlots:['QB','RB','WR','FLEX'],teamA:1,teamB:2,
  sendsA:['a1'],sendsB:['b1']};
 it('accounts for both directions and position-level starter assets',()=>{
  const result=tradeTeamImpact(args);
  expect(result.valid).toBe(true);
  expect(result.teams.map(t=>t.marketDelta)).toEqual([-1000,1000]);
  expect(result.teams[0].positional.find(p=>p.position==='RB')?.after).toBe(2000);
 });
 it('shows which actual roster players are counted before and after',()=>{
  const result=tradeTeamImpact(args);
  expect(result.valid).toBe(true);
  const alpha=result.teams[0];
  expect(alpha).toMatchObject({
   rosterBefore:2,rosterAfter:2,
   sent:[{id:'a1',name:'WR A',position:'WR',value:3000}],
   received:[{id:'b1',name:'RB B',position:'RB',value:2000}]
  });
  const rb=alpha.positional.find(p=>p.position==='RB')!;
  expect(rb.fixedSlots).toBe(1);
  expect(rb.countedBefore.map(p=>p.name)).toEqual(['RB A']);
  expect(rb.countedAfter.map(p=>p.name)).toEqual(['RB B']);
  expect(rb.after-rb.before).toBe(1000);
  const wr=alpha.positional.find(p=>p.position==='WR')!;
  expect(wr.countedBefore.map(p=>p.name)).toEqual(['WR A']);
  expect(wr.countedAfter).toEqual([]);
 });
 it('never fabricates a top player at a position with no fixed starting slot',()=>{
  const result=tradeTeamImpact({...args,starterSlots:['RB','WR','SUPER_FLEX','FLEX']});
  const qb=result.teams[0].positional.find(p=>p.position==='QB')!;
  const te=result.teams[0].positional.find(p=>p.position==='TE')!;
  expect(qb).toMatchObject({fixedSlots:0,before:0,after:0,countedBefore:[]});
  expect(te).toMatchObject({fixedSlots:0,before:0,after:0,countedAfter:[]});
 });
 it('rejects unowned and unpriced assets rather than fabricating a grade',()=>{
  expect(tradeTeamImpact({...args,sendsB:['a2']}).valid).toBe(false);
  expect(tradeTeamImpact({...args,sendsB:['unknown']}).valid).toBe(false);
  expect(tradeTeamImpact({...args,market:{}}).valid).toBe(false);
 });
});
describe('Phase 3 rookie guidance',()=>{
 const prospects=[
  {id:'w',name:'W',pos:'WR' as const,tier:1,college:'X',draftRange:'R1',trend:'steady',
   strengths:[],concerns:[]},
  {id:'q',name:'Q',pos:'QB' as const,tier:2,college:'Y',draftRange:'R1',trend:'steady',
   strengths:[],concerns:[]}
 ];
 it('respects the existing board while honoring no-fit flags',()=>{
  expect(rankProspects({prospects:[{...prospects[0],noFit:true},prospects[1]],needs:[],superflex:false})
   .map(x=>x.prospect.id)).toEqual(['q']);
 });
 it('discloses verified format and positional need adjustments',()=>{
  const result=rankProspects({prospects,superflex:true,
   needs:[{pos:'QB',mine:1,required:2,median:3,shortage:1,belowMedian:2,level:'urgent',explanation:''}]});
  expect(result.find(x=>x.prospect.id==='q')?.reason).toContain('Superflex');
  expect(result.find(x=>x.prospect.id==='q')?.reason).toContain('Starter shortage');
 });
});
describe('Phase 3 prediction receipts',()=>{
 const input={start:['start'],bench:['bench'],predictedGain:3.4};
 it('only evaluates complete weeks with verified points for both players',()=>{
  expect(evaluateReceipt(input,{start:13,bench:2},false).status).toBe('pending');
  expect(evaluateReceipt(input,{start:13},true).status).toBe('pending');
  expect(evaluateReceipt(input,{start:13,bench:8},true)).toMatchObject({
   status:'evaluated',actualGain:5,successful:true});
  expect(evaluateReceipt(input,{start:6,bench:13},true)).toMatchObject({
   status:'evaluated',actualGain:-7,successful:false});
 });
});
