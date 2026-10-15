import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {getPlatformNavigationSection,PLATFORM_NAV} from '@/lib/navigation/platform';

describe('global navigation',()=>{
 it('shows the six top-level sections, even without an authenticated user',()=>{
  expect(PLATFORM_NAV.map(item=>item.label)).toEqual(['Home','League Websites','Research','Tools','Demo League','Hub']);
 });
 it('groups practical decisions under Tools, not behind Research',()=>{
  const tools=PLATFORM_NAV.find(section=>section.id==='tools');
  expect(tools?.links.map(link=>link.label)).toEqual(expect.arrayContaining([
   'Start / Bench Advisor','Waiver & Pickup Finder','Trade Analyzer','Development Lab','Player Rankings','Taxi Squad Advisor']));
  expect(getPlatformNavigationSection('/research/development')).toBe('tools');
  expect(getPlatformNavigationSection('/fantasy-tools/trade')).toBe('tools');
  expect(getPlatformNavigationSection('/research/stats')).toBe('research');
  expect(getPlatformNavigationSection('/app/leagues')).toBe('hub');
  expect(PLATFORM_NAV[0].href).toBe('/?view=public');
 });
 it('keeps the standalone Research header destinations in sync',()=>{
  const html=readFileSync('public/research/index.html','utf8');
  const links=[...html.matchAll(/<a href="([^"]+)" data-platform-destination="([^"]+)"/g)]
    .map(([,href,id])=>({href:href.replaceAll('&amp;','&'),id}));
  const expected=PLATFORM_NAV.flatMap(section=>section.links.map(link=>({href:link.href,id:section.id})));
  expect(links).toEqual(expected);
 });
 it('keeps the five bottom destinations aligned across shells',()=>{
  const html=readFileSync('public/research/index.html','utf8');
  const strip=html.match(/<nav class="lz-research-tabs"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
  const tabHrefs=[...strip.matchAll(/<a href="([^"]+)" data-tab/g)].map(match=>match[1]);
  expect(tabHrefs).toEqual(['/?view=public','/features','/research','/fantasy-tools','/app']);
 });
});
