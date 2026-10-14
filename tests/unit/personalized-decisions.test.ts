import {describe,it,expect} from 'vitest';
import {rosterNeeds,decisionCandidates} from '@/lib/fantasy/personalized-decisions';

const players:Record<string,{position:string|null}>={
 a:{position:'RB'},b:{position:'RB'},c:{position:'WR'},d:{position:'QB'},
 e:{position:'RB'},f:{position:'WR'},g:{position:'WR'},h:{position:'TE'},
 i:{position:'QB'},j:{position:'WR'},k:{position:'RB'},l:{position:'TE'}
};
const teams=[
 {rosterId:1,teamName:'Mine',players:['a','c','d']},
 {rosterId:2,teamName:'Other A',players:['b','e','f','g','h']},
 {rosterId:3,teamName:'Other B',players:['i','j','k','l']},
];
const signal=(id:string,pos:string,direction:'rising'|'falling',n:number)=>({
 id,pos,direction,change:n,relativeChange:30,scoringChange:0
});
describe('Phase 5C personal research',()=>{
 it('uses league-specific starters and compares observed roster counts',()=>{
  const needs=rosterNeeds(teams,players,1,['QB','RB','RB','WR','TE','FLEX','SUPER_FLEX']);
  expect(needs.find(x=>x.pos==='RB')).toMatchObject({mine:1,required:2,shortage:1,level:'urgent'});
  expect(needs.find(x=>x.pos==='TE')).toMatchObject({mine:0,required:1,shortage:1,level:'urgent'});
  expect(needs.find(x=>x.pos==='WR')?.required).toBe(1);
 });
 it('does not invent a need for a missing team',()=>{
  expect(rosterNeeds(teams,players,999,['QB'])).toEqual([]);
 });
 it('enforces verified unrostered ownership and provider limitation',()=>{
  const rows=[
   {signal:signal('a','RB','rising',4),owner:null,match:'catalog' as const},
   {signal:signal('b','RB','rising',6),owner:teams[1],match:'roster' as const},
   {signal:signal('c','WR','rising',5),owner:null,match:'unmatched' as const},
   {signal:signal('d','QB','falling',-3),owner:null,match:'catalog' as const},
  ];
  const needs=rosterNeeds(teams,players,1,['QB','RB','RB','WR']);
  expect(decisionCandidates(rows,needs,1,'sleeper','waiver').map(x=>x.signal.id)).toEqual(['a']);
  expect(decisionCandidates(rows,needs,1,'yahoo','waiver')).toEqual([]);
  expect(decisionCandidates(rows,needs,1,'sleeper','trade').map(x=>x.signal.id)).toEqual(['b']);
 });
 it('only reports falling usage on the selected roster as a roster warning',()=>{
  const rows=[
    {signal:signal('a','RB','falling',-4),owner:teams[0],match:'roster' as const},
    {signal:signal('b','WR','falling',-5),owner:teams[1],match:'roster' as const},
    {signal:signal('c','QB','rising',6),owner:teams[0],match:'roster' as const},
  ];
  expect(decisionCandidates(rows,[],1,'sleeper','my-roster').map(x=>x.signal.id)).toEqual(['a']);
 });
});
