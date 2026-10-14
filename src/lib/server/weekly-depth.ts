import {unstable_cache} from 'next/cache';
import type {DepthEntry} from '@/lib/weekly-center';
type Snapshot={updated:string;players:DepthEntry[]};
type ByTeam=Record<string,Snapshot>;
function splitCsv(line:string):string[]{
 const fields:string[]=[];let cur='',quoted=false;
 for(let i=0;i<line.length;i++){
  const ch=line[i];
  if(ch==='"'){
   if(quoted&&line[i+1]==='"'){cur+='"';i++}
   else quoted=!quoted;
  }else if(ch===','&&!quoted){fields.push(cur);cur=''}
  else cur+=ch;
 }
 fields.push(cur);return fields;
}
/** Upstream CSV.gz is ~12MB; stream it and retain only the latest valid date per team. */
export async function readDepthArchive(year:number):Promise<ByTeam>{
 const url='https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_'+year+'.csv.gz';
 const response=await fetch(url,{next:{revalidate:86400},signal:AbortSignal.timeout(25000)});
 if(!response.ok||!response.body)throw Error('Depth archive unavailable');
 const reader=response.body.pipeThrough(new DecompressionStream('gzip')).getReader();
 const decoder=new TextDecoder();
 let remainder='',columns:string[]|null=null,parsed=0;
 const result:ByTeam={};
 function handle(line:string){
  if(!line.trim())return;
  const fields=splitCsv(line);
  if(!columns){
   columns=fields.map(x=>x.replace(/^\uFEFF/,'').trim());
   for(const required of ['dt','team','player_name','pos_rank'])
    if(!columns.includes(required))throw Error('Unknown depth-chart schema: missing '+required);
   return;
  }
  parsed++;if(parsed>1_500_000)throw Error('Unexpected depth-chart size');
  function col(name:string){const i=columns!.indexOf(name);return i<0?'':fields[i]||''}
  const team=col('team'),date=col('dt'),name=col('player_name').trim(),rank=Number(col('pos_rank'));
  if(!/^[A-Z]{2,3}$/.test(team)||!/^20\d\d-\d\d-\d\d/.test(date)||!name||name.length>150||
    !Number.isFinite(rank)||rank<1||rank>=12)return;
  const existing=result[team];
  if(existing&&existing.updated>date)return;
  if(!existing||existing.updated<date)result[team]={updated:date,players:[]};
  if(result[team].players.length<170)result[team].players.push({
   team,id:col('gsis_id')||null,name,rank,updated:date,
   position:col('pos_abb')||col('pos_grp')||col('pos_name')||'Unknown'
  });
 }
 try {
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   remainder+=decoder.decode(value,{stream:true});
   if(remainder.length>2_000_000)throw Error('Unexpected depth-chart row');
   let idx:number;
   while((idx=remainder.indexOf('\n'))>=0){
    const line=remainder.slice(0,idx).replace(/\r$/,'');
    remainder=remainder.slice(idx+1);
    handle(line);
   }
  }
  remainder+=decoder.decode();
  if(remainder.trim())handle(remainder);
 }finally {reader.releaseLock();}
 if(Object.keys(result).length<20)throw Error('Incomplete depth-chart archive');
 for(const snapshot of Object.values(result)){
  snapshot.players.sort((a,b)=>a.position.localeCompare(b.position)||a.rank-b.rank||a.name.localeCompare(b.name));
 }
 return result;
}
const cached=unstable_cache(readDepthArchive,['leaguezone-nflverse-depth-compact-v1'],{revalidate:86400});
export async function depthForTeam(year:number,team:string):Promise<Snapshot>{
 const result=(await cached(year))[team];
 if(!result||!result.players.length)throw Error('Depth chart not published');
 return result;
}
