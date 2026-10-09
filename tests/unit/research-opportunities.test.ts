import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const O = require('../../public/research/opportunities.js');
function player(id: string, volumes: number[], points?: number[]) {
  return {id,n:'Test Player',pos:'RB',team:'SEA',ryr:2024,g:volumes.length,
    w:volumes.map((v, i) => [i+1,'SEA',points?.[i] ?? 10,0,0,0,v,0,0,0,0,0,0,0,0])};
}

describe('Opportunity Radar and historical receipts', () => {
  it('separates opportunity from fantasy points and never reads games after the as-of week', () => {
    const p=player('p1',[5,5,10,10,9,9],[20,20,4,4,40,40]);
    const early=O.signal(p,4,'half');
    expect(early.direction).toBe('rising');
    expect(early.scoringDirection).toBe('down');
    expect(early.baselineWeeks).toEqual([1,2]);
    expect(early.recentWeeks).toEqual([3,4]);
    expect(O.signal({...p,w:p.w.slice(0,4)},4,'half')).toEqual(early);
    expect(O.signal(p,3,'half')).toBeNull();
  });

  it('requires current games and verified QB attempts', () => {
    const p=player('old',[5,5,12,12]);
    expect(O.signal(p,9,'half')).toBeNull();
    const qb={...p,pos:'QB',u:[] as Array<{week:number;team:string;att:number}>};
    expect(O.signal(qb,4,'half')).toBeNull();
    qb.u=[1,2,3,4].map((week) => ({week,team:'SEA',att:week<3?20:35}));
    expect(O.signal(qb,4,'half').metric).toBe('pass attempts');
    const core={...qb,w:qb.w.map((row: (string | number)[],i: number) => [...row,i<2?20:35])};
    core.u=[];
    expect(O.signal(core,4,'half').direction).toBe('rising');
    // A stale optional usage file cannot override newer weekly core attempts.
    core.u=[1,2,3,4].map((week) => ({week,team:'SEA',att:1}));
    expect(O.signal(core,4,'half').recent).toBe(35);
  });

  it('scores two later games against the pre-signal baseline and leaves incomplete outcomes unresolved', () => {
    const p=player('p1',[5,5,10,10,9,9]);
    const rows=O.receipts({players:[p],throughWeek:6},'half');
    expect(rows[0].signal.week).toBe(4);
    expect(rows[0].nextWeeks).toEqual([5,6]);
    expect(rows[0].status).toBe('confirmed');
    expect(rows[0].difference).toBe(4);
    expect(O.receipts({players:[p],throughWeek:4},'half')[0].status).toBe('unresolved');
    expect(O.summary([{status:'unresolved'},{status:'confirmed'}])).toEqual({total:2,resolved:1,confirmed:1,rate:100});
  });

  it('preserves forward signal snapshots and resolves only after later games', () => {
    const p=player('p1',[5,5,10,10,9,9]);
    const first=O.recordSignals([],{year:2026,players:[p],throughWeek:4},'half','2026-10-09T12:00:00Z');
    expect(first).toHaveLength(1);
    const repeated=O.recordSignals(first,{year:2026,players:[p],throughWeek:4},'half','2026-10-10T12:00:00Z');
    expect(repeated).toEqual(first);
    expect(O.resolveRecorded(first,{year:2026,players:[p],throughWeek:4})[0].status).toBe('unresolved');
    expect(O.resolveRecorded(first,{year:2026,players:[p],throughWeek:6})[0].status).toBe('confirmed');
    expect(first[0].recordedAt).toBe('2026-10-09T12:00:00Z');
    expect(O.recordSignals([],{year:2025,players:[p],throughWeek:18},'half','later')).toEqual([]);
  });

  it('matches provider identity conservatively, including verified unrostered Sleeper players', () => {
    const players=[{id:'00-1',n:'A Player',pos:'RB',team:'SEA'},{id:'00-2',n:'B Player',pos:'WR',team:'SEA'},
      {id:'00-3',n:'C Player',pos:'WR',team:'LA'}];
    const teams=[{rosterId:1,teamName:'Team A',players:['s1']}];
    const providers={s1:{fullName:'A Player',position:'RB',nflTeam:'SEA'}};
    const catalog=[{id:'s1',gsisId:'00-1',name:'A Player',position:'RB',team:'SEA'},
      {id:'s2',gsisId:'00-2',name:'B Player',position:'WR',team:'SEA'}];
    const joined=O.ownership(players,teams,providers,catalog);
    expect(joined.map((row: {match:string})=>row.match)).toEqual(['catalog','catalog','unmatched']);
    expect(joined[0].owner.teamName).toBe('Team A');
    expect(joined[1].owner).toBeNull();
    expect(joined[2].owner).toBeNull();
    expect(O.ownership(players,teams,providers,[])[1].match).toBe('unmatched');
  });

  it('handles padded GSIS IDs, team aliases and missing name suffixes without guessing ambiguous identities', () => {
    const players=[{id:'00-0035057',n:'Ellis Richardson',pos:'RB',team:'SEA'},
      {id:'00-2',n:'Marvin Harrison Jr.',pos:'WR',team:'ARI'},
      {id:'00-3',n:'Kyren Williams',pos:'RB',team:'LA'},
      {id:'00-4',n:'Same Name Jr.',pos:'WR',team:'NYG'}];
    const catalog=[{id:'s1',gsisId:' 00-0035057',name:'Different Name',position:'RB',team:'SEA'},
      {id:'s2',gsisId:null,name:'Marvin Harrison',position:'WR',team:'ARI'},
      {id:'s3',gsisId:null,name:'Kyren Williams',position:'RB',team:'LAR'},
      {id:'s4',gsisId:null,name:'Same Name',position:'WR',team:'NYG'},
      {id:'s5',gsisId:null,name:'Same Name Jr.',position:'WR',team:'NYG'}];
    const matched=O.ownership(players,[],{},catalog);
    expect(matched.map((row: {providerId:string|null})=>row.providerId)).toEqual(['s1','s2','s3',null]);
  });

  it('uses verified rookie years and per-game production for development comparisons', () => {
    const first=player('p1',[5,5,5,5]);
    const second=player('p1',[8,8,8,8]);
    const history=O.development([{year:2024,throughWeek:18,players:[first]},
      {year:2025,throughWeek:4,players:[second]}],'p1','half');
    expect(history.map((s: {careerYear:number})=>s.careerYear)).toEqual([1,2]);
    expect(history[1].complete).toBe(false);
    expect(O.comparisons([{year:2025,throughWeek:4,players:[second]}],history[1],'half')).toEqual([]);
  });

  it('generates real signals from the archived research file', () => {
    const season=JSON.parse(readFileSync('public/research/data/2026.json','utf8'));
    const signals=O.radar(season,'half');
    expect(signals.length).toBeGreaterThan(20);
    expect(signals.every((s: {recentWeeks:number[]})=>s.recentWeeks.at(-1)!>=season.throughWeek-1)).toBe(true);
  });
});
