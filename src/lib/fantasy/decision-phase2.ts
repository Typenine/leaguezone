import type {Need} from '@/lib/fantasy/personalized-decisions';
import type {MarketIndex,Quality} from '@/lib/fantasy/decision-quality';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {WeeklyProjectedPlayer,LineupOptimizerResponse} from '@/lib/fantasy/lineup-types';
import type {TaxiContext} from '@/lib/fantasy/taxi-context';
import type {NflGame} from '@/lib/weekly-center';

export type TeamAction={key:string;headline:string;why:string;priority:'high'|'normal';position?:string};
export function rosterImprovementPlan(args:{
 needs:Need[];quality:Quality[];lineup:LineupOptimizerResponse|null;
}):TeamAction[]{
 const result:TeamAction[]=[];
 for(const need of args.needs){
  if(need.shortage>0)result.push({key:'shortage-'+need.pos,headline:'Address '+need.pos+' starter coverage',
   why:'Roster has '+need.mine+' '+need.pos+'s for '+need.required+' fixed starting slots. Check health and flex eligibility.',
   priority:'high',position:need.pos});
  else if(need.belowMedian>0)result.push({key:'depth-'+need.pos,headline:'Explore '+need.pos+' depth',
   why:'Your '+need.mine+' '+need.pos+'s are below the league median of '+need.median+'. This measures quantity, not quality.',
   priority:'normal',position:need.pos});
 }
 for(const q of args.quality){
  if(q.assessment==='needs attention'&&q.ratio!=null)
   result.push({key:'market-'+q.pos,headline:'Review '+q.pos+' asset strength',
    why:'Priced starter assets are '+Math.round((1-q.ratio)*100)+'% below the league median. This is dynasty market value, not weekly scoring.',
    priority:'normal',position:q.pos});
 }
 if(args.lineup?.available&&args.lineup.potentialGain!=null&&args.lineup.potentialGain>=2)
  result.unshift({key:'lineup',headline:'Review a projected starting-lineup upgrade',
   why:'The current weekly model estimates '+args.lineup.potentialGain.toFixed(1)+' additional lineup points. Confirm player availability and lock times.',
   priority:'high'});
 const seen=new Set<string>();
 return result.filter(item=>{const key=item.position||item.key;if(seen.has(key))return false;seen.add(key);return true;})
  .sort((a,b)=>(a.priority==='high'?0:1)-(b.priority==='high'?0:1)).slice(0,4);
}
export type TaxiAdvice={player:TaxiContext['players'][number];action:'consider promotion'|'hold and monitor'|'review status';
 reason:string;weeklyProjection:number|null;marketValue:number|null};
export function adviseTaxi(context:TaxiContext|null,projection:LineupOptimizerResponse|null,market:MarketIndex):TaxiAdvice[]{
 if(!context?.players.length)return [];
 const projected=new Map((projection?.taxiProjectedPlayers||[]).map(p=>[p.id,p]));
 const active=projection?.projectedPlayers||[];
 return context.players.map(player=>{
  const p=projected.get(player.id),weekly=p&&!p.isBye?p.projection:null;
  const current=active.filter(a=>a.position===player.position&&!a.isBye)
   .map(a=>a.projection).sort((a,b)=>b-a);
  const replacement=current[Math.min(1,current.length-1)];
  const promising=weekly!=null&&weekly>=8&&replacement!==undefined&&weekly>replacement+2&&
   p?.confidence!=='low'&&p?.dataQuality!=='degraded';
  const lowSample=weekly==null||p?.confidence==='low'||p?.dataQuality==='degraded';
  const action:TaxiAdvice['action']=promising?'consider promotion':lowSample?'review status':'hold and monitor';
  const reason=promising?'Weekly projection is more than two points above a current active '+player.position+' alternative. Review the active spot and your league rules before a move.':
   lowSample?'Not enough reliable current-week projection information to justify a taxi move. Review development and eligibility.':
   'No clear immediate starting-lineup advantage has been established. Preserve development flexibility unless roster needs change.';
  return {player,action,reason,weeklyProjection:weekly,
   marketValue:market[player.id]?.value||null};
 }).sort((a,b)=>(a.action==='consider promotion'?0:a.action==='review status'?2:1)-
  (b.action==='consider promotion'?0:b.action==='review status'?2:1));
}
export type RankedPlayer={id:string;name:string;position:string;value:number|null;weeklyPoints:number|null;
 fitBoost:number;owned:boolean;rankScore:number;source:'weekly'|'dynasty'};
