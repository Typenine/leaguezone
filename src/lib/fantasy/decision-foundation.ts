import type {LineupOptimizerResponse,WeeklyProjectedPlayer} from '@/lib/fantasy/lineup-types';
import type {Need} from '@/lib/fantasy/personalized-decisions';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {MarketIndex} from '@/lib/fantasy/decision-quality';

export type LineupAdvice={start:WeeklyProjectedPlayer[];bench:WeeklyProjectedPlayer[];gain:number;close:boolean};
export function adviseLineup(lineup:LineupOptimizerResponse|null):LineupAdvice|null {
 if(!lineup?.available||lineup.currentTotal==null||lineup.optimalTotal==null)return null;
 const current=new Set(lineup.currentLineup.flatMap(x=>x.player?[x.player.id]:[]));
 const optimal=new Set(lineup.optimalLineup.flatMap(x=>x.player?[x.player.id]:[]));
 const start=lineup.optimalLineup.flatMap(x=>x.player&&!current.has(x.player.id)?[x.player]:[]);
 const bench=lineup.currentLineup.flatMap(x=>x.player&&!optimal.has(x.player.id)?[x.player]:[]);
 const gain=Number(Math.max(0,lineup.optimalTotal-lineup.currentTotal).toFixed(1));
 if(!start.length||!bench.length||gain<0.1)return null;
 return {start,bench,gain,close:gain<2||lineup.confidence==='low'||start.some(p=>p.confidence==='low')};
}
export type WaiverLead={providerId:string|null;signal:{
 id:string;name:string;pos:string;baseline:number;recent:number;change:number;relativeChange?:number;
 scoringBefore:number;scoringRecent:number;scoringChange:number;
}};
export type WaiverAdvice={lead:WaiverLead;level:'upgrade'|'need'|'watch';
 comparison:{name:string;value:number}|null;marketValue:number|null;reason:string};
export function adviseWaivers(args:{leads:WaiverLead[];needs:Need[];
 rosters:Pick<FantasyRostersData,'teams'|'players'>;teamId:number;market:MarketIndex;}):WaiverAdvice[]{
 const team=args.rosters.teams.find(t=>t.rosterId===args.teamId);
 if(!team)return [];
 const needMap=new Map<string,Need>(args.needs.map(n=>[n.pos,n]));
 return args.leads.flatMap(lead=>{
  if(!lead.providerId||!['QB','RB','WR','TE'].includes(lead.signal.pos))return [];
  const pos=lead.signal.pos;
  const owned=team.players.filter(id=>args.rosters.players[id]?.position?.toUpperCase()===pos)
   .map(id=>({name:args.rosters.players[id]?.fullName||id,value:args.market[id]?.value||0}))
   .filter(p=>p.value>0).sort((a,b)=>a.value-b.value);
  const comparison=owned[0]||null;
  const marketValue=args.market[lead.providerId]?.value||null;
  const upgrade=Boolean(marketValue&&comparison&&marketValue>comparison.value);
  const need=needMap.get(pos);
  const level:WaiverAdvice['level']=upgrade?'upgrade':need&&need.level!=='balanced'?'need':'watch';
  const reason=upgrade?'A market-value comparison suggests a potential roster upgrade; verify fit before replacing anyone.':
   level==='need'?'This position is thin relative to league roster depth or starter requirements.':
   'Usage is rising, but this is not yet a demonstrated improvement over your roster.';
  return [{lead,level,comparison,marketValue,reason}];
 }).sort((a,b)=>{
  const score=(x:WaiverAdvice)=>(x.level==='upgrade'?60:x.level==='need'?35:0)+
   Math.min(30,Math.max(0,x.lead.signal.change)*3)+Math.min(25,Math.max(0,x.lead.signal.relativeChange||0))/2;
  return score(b)-score(a)||a.lead.signal.name.localeCompare(b.lead.signal.name);
 });
}
