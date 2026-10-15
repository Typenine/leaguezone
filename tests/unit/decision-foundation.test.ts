import {describe,it,expect} from 'vitest';
import {adviseLineup,adviseWaivers} from '@/lib/fantasy/decision-foundation';
import type {WeeklyProjectedPlayer,LineupOptimizerResponse} from '@/lib/fantasy/lineup-types';
import type {FantasyRostersData} from '@/lib/providers/types';

const player=(id:string,points:number):WeeklyProjectedPlayer=>({
 id,name:id,position:'WR',nflTeam:'NYG',opponent:'DAL',projection:points,baseline:points,
 matchupFactor:1,availabilityWeight:1,isBye:false,confidence:'medium',rangeLow:points-4,
 rangeHigh:points+4,expectedRole:'',workload:'',assumption:null,
 startProbability:1,activeProbability:1,statLine:{},
});
function lineup(start:WeeklyProjectedPlayer,bench:WeeklyProjectedPlayer):LineupOptimizerResponse{
 return {generatedAt:new Date(0).toISOString(),teamName:'My Team',season:'2026',week:6,
  available:true,reason:null,currentTotal:start.projection,optimalTotal:bench.projection,
  potentialGain:Math.max(0,bench.projection-start.projection),
  currentLineup:[{slot:'WR',slotIndex:0,player:start,changed:true}],
  optimalLineup:[{slot:'WR',slotIndex:0,player:bench,changed:true}],
  projectedPlayers:[start,bench],modelVersion:'test',projectionPhase:'in_season',
  confidence:'medium',confidenceNote:''};
}
describe('shared decision foundation',()=>{
 it('reports exactly who enters and exits without inventing a per-player difference for multi-slot trades',()=>{
  const advice=adviseLineup(lineup(player('Current',9),player('Better',14)));
  expect(advice?.start.map(x=>x.id)).toEqual(['Better']);
  expect(advice?.bench.map(x=>x.id)).toEqual(['Current']);
  expect(advice?.gain).toBe(5);
 });
 it('does not recommend an unavailable or unchanged lineup',()=>{
  const same=lineup(player('Current',9),player('Current',9));
  expect(adviseLineup(same)).toBeNull();
  expect(adviseLineup({...same,available:false})).toBeNull();
 });
 it('qualifies small differences as close calls',()=>{
  expect(adviseLineup(lineup(player('A',12),player('B',13)))?.close).toBe(true);
 });
 it('requires a real owned roster and verified candidate identifier',()=>{
  const rosters={
   teams:[{rosterId:7,players:['owned'],teamName:'Mine'}],
   players:{owned:{position:'WR',fullName:'Owned player'}}
  } as unknown as Pick<FantasyRostersData,'teams'|'players'>;
  const sample=(id:string,providerId:string|null)=>({providerId,signal:{
   id,name:id,pos:'WR',baseline:3,recent:8,change:5,relativeChange:85,
   scoringBefore:4,scoringRecent:9,scoringChange:5}});
  const market={
   owned:{name:'Owned',position:'WR',sleeperId:'owned',value:100},
   waiver:{name:'Waiver',position:'WR',sleeperId:'waiver',value:200}
  };
  expect(adviseWaivers({leads:[sample('New','waiver'),sample('Unmatched',null)],
   needs:[],rosters,teamId:7,market}).map(x=>[x.level,x.comparison?.name])).toEqual([['upgrade','Owned player']]);
  expect(adviseWaivers({leads:[sample('New','waiver')],needs:[],rosters,teamId:99,market})).toEqual([]);
 });
});
