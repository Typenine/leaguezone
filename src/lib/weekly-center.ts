export type NflGame = {
  id:string; season:number; week:number; away:string; home:string;
  kickoff:string|null; stadium:string|null; roof:string|null;
  awayScore:number|null; homeScore:number|null; status:'final'|'scheduled';
};
export type Position='QB'|'RB'|'WR'|'TE';
export type CoreWeeklyPlayer={id:string;n:string;pos:string;team:string;w:(string|number|null)[][]};
export type CoreSeason={year:number;throughWeek:number;players:CoreWeeklyPlayer[]};
export type DefenseMetric={team:string;position:Position;games:number;avg:number;recent:number|null;leagueAvg:number;rank:number};
export const POSITIONS:Position[]=['QB','RB','WR','TE'];
export const TEAM_CODES=new Set('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' '));

/** Standards-compliant quoted CSV reader, including commas and newlines in fields. */
export function csvRows(input:string,requiredHeader:string='season'):Record<string,string>[] {
  if(input.length>25_000_000)throw Error('Source too large');
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(ch==='"'){
      if(quoted&&input[i+1]==='"'){field+='"';i++}
      else quoted=!quoted;
    }else if(ch===','&&!quoted){row.push(field);field=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&input[i+1]==='\n')i++;
      row.push(field);field='';if(row.some(x=>x!==''))rows.push(row);
      row=[];if(rows.length>150000)throw Error('Too many rows');
    }else field+=ch;
  }
  if(quoted)throw Error('Invalid CSV');
  if(field!==''||row.length){row.push(field);rows.push(row)}
  const header=rows.shift()?.map(x=>x.replace(/^\uFEFF/,'').trim());
  if(!header||!header.includes(requiredHeader))throw Error('Missing CSV header');
  return rows.map(fields=>Object.fromEntries(header.map((h,i)=>[h,fields[i]||''])));
}
function readNumber(v:string):number|null{
  if(v===''||v==='NA'||v==='NULL')return null;
  const n=Number(v);return Number.isFinite(n)?n:null;
}
const etParts=new Intl.DateTimeFormat('en-US',{
 timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',
 hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
/** NFL source publishes scheduled kickoff in Eastern wall time. */
export function eastKickoff(day:string,time:string):string|null{
 if(!/^20\d\d-\d\d-\d\d$/.test(day)||!/^\d{1,2}:\d{2}$/.test(time))return null;
 const [hour,minute]=time.split(':').map(Number);
 if(hour>23||minute>59)return null;
 const assumed=Date.parse(day+'T'+time.padStart(5,'0')+':00Z');
 if(!Number.isFinite(assumed))return null;
 const parts=Object.fromEntries(etParts.formatToParts(new Date(assumed)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 const eastAsUtc=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
 const offset=eastAsUtc-assumed;
 return new Date(assumed-offset).toISOString();
}
export function normalizeGames(rows:Record<string,string>[],year:number):NflGame[]{
 const result:NflGame[]=[],ids=new Set<string>();
 for(const r of rows){
  if(Number(r.season)!==year||r.game_type!=='REG')continue;
  const week=Number(r.week),id=r.game_id,home=r.home_team,away=r.away_team;
  if(!Number.isInteger(week)||week<1||week>18||!TEAM_CODES.has(home)||!TEAM_CODES.has(away)||
     home===away||!/^20\d\d_\d\d_/.test(id)||ids.has(id))continue;
  ids.add(id);
  const hs=readNumber(r.home_score),as=readNumber(r.away_score);
  const final=hs!==null&&as!==null;
  result.push({id,season:year,week,home,away,kickoff:eastKickoff(r.gameday,r.gametime),
   stadium:r.stadium||null,roof:r.roof||null,homeScore:final?hs:null,awayScore:final?as:null,
   status:final?'final':'scheduled'});
 }
 result.sort((a,b)=>a.week-b.week||(a.kickoff||'').localeCompare(b.kickoff||'')||a.id.localeCompare(b.id));
 if(!result.length)throw Error('No regular season games in schedule');
 return result;
}
function point(row:(string|number|null)[],score:'ppr'|'half'|'standard'):number|null{
 const base=Number(row[2]),rec=Number(row[3]);
 if(!Number.isFinite(base)||!Number.isFinite(rec))return null;
 return +(base-(score==='ppr'?0:score==='half'?0.5:1)*rec).toFixed(2);
}
/** Scores allowed per defensive-team game, never per fantasy player. */
export function defenseAllowed(snapshot:CoreSeason,games:NflGame[],score:'ppr'|'half'|'standard'):DefenseMetric[]{
 if(!snapshot||!Array.isArray(snapshot.players)||!Number.isInteger(snapshot.throughWeek))return [];
 const played=games.filter(g=>g.status==='final'&&g.week<=snapshot.throughWeek);
 const matchByTeam=new Map<string,string>(),byDefense=new Map<string,number[]>();
 for(const g of played){
  matchByTeam.set(g.week+'|'+g.home,g.away);matchByTeam.set(g.week+'|'+g.away,g.home);
  for(const team of [g.home,g.away])for(const pos of POSITIONS)byDefense.set(team+'|'+pos+'|'+g.week,[]);
 }
 for(const p of snapshot.players) {
  if(!POSITIONS.includes(p.pos as Position)||!Array.isArray(p.w))continue;
  for(const w of p.w){
   const week=Number(w[0]),offense=String(w[1]||'');
   const defense=matchByTeam.get(week+'|'+offense);
   if(!defense)continue;
   const pts=point(w,score),key=defense+'|'+p.pos+'|'+week;
   if(pts!==null&&byDefense.has(key))byDefense.get(key)!.push(pts);
  }
 }
 const detail=new Map<string,{week:number;total:number}[]>();
 for(const [key,values] of byDefense){
  const [team,pos,w]=key.split('|'),k=team+'|'+pos;
  if(!detail.has(k))detail.set(k,[]);
  detail.get(k)!.push({week:Number(w),total:values.reduce((a,b)=>a+b,0)});
 }
 const result:DefenseMetric[]=[];
 for(const [key,values] of detail){
  const [team,position]=key.split('|') as [string,Position];
  values.sort((a,b)=>a.week-b.week);
  if(values.length<1)continue;
  const avg=values.reduce((sum,v)=>sum+v.total,0)/values.length;
  const recent=values.slice(-3),last=recent.length>=2?recent.reduce((sum,v)=>sum+v.total,0)/recent.length:null;
  result.push({team,position,games:values.length,avg:+avg.toFixed(1),recent:last===null?null:+last.toFixed(1),leagueAvg:0,rank:0});
 }
 for(const pos of POSITIONS){
  const peers=result.filter(x=>x.position===pos).sort((a,b)=>b.avg-a.avg||a.team.localeCompare(b.team));
  const league=peers.reduce((sum,p)=>sum+p.avg*p.games,0)/Math.max(1,peers.reduce((s,p)=>s+p.games,0));
  peers.forEach((p,i)=>{p.rank=i+1;p.leagueAvg=+league.toFixed(1);});
 }
 return result;
}
export function effectiveWeek(games:NflGame[],now:number=Date.now()):number{
 const upcoming=games.filter(g=>g.status==='scheduled'&&g.kickoff&&Date.parse(g.kickoff)>now-6*60*60*1000);
 if(upcoming.length)return upcoming[0].week;
 return Math.max(1,...games.filter(g=>g.status==='final').map(g=>g.week));
}
export type DepthEntry={team:string;id:string|null;name:string;position:string;rank:number;updated:string};
export function newestDepth(rows:Record<string,string>[],team:string):{updated:string;players:DepthEntry[]}{
 const available=rows.filter(r=>r.team===team&&typeof r.dt==='string'&&r.dt.length>=10&&
  Number.isFinite(Number(r.pos_rank))&&Number(r.pos_rank)>0&&Number(r.pos_rank)<12&&
  String(r.player_name||'').trim().length>0);
 const stamp=available.reduce((m,r)=>r.dt>m?r.dt:m,'');
 const latest=available.filter(r=>r.dt===stamp);
 return {updated:stamp,players:latest.slice(0,120).map(r=>({
  team,id:r.gsis_id||null,name:r.player_name,position:r.pos_abb||r.pos_grp||r.pos_name||'Unknown',
  rank:Number(r.pos_rank),updated:r.dt
 })).sort((a,b)=>a.position.localeCompare(b.position)||a.rank-b.rank)};
}