export function personalRankings(args:{
 rosters:Pick<FantasyRostersData,'teams'|'players'>;teamId:number;
 market:MarketIndex;weekly:WeeklyProjectedPlayer[];waiverIds:string[];needs:Need[];
 mode:'weekly'|'dynasty';position:string;
}):RankedPlayer[]{
 const roster=args.rosters.teams.find(t=>t.rosterId===args.teamId);
 if(!roster)return [];
 const owned=new Set(roster.players);
 const pool=new Set([...roster.players,...args.waiverIds]);
 const models=new Map(args.weekly.map(p=>[p.id,p]));
 const needy=new Map(args.needs.map(n=>[n.pos,n]));
 const rows:RankedPlayer[]=[];
 for(const id of pool){
  const p=args.rosters.players[id],v=args.market[id],projection=models.get(id);
  const pos=p?.position||v?.position||projection?.position||'';
  if(!['QB','RB','WR','TE'].includes(pos)||(args.position!=='ALL'&&pos!==args.position))continue;
  const value=v&&Number.isFinite(v.value)&&v.value>0?v.value:null;
  const weeklyPoints=projection&&!projection.isBye?projection.projection:null;
  if(args.mode==='weekly'&&(weeklyPoints===null||!owned.has(id)))continue;
  if(args.mode==='dynasty'&&value===null)continue;
  const need=needy.get(pos);
  const fitBoost=need?.shortage?0.12:need?.belowMedian?0.06:0;
  const rankScore=args.mode==='weekly'?weeklyPoints!:(value!*(1+fitBoost));
  rows.push({id,name:p?.fullName||v?.name||projection?.name||id,position:pos,
   value,weeklyPoints,fitBoost:args.mode==='dynasty'?fitBoost:0,owned:owned.has(id),
   rankScore,source:args.mode});
 }
 return rows.sort((a,b)=>b.rankScore-a.rankScore||a.name.localeCompare(b.name));
}
export type PaceRow={id:string;name:string;position:string;games:number;byeWeeks:number[];
 weeklyProjection:number;pacePoints:number;confidence:string};
export function restOfSeasonPace(args:{
 players:WeeklyProjectedPlayer[];schedule:NflGame[];week:number;season:number;now:number;
}):PaceRow[]{
 const weeks=Array.from(new Set(args.schedule.filter(g=>g.season===args.season&&g.week>=args.week&&
  g.status==='scheduled'&&g.kickoff!==null&&Date.parse(g.kickoff)>args.now)
  .map(g=>g.week))).sort((a,b)=>a-b);
 return args.players.flatMap(p=>{
  if(!p.nflTeam||!Number.isFinite(p.projection)||p.projection<0)return [];
  const games=args.schedule.filter(g=>g.season===args.season&&g.week>=args.week&&g.status==='scheduled'&&
   g.kickoff!==null&&Date.parse(g.kickoff)>args.now&&(g.home===p.nflTeam||g.away===p.nflTeam));
  const gamesWeeks=new Set(games.map(g=>g.week));
  if(!weeks.length)return [];
  return [{id:p.id,name:p.name,position:p.position,games:games.length,
   byeWeeks:weeks.filter(w=>!gamesWeeks.has(w)),weeklyProjection:p.projection,
   pacePoints:Number((p.projection*games.length).toFixed(1)),confidence:p.confidence}];
 }).sort((a,b)=>b.pacePoints-a.pacePoints||a.name.localeCompare(b.name));
}
