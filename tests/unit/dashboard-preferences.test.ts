import {describe,expect,it} from 'vitest';
import {DASHBOARD_SECTIONS,DEFAULT_DASHBOARD_PREFERENCES,normalizeDashboardPreferences,moveSection} from '@/lib/dashboard-preferences';
import {safeRecent,ownershipLabel,validateResearchSnapshot} from '@/lib/research-dashboard';
describe('dashboard personalization',()=>{
 it('validates persisted layout and never trusts arbitrary section names',()=>{
  const p=normalizeDashboardPreferences({sections:['recent','feed','feed','unsafe'],hidden:['leagues','hijack'],
   scoring:'garbage',positions:['WR','RB','QB','evil'],favoriteLeagueId:'javascript:alert(1)'});
  expect(p.sections).toEqual(['recent','feed','activity','leagues']);
  expect(p.hidden).toEqual(['leagues']);
  expect(p.scoring).toBe('half');
  expect(p.positions).toEqual(['WR','RB','QB']);
  expect(p.favoriteLeagueId).toBeNull();
 });
 it('preserves sections while rearranging them',()=>{
  const next=moveSection(DEFAULT_DASHBOARD_PREFERENCES,'recent',-1);
  expect(next.sections).toEqual(['activity','feed','recent','leagues']);
  expect(moveSection(next,'activity',-1)).toBe(next);
  expect(new Set(next.sections)).toEqual(new Set(DASHBOARD_SECTIONS));
 });
 it('does not accept zero selected positions or unexpected scoring',()=>{
  expect(normalizeDashboardPreferences({positions:[],scoring:'two'})).toMatchObject({scoring:'half',positions:['QB','RB','WR','TE','K','DEF']});
 });
 it('rejects arbitrary URLs from recently viewed research',()=>{
  const now=Date.now(),good={href:'/research/players/00-123',title:'Test player',visitedAt:now};
  expect(safeRecent([good,good,{...good,href:'//attacker.test'}, {...good,href:'/api/private'},
   {...good,visitedAt:Infinity}])).toEqual([good]);
 });
 it('returns ownership status only after verified GSIS identity match',()=>{
  const data={catalog:[{id:'provider-1',gsisId:'gsis1'}],teams:[{rosterId:5,teamName:'Mine',players:['provider-1']}],viewerRosterId:5};
  expect(ownershipLabel('gsis1',data)).toBe('On my roster');
  expect(ownershipLabel('gsis2',data)).toBe('Identity not verified');
  expect(ownershipLabel('gsis1',{...data,viewerRosterId:6})).toBe('Rostered by Mine');
  expect(ownershipLabel('gsis1',{...data,teams:[]})).toBe('Not rostered in snapshot');
 });
 it('rejects corrupt R2 payloads without erasing bookmarked players',()=>{
  expect(()=>validateResearchSnapshot({year:2026,throughWeek:2,players:[]},2026)).toThrow();
  expect(()=>validateResearchSnapshot({year:2025,throughWeek:2,players:[]},2026)).toThrow();
 });
});
