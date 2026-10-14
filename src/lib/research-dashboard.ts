import type { ResearchPosition } from '@/lib/dashboard-preferences';

export type DashboardPlayer={id:string;n:string;pos:ResearchPosition|string;team:string;w:(string|number|null)[][];g?:number};
export type ResearchSnapshot={year:number;throughWeek:number;players:DashboardPlayer[];source:'live'|'backup';updated?:string};
export type RadarSignal={id:string;name:string;team:string;pos:string;week:number;baseline:number;recent:number;direction:'rising'|'falling'|'steady';metric:string;relativeChange:number;scoringBefore:number;scoringRecent:number;baselineWeeks:number[];recentWeeks:number[]};
export type RecentResearch={href:string;title:string;visitedAt:number};
type Fetcher=(input:string,init?:RequestInit)=>Promise<Response>;
const OBJECT_KEY=/^research\/v1\/objects\/(20\d\d)-[a-f0-9]{64}\.json$/;
async function readJson(fetcher:Fetcher,url:string,cache:RequestCache):Promise<unknown>{
 const r=await fetcher(url,{cache});
 if(!r.ok)throw Error('Research unavailable');
 return r.json();
}
export function validateResearchSnapshot(d:unknown,year:number):ResearchSnapshot{
 if(!d||typeof d!=='object')throw Error('Invalid season');
 const item=d as Partial<ResearchSnapshot>;
 if(item.year!==year||!Number.isInteger(item.throughWeek)||!item.throughWeek||
    !Array.isArray(item.players)||item.players.length<100)throw Error('Incomplete season');
 const ids=new Set<string>();
 for(const p of item.players){
   if(!p||typeof p.id!=='string'||!p.id||typeof p.n!=='string'||!Array.isArray(p.w)||ids.has(p.id))
      throw Error('Invalid player directory');
   ids.add(p.id);
 }
 return {year,throughWeek:item.throughWeek,players:item.players,source:'backup',updated:item.updated};
}
function newest(years:unknown):number{
 if(!Array.isArray(years)||!years.length||years.some(y=>!Number.isInteger(y)||y<2000||y>2100))
  throw Error('Invalid season list');
 return Math.max(...years as number[]);
}
// Read one validated static/R2 season per dashboard visit. No server DB call.
export async function loadDashboardResearch(fetcher:Fetcher=(url,options)=>fetch(url,options)):Promise<ResearchSnapshot>{
 try {
  const base='/api/research-feed';
  const catalog=await readJson(fetcher,base+'/research/v1/catalog.json','no-cache') as {schema?:number;years?:number[];files?:Record<string,{key:string}>};
  if(catalog.schema!==1||!catalog.files)throw Error('Invalid published catalog');
  const year=newest(catalog.years),key=catalog.files[String(year)]?.key;
  if(!key||!OBJECT_KEY.test(key)||Number(OBJECT_KEY.exec(key)?.[1])!==year)throw Error('Invalid published object');
  return {...validateResearchSnapshot(await readJson(fetcher,base+'/'+key,'default'),year),source:'live'};
 } catch { /* Cross-origin Worker and bundled archive remain as fallbacks. */ }
 try{
  const conf=await readJson(fetcher,'/research/data-source.json','no-store') as {publicBase?:string};
  const base=String(conf?.publicBase||'').replace(/\/+$/,'');
  if(!/^https:\/\/[^/]+$/i.test(base)||/\.r2\.dev$/i.test(new URL(base).hostname))throw Error('No published R2');
  const catalog=await readJson(fetcher,base+'/research/v1/catalog.json','no-cache') as {schema?:number;years?:number[];files?:Record<string,{key:string}>};
  if(catalog.schema!==1||!catalog.files)throw Error('Invalid catalog');
  const year=newest(catalog.years),key=catalog.files[String(year)]?.key;
  if(!key||!OBJECT_KEY.test(key)||Number(OBJECT_KEY.exec(key)?.[1])!==year)throw Error('Invalid object key');
  return {...validateResearchSnapshot(await readJson(fetcher,base+'/'+key,'default'),year),source:'live'};
 }catch{
  const manifest=await readJson(fetcher,'/research/data/seasons.json','no-cache') as {years:number[]};
  const year=newest(manifest.years);
  return validateResearchSnapshot(await readJson(fetcher,'/research/data/'+year+'.json','default'),year);
 }
}
export function safeRecent(value:unknown):RecentResearch[]{
 if(!Array.isArray(value))return [];
 const seen=new Set<string>();
 return value.filter((x):x is RecentResearch=>{
  if(!x||typeof x!=='object'||typeof x.href!=='string'||typeof x.title!=='string'||
     typeof x.visitedAt!=='number'||!Number.isFinite(x.visitedAt))return false;
  if(!/^\/research(?:\/|$)/.test(x.href)||x.href.startsWith('//')||
     /[\\\u0000-\u001f]/.test(x.href)||x.href.length>750||x.title.length>150||
     x.visitedAt<0||x.visitedAt>Date.now()+86_400_000||seen.has(x.href))return false;
  seen.add(x.href);return true;
 }).slice(0,12);
}
export function ownershipLabel(playerId:string,payload:unknown):string{
 const p=payload as {catalog?:Array<{id:string;gsisId:string|null}>;teams?:Array<{rosterId:number;teamName:string;players:string[]}>;viewerRosterId?:number|null};
 if(!p||!Array.isArray(p.catalog)||!Array.isArray(p.teams))return 'Roster data unavailable';
 const match=p.catalog.find(x=>x.gsisId===playerId);
 if(!match)return 'Identity not verified';
 const owner=p.teams.find(t=>Array.isArray(t.players)&&t.players.includes(match.id));
 if(!owner)return 'Not rostered in snapshot';
 return owner.rosterId===p.viewerRosterId?'On my roster':'Rostered by '+owner.teamName;
}
