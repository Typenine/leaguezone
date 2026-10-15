import {describe,it,expect} from 'vitest';
import {taxiContextFromSleeper} from '@/lib/fantasy/taxi-context';
import {adviseTaxi,personalRankings,restOfSeasonPace,rosterImprovementPlan} from '@/lib/fantasy/decision-phase2';
import type {WeeklyProjectedPlayer,LineupOptimizerResponse} from '@/lib/fantasy/lineup-types';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {NflGame} from '@/lib/weekly-center';
const p=(id:string,pos:string,points:number)=>({id,name:id,position:pos,nflTeam:'GB',opponent:'CHI',
 projection:points,baseline:points,matchupFactor:1,availabilityWeight:1,isBye:false,confidence:'medium',
 rangeLow:points-4,rangeHigh:points+4,expectedRole:'',workload:'',assumption:null,
 startProbability:1,activeProbability:1,statLine:{}} as WeeklyProjectedPlayer);
const l=(active:WeeklyProjectedPlayer[],taxi:WeeklyProjectedPlayer[])=>({
 available:true,teamName:'My team',season:'2026',week:6,generatedAt:'2026-10-15',reason:null,
 currentTotal:10,optimalTotal:10,potentialGain:0,currentLineup:[],optimalLineup:[],
 projectedPlayers:active,taxiProjectedPlayers:taxi,modelVersion:'v3',projectionPhase:'in_season',
 confidence:'medium',confidenceNote:''} as LineupOptimizerResponse);
describe('Phase 2 decision logic',()=>{
 it('reads actual Sleeper taxi slots and does not hardcode EvW limits',()=>{
  const ctx=taxiContextFromSleeper({season:2026,roster:{taxi:['a','a']},settings:{taxi_slots:6},
   playerDirectory:{a:{first_name:'A',last_name:'Rookie',position:'WR',rookie_year:2026}}});
  expect(ctx).toMatchObject({maxSlots:6,used:1});
  expect(taxiContextFromSleeper({season:2026,roster:{taxi:['b']},playerDirectory:{}}).maxSlots).toBeNull();
  const advice=adviseTaxi(ctx,l([p('starter','WR',7),p('bench','WR',5)],[p('a','WR',15)]),{});
  expect(advice[0].action).toBe('consider promotion');
  expect(advice[0].reason).toContain('rule');
  expect(adviseTaxi(ctx,null,{}).at(0)?.action).toBe('review status');
 });
 it('uses weekly projections and market values separately in rankings',()=>{
  const rosters={teams:[{rosterId:1,teamName:'Mine',players:['a','b']}],
   players:{a:{position:'WR',fullName:'A'},b:{position:'RB',fullName:'B'}}} as unknown as Pick<FantasyRostersData,'teams'|'players'>;
  const input={rosters,teamId:1,market:{
   a:{name:'A',position:'WR',sleeperId:'a',value:1000},
   b:{name:'B',position:'RB',sleeperId:'b',value:600},
   c:{name:'C',position:'WR',sleeperId:'c',value:800}},weekly:[p('a','WR',10),p('b','RB',18)],
   waiverIds:['c'],needs:[],position:'ALL'};
  expect(personalRankings({...input,mode:'weekly'}).map(x=>x.id)).toEqual(['b','a']);
  expect(personalRankings({...input,mode:'dynasty'}).map(x=>x.id)).toEqual(['a','c','b']);
 });
 it('uses scheduled future games only for a labelled pace reference',()=>{
  const games=[{season:2026,week:6,home:'GB',away:'CHI',status:'scheduled',kickoff:'2026-10-18T17:00:00Z'},
   {season:2026,week:7,home:'GB',away:'DET',status:'scheduled',kickoff:'2026-10-25T17:00:00Z'},
   {season:2026,week:8,home:'SEA',away:'CHI',status:'scheduled',kickoff:'2026-11-01T17:00:00Z'}] as NflGame[];
  expect(restOfSeasonPace({players:[p('a','WR',10)],schedule:games,week:6,season:2026,
   now:Date.parse('2026-10-15T12:00:00Z')}))[0]).toMatchObject({games:2,pacePoints:20,byeWeeks:[8]});
  expect(restOfSeasonPace({players:[p('a','WR',10)],schedule:games,week:6,season:2026,
   now:Date.parse('2026-12-01T12:00:00Z')})).toEqual([]);
 });
 it('prioritizes fixed starter shortages only when actual roster need exists',()=>{
  const actions=rosterImprovementPlan({needs:[{pos:'RB',mine:1,median:4,required:2,shortage:1,
   belowMedian:3,level:'urgent',explanation:''}],quality:[],lineup:null});
  expect(actions[0].key).toBe('shortage-RB');
  expect(actions[0].why).toContain('fixed starting slots');
 });
});
