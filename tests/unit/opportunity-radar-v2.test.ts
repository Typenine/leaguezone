import {describe,it,expect} from 'vitest';
import radarEngine from '../../public/research/opportunities.js';

type Player = {id:string;n:string;pos:string;team:string;w:unknown[][];u?:Record<string,unknown>[];c?:unknown[][];i?:unknown[][]};
const O=radarEngine as {radar:(data:{throughWeek:number;players:Player[]},format:string)=>any[]};
function fixture(options:{low?:boolean;teammate?:boolean;blowout?:boolean;noSnaps?:boolean}={}) {
 const {low=false,teammate=false,blowout=false,noSnaps=false}=options;
 const before=low?1:5,after=low?5:13;
 const player:Player={
  id:'a',n:'Runner A',pos:'RB',team:'AAA',
  w:[1,2,3,4].map((week)=>[week,'AAA',8,1,1,15,
   week<3?before:after,week<3?25:80,0,0,0,0,0,0,0]),
  u:[1,2,3,4].map((week)=>({week,team:'AAA',car:week<3?before:after,
   tgt:1,teamCar:29,teamTgt:11})),
  c:noSnaps?[]:[1,2,3,4].map(week=>[week,'AAA',week<3?35:70,
   week<3?25:50,blowout&&week>=3?25:3])
 };
 const players=[player];
 if(teammate)players.push({id:'b',n:'Runner B',pos:'RB',team:'AAA',
  w:[],c:[[1,'AAA',55,38,3],[2,'AAA',52,37,3]]});
 return {throughWeek:4,players};
}
describe('Opportunity Radar v2 evidence quality',()=>{
 it('treats rising snaps and team workload share as supportive evidence, not a guaranteed breakout',()=>{
  const [s]=O.radar(fixture(),'half');
  expect(s.verdict).toBe('supported');
  expect(s.snapChange).toBe(35);
  expect(s.shareChange).toBeGreaterThan(3);
  expect(s.supported).toBe(true);
 });
 it('downgrades percentage spikes off a tiny workload',()=>{
  const [s]=O.radar(fixture({low:true}),'half');
  expect(s.relativeChange).toBeGreaterThan(50);
  expect(s.verdict).toBe('low-volume');
  expect(s.supported).toBe(false);
 });
 it('flags established teammates disappearing from offensive snaps without inferring an injury',()=>{
  const [s]=O.radar(fixture({teammate:true}),'half');
  expect(s.verdict).toBe('context-dependent');
  expect(s.teammatesMissingRole).toEqual(['Runner B']);
  expect(s.riskFlags.join(' ')).toContain('do not assume injury');
 });
 it('uses an official OUT report only to corroborate a missing teammate, not prove causation',()=>{
  const data=fixture({teammate:true});
  data.players[1].i=[[3,'OUT']];
  const [s]=O.radar(data,'half');
  expect(s.teammatesReportedOut).toEqual(['Runner B (Week 3)']);
  expect(s.riskFlags.join(' ')).toContain('Official injury reports listed OUT');
  expect(s.verdict).toBe('context-dependent');
 });
 it('treats lopsided final scores as uncertain game script, not proven garbage time',()=>{
  const [s]=O.radar(fixture({blowout:true}),'half');
  expect(s.verdict).toBe('context-dependent');
  expect(s.gameScriptRisk).toBe(2);
  expect(s.riskFlags.join(' ')).toContain('unverified');
 });
 it('does not manufacture snap confidence when the source is unavailable',()=>{
  const [s]=O.radar(fixture({noSnaps:true}),'half');
  expect(s.verdict).toBe('unverified');
  expect(s.snapRecent).toBeNull();
 });
 it('never uses games after the requested as-of week',()=>{
  const data=fixture();
  data.players[0].w.push([5,'AAA',10,1,1,40,0,0,0,0,0,0,0,0,0]);
  expect(O.radar(data,'half')[0].week).toBe(4);
 });
});
