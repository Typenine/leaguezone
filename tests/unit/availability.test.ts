import {describe,it,expect} from 'vitest';
import {diffAvailability,keyPlayer,labelStatus,matchResearchPlayer,normalizeSleeperPlayers,practiceValue} from '@/lib/availability';
const make=(o:Record<string,unknown>)=>({team:'GB',position:'RB',full_name:'Test Runner',status:'Active',...o});
function source(p:Record<string,unknown>){return Object.fromEntries(Array.from({length:110},(_,i)=>[
 String(i+100),i===0?p:{full_name:'Different '+i,position:'RB',team:'GB',injury_status:'Q'}
]));}
describe('injury metadata adapter and safeguards',()=>{
 it('normalizes a report without treating missing status as healthy',()=>{
  const players=normalizeSleeperPlayers(source(make({injury_status:'Questionable',practice_participation:'Limited',gsis_id:'00-111',player_id:'100'})));
  const first=players.find(p=>p.name==='Test Runner')!;
  expect(first.injuryStatus).toBe('Questionable');
  expect(first.practice).toBe('Limited');
  expect(first.gsisId).toBe('00-111');
  expect(labelStatus(first)).toBe('Questionable');
  expect(normalizeSleeperPlayers(source(make({})))).toHaveLength(109);
 });
 it('does not invent an injury designation from NFL roster active status',()=>{
  expect(normalizeSleeperPlayers(source(make({practice_participation:null,injury_status:null,status:'Active'})))).toHaveLength(109);
 });
 it('recognizes practice terminology without equating DNP with out for the game',()=>{
  expect(practiceValue('Did Not Practice')).toBe('DNP');
  expect(practiceValue('Limited')).toBe('Limited');
  expect(practiceValue('Full Participation')).toBe('Full');
  expect(practiceValue(null)).toBeNull();
 });
 it('only joins a research profile by GSIS ID or unambiguous exact name/team/position',()=>{
  const [p]=normalizeSleeperPlayers(source(make({gsis_id:'GSIS',injury_status:'Out'}))).filter(p=>p.name==='Test Runner');
  expect(matchResearchPlayer([p],{id:'GSIS',n:'Completely Different',team:'GB',pos:'RB'})).toBe(p);
  expect(matchResearchPlayer([p],{id:'NOT-GSIS',n:'Test Runner',team:'GB',pos:'RB'})).toBeNull();
  const without={...p,gsisId:null};
  expect(matchResearchPlayer([without],{id:'OTHER',n:'Test Runner',team:'GB',pos:'RB'})).toEqual(without);
  expect(matchResearchPlayer([without,without],{id:'OTHER',n:'Test Runner',team:'GB',pos:'RB'})).toBeNull();
  expect(matchResearchPlayer([without],{id:'OTHER',n:'Test Runner',team:'DET',pos:'RB'})).toBeNull();
 });
 it('records only observed field changes after a baseline; never infers healthy',()=>{
  const [out]=normalizeSleeperPlayers(source(make({injury_status:'Out'}))).filter(p=>p.name==='Test Runner');
  const start=diffAvailability(undefined,[out],100000);
  expect(start.events).toHaveLength(0);
  const next=diffAvailability(start,[{...out,injuryStatus:'Questionable'}],200000);
  expect(next.events).toMatchObject([{key:keyPlayer(out),previous:'Out |  | ',current:'Questionable |  | '}]);
  const empty=diffAvailability(next,[],300000);
  expect(empty.events).toHaveLength(1);
 });
 it('rejects malformed and empty source payloads',()=>{
  expect(()=>normalizeSleeperPlayers([])).toThrow();
  expect(()=>normalizeSleeperPlayers({1:{team:'GB'}})).toThrow();
 });
});
