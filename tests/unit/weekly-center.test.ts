import {describe,it,expect} from 'vitest';
import {csvRows,normalizeGames,defenseAllowed,effectiveWeek,newestDepth,eastKickoff} from '@/lib/weekly-center';
const data=[
 {season:'2026',week:'1',game_type:'REG',game_id:'2026_01_BUF_KC',home_team:'KC',away_team:'BUF',
  home_score:'27',away_score:'24',gameday:'2026-09-10',gametime:'20:20',stadium:'GEHA Field at Arrowhead Stadium',roof:'outdoors'},
 {season:'2026',week:'2',game_type:'REG',game_id:'2026_02_BUF_MIA',home_team:'MIA',away_team:'BUF',
  home_score:'17',away_score:'21',gameday:'2026-09-17',gametime:'20:15',stadium:'Hard Rock Stadium',roof:'outdoors'}
];
describe('weekly center normalization and calculations',()=>{
 it('parses quoted CSV without losing commas/newlines',()=>{
  const csv='season,stadium,team\n2026,"AT&T, Dallas",DAL\n2025,"North\\nEnd",BUF\n'.replace('\\n','\n');
  const parsed=csvRows(csv);
  expect(parsed).toHaveLength(2);
  expect(parsed[0].stadium).toBe('AT&T, Dallas');
  expect(parsed[1].season).toBe('2025');
 });
 it('supports the 2025+ depth-chart schema without season field',()=>{
  const rows=csvRows('dt,team,player_name,gsis_id,pos_abb,pos_rank\n2026-10-01,BUF,Earlier,id,QB,1\n2026-10-14,BUF,Latest,id,QB,1\n','dt');
  const d=newestDepth(rows,'BUF');
  expect(d.players.map(p=>p.name)).toEqual(['Latest']);
  expect(d.updated).toBe('2026-10-14');
 });
 it('treats final and upcoming games separately and retains roof and stadium',()=>{
  const games=normalizeGames([...data,{...data[1],game_id:'2026_03_NYG_DAL',home_team:'DAL',away_team:'NYG',
   week:'3',away_score:'',home_score:''}],2026);
  expect(games).toHaveLength(3);
  expect(games[2].status).toBe('scheduled');
  expect(games[1].stadium).toBe('Hard Rock Stadium');
  expect(effectiveWeek(games,Date.parse('2026-09-18T00:00:00Z'))).toBe(3);
  expect(normalizeGames(data,2025)).toThrow();
 });
 it('normalizes Eastern kickoff including DST changes',()=>{
  expect(eastKickoff('2026-10-11','13:00')).toBe('2026-10-11T17:00:00.000Z');
  expect(eastKickoff('2026-11-08','13:00')).toBe('2026-11-08T18:00:00.000Z');
  expect(eastKickoff('not-a-date','13:00')).toBeNull();
 });
 it('uses games as the denominator, position totals and scoring adjustment',()=>{
  const games=normalizeGames(data,2026);
  const players=[
    {id:'x',n:'First',pos:'WR',team:'BUF',w:[[1,'BUF',12,4],[2,'BUF',10,2]]},
    {id:'y',n:'Second',pos:'WR',team:'BUF',w:[[1,'BUF',8,2]]},
    {id:'z',n:'Third',pos:'WR',team:'KC',w:[[1,'KC',18,4]]}
  ];
  const result=defenseAllowed({year:2026,throughWeek:2,players},games,'half');
  const kc=result.find(x=>x.team==='KC'&&x.position==='WR');
  const mia=result.find(x=>x.team==='MIA'&&x.position==='WR');
  const buf=result.find(x=>x.team==='BUF'&&x.position==='WR');
  expect(kc?.avg).toBe(17); // 12 - 2 + 8 - 1 from BUF receivers.
  expect(mia?.avg).toBe(9); // 10 - 1 in week two.
  expect(buf?.avg).toBe(8); // (18 - 2) / 2 completed games.
  expect(kc?.games).toBe(1);
  expect(buf?.games).toBe(2);
  expect(kc?.rank).toBe(1);
 });
});
