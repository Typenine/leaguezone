import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');

describe('fantasy connection and hub navigation',()=>{
 it('connects saved team, account-preferred selection, and public tools without requiring sign-in',()=>{
  const state=read('src/lib/fantasy/remembered-league.ts');
  expect(state).toContain('readRememberedLeague');
  expect(state).toContain('preferredSleeperTeam');
  expect(state).toContain("if(response.status===401)");
  expect(read('src/app/api/research/sleeper/connections/route.ts')).toContain('export async function PATCH');
  const tools=read('src/components/fantasy/PublicFantasyWorkbench.tsx');
  expect(tools).toContain('loadSavedSleeperTeams()');
  expect(tools).toContain("'/api/research/sleeper/context?leagueId='");
  expect(tools).toContain("<TradeAnalyzerPage />");
  expect(tools).toContain("tool==='trade'");
  expect(tools).toContain('parseSleeperLeagueInput');
  expect(tools).toContain('setPreview(null);setContext(null)');
  const card=read('src/components/fantasy/ConnectedLeagueCard.tsx');
  expect(card).toContain("account?'/app/fantasy-team?");
  expect(card).toContain("publicToolUrl('roster',selected.leagueId,selected.rosterId)");
  expect(read('src/app/api/public-fantasy/league/route.ts')).toContain('},state)');
  expect(read('src/app/api/public-fantasy/league/route.ts')).toContain('export const maxDuration=60');
 });
 it('keeps the Hub organized and does not embed the full research dashboard',()=>{
  expect(read('src/app/app/page.tsx')).toContain('<ConnectedLeagueCard />');
  expect(read('src/app/app/page.tsx')).not.toContain('<MyResearchDashboard');
  const nav=read('src/components/layout/HubSectionNav.tsx');
  for(const route of ['/app/fantasy-team','/fantasy-tools','/my-research','/saved','/app/leagues'])
   expect(nav).toContain(route);
  expect(read('src/app/layout.tsx')).toContain('<HubSectionNav outsideApp />');
 });
 it('retains identical six-section menus on static and React shells',()=>{
  const research=read('public/research/index.html');
  const react=read('src/lib/navigation/platform.ts');
  for(const label of ['League Websites','Research','Tools','Demo League','Hub']){
   expect(research).toContain(label);
   expect(react).toContain(label);
  }
  expect(research).toContain('brand-image');
  expect(research).toContain('href="/install" class="btn outline">Get the App</a>');
 });
});
