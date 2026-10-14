import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
function luminance(hex:string){
 const n=hex.slice(1).match(/.{2}/g)!.map(x=>parseInt(x,16)/255)
  .map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
 return n[0]*0.2126+n[1]*0.7152+n[2]*0.0722;
}
function contrast(a:string,b:string){
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
describe('site theme and research text contrast',()=>{
 it('does not force the closed native select foreground with unlayered global CSS',()=>{
  const css=read('src/app/native-select-theme.css');
  // The former unlayered "html[data-theme=light] select { color: #0B1020; }"
  // defeated text-white on dark research controls when visitors chose light mode.
  for(const block of css.matchAll(/(?:^|\n)(?:html\[data-theme="[^"]+"\]\s+)?select\s*\{([^}]+)\}/g))
   expect(block[1]).not.toMatch(/(?:^|;)\s*color\s*:/);
  expect(css).toContain('.lz-dark-surface select');
 });
 it('uses high contrast on both light and dark research surfaces',()=>{
  expect(contrast('#725916','#f8faff')).toBeGreaterThanOrEqual(4.5);
  expect(contrast('#e2bc71','#04090f')).toBeGreaterThanOrEqual(4.5);
  expect(contrast('#e9edf5','#122740')).toBeGreaterThanOrEqual(4.5);
 });
 it('marks fixed dark surfaces independently from user theme',()=>{
  expect(read('src/components/research/WeeklyCenter.tsx')).toContain('lz-dark-surface');
  expect(read('src/components/research/MyResearchDashboard.tsx')).toContain('lz-dark-surface');
  expect(read('src/app/app/page.tsx')).toContain('lz-dark-surface');
 });
 it('uses accessible themed accent on light research cards',()=>{
  for(const path of ['src/components/research/SavedResearch.tsx',
   'src/components/research/UniversalSearch.tsx',
   'src/components/research/PlayerLeagueLookup.tsx',
   'src/app/profile/page.tsx']){
   expect(read(path)).toContain('text-[var(--research-link)]');
   expect(read(path)).not.toContain('text-[var(--brand-gold)]');
  }
 });
});
