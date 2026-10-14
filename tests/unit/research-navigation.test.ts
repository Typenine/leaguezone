import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {RESEARCH_DESTINATIONS,researchSectionKey} from '@/lib/navigation/research';
import {getNavigationSurface} from '@/lib/navigation/surfaces';
describe('cross-shell research navigation',()=>{
 it('classifies every new platform page as platform, not legacy league',()=>{
  for(const path of ['/weekly','/my-research','/saved','/search','/research/players/00-123','/app'])
    expect(getNavigationSurface(path)).toBe('platform');
 });
 it('selects the correct research tab for every tool and player profile',()=>{
  for(const route of RESEARCH_DESTINATIONS)
   expect(researchSectionKey(route.href)).toBe(route.key);
  expect(researchSectionKey('/research/players/00-0031234')).toBe('players');
  expect(researchSectionKey('/l/east-v-west')).toBeNull();
  expect(researchSectionKey('/weekly?week=5')).toBeNull(); // pathnames never include queries
 });
 it('keeps static shell nav in sync with the React navigation registry',()=>{
  const html=readFileSync('public/research/index.html','utf8');
  const links=[...html.matchAll(/<a\s+href="([^"]+)"\s+data-research-tool="([^"]+)"/g)]
    .map(([,href,key])=>({href,key}));
  expect(links).toEqual(RESEARCH_DESTINATIONS.map(({href,key})=>({href,key})));
 });
 it('never inserts the research nav into league-admin routes',()=>{
  for(const path of ['/l/league/admin','/setup','/login','/teams'])
   expect(researchSectionKey(path)).toBeNull();
 });
});
