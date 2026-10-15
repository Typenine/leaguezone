import type {FantasyRostersData} from '@/lib/providers/types';
import type {MarketIndex} from '@/lib/fantasy/decision-quality';
import type {Need} from '@/lib/fantasy/personalized-decisions';

const POS=['QB','RB','WR','TE'] as const;
type Rosters=Pick<FantasyRostersData,'teams'|'players'>;
export type ImpactPlayer={id:string;name:string;position:string;value:number};
export type PositionImpact={
 position:string;fixedSlots:number;before:number;after:number;
 playersBefore:number;playersAfter:number;
 countedBefore:ImpactPlayer[];countedAfter:ImpactPlayer[];
};
export type TeamImpact={
 teamId:number;name:string;marketDelta:number;coverage:number;
 rosterBefore:number;rosterAfter:number;
 sent:ImpactPlayer[];received:ImpactPlayer[];
 positional:PositionImpact[];
};
export type TradeImpact={valid:boolean;reason:string|null;teams:TeamImpact[];valueDifference:number|null};
function player(id:string,r:Rosters,market:MarketIndex):ImpactPlayer{
 return {id,name:r.players[id]?.fullName||market[id]?.name||id,
  position:(r.players[id]?.position||market[id]?.position||'').toUpperCase(),
  value:market[id]?.value||0};
}
function profile(ids:string[],r:Rosters,market:MarketIndex,slots:string[]){
 const players=ids.map(id=>player(id,r,market));
 const positional=POS.map(position=>{
  const list=players.filter(x=>x.position===position).sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id));
  // Only actual fixed starter slots count as top-slot market exposure. Flex and
  // Superflex are not optimized by this market-only comparison.
  const fixedSlots=slots.filter(s=>s.toUpperCase()===position).length;
  const counted=list.filter(x=>x.value>0).slice(0,fixedSlots);
  return {position,count:list.length,fixedSlots,counted,
   value:counted.reduce((sum,x)=>sum+x.value,0)};
 });
 return {total:players.reduce((sum,x)=>sum+x.value,0),
  coverage:ids.length?players.filter(x=>x.value>0).length/ids.length:0,positional};
}
export function tradeTeamImpact(args:{rosters:Rosters;market:MarketIndex;starterSlots:string[];
 teamA:number;teamB:number;sendsA:string[];sendsB:string[]}):TradeImpact{
 const {rosters,market,starterSlots}=args;
 const a=rosters.teams.find(t=>t.rosterId===args.teamA),b=rosters.teams.find(t=>t.rosterId===args.teamB);
 const fail=(reason:string):TradeImpact=>({valid:false,reason,teams:[],valueDifference:null});
 if(!a||!b||a.rosterId===b.rosterId)return fail('Choose two distinct current league teams.');
 if(!args.sendsA.length||!args.sendsB.length)return fail('Select at least one player from each team.');
 const ids=[...args.sendsA,...args.sendsB];
 if(new Set(ids).size!==ids.length)return fail('The same player cannot be traded twice.');
 if(args.sendsA.some(id=>!a.players.includes(id))||args.sendsB.some(id=>!b.players.includes(id)))
  return fail('Ownership has changed. Refresh the league roster before analyzing this trade.');
 if(ids.some(id=>!market[id]||!Number.isFinite(market[id].value)||market[id].value<=0))
  return fail('All exchanged players need verified market values; unpriced trades cannot be evaluated.');
 const afterA=[...a.players.filter(id=>!args.sendsA.includes(id)),...args.sendsB];
 const afterB=[...b.players.filter(id=>!args.sendsB.includes(id)),...args.sendsA];
 const impact=(team:typeof a,after:string[],sentIds:string[],receivedIds:string[]):TeamImpact=>{
  const before=profile(team.players,rosters,market,starterSlots);
  const next=profile(after,rosters,market,starterSlots);
  return {teamId:team.rosterId,name:team.teamName,marketDelta:next.total-before.total,
   coverage:Math.min(before.coverage,next.coverage),
   rosterBefore:team.players.length,rosterAfter:after.length,
   sent:sentIds.map(id=>player(id,rosters,market)),
   received:receivedIds.map(id=>player(id,rosters,market)),
   positional:before.positional.map((p,i)=>({
    position:p.position,fixedSlots:p.fixedSlots,
    before:p.value,after:next.positional[i].value,
    playersBefore:p.count,playersAfter:next.positional[i].count,
    countedBefore:p.counted,countedAfter:next.positional[i].counted
   }))};
 };
 const aValue=args.sendsA.reduce((s,id)=>s+market[id].value,0);
 const bValue=args.sendsB.reduce((s,id)=>s+market[id].value,0);
 return {valid:true,reason:null,
  teams:[impact(a,afterA,args.sendsA,args.sendsB),impact(b,afterB,args.sendsB,args.sendsA)],
  valueDifference:bValue-aValue};
}
export type Prospect={id:string;name:string;pos:'QB'|'RB'|'WR'|'TE';tier:number;
 college:string;draftRange:string;strengths:string[];concerns:string[];trend:string;
 target?:boolean;noFit?:boolean;unlikely?:boolean};
export type DraftFit={prospect:Prospect;boardRank:number;fitScore:number;reason:string};
export function rankProspects(args:{prospects:Prospect[];needs:Need[];superflex:boolean}):DraftFit[]{
 const needs=new Map<string,Need>(args.needs.map(n=>[n.pos,n]));
 return args.prospects.flatMap((prospect,i)=>{
  if(prospect.noFit)return [];
  const need=needs.get(prospect.pos);
  const shortage=need?.shortage?10:need?.belowMedian?5:0;
  const sf=args.superflex&&prospect.pos==='QB'?3:0;
  const target=prospect.target?5:0;
  const unlikely=prospect.unlikely?-8:0;
  const reason=[shortage===10?'Starter shortage':shortage===5?'Depth below league median':'',
   sf?'Superflex quarterback premium':'',target?'Your target flag':'',
   unlikely?'Marked hard to acquire':''].filter(Boolean).join(' · ')||'Original prospect-board order';
  return [{prospect,boardRank:i+1,fitScore:100*(args.prospects.length-i)/Math.max(1,args.prospects.length)+shortage+sf+target+unlikely,reason}];
 }).sort((a,b)=>b.fitScore-a.fitScore||a.boardRank-b.boardRank);
}
export type ReceiptInput={start:string[];bench:string[];predictedGain:number};
export function evaluateReceipt(input:ReceiptInput,points:Record<string,number>|null,complete:boolean){
 if(!complete)return {status:'pending' as const,actualGain:null,successful:null};
 if(!points||![...input.start,...input.bench].length||
  [...input.start,...input.bench].some(id=>!Number.isFinite(points[id])))
  return {status:'pending' as const,actualGain:null,successful:null};
 const actualGain=Number((input.start.reduce((s,id)=>s+points[id],0)-
  input.bench.reduce((s,id)=>s+points[id],0)).toFixed(2));
 return {status:'evaluated' as const,actualGain,successful:actualGain>0};
}
