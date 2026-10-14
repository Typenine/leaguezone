import type {FantasyRostersData} from '@/lib/providers/types';
import type {Need} from '@/lib/fantasy/personalized-decisions';

export type MarketValue={name:string;position:string;value:number;sleeperId:string;isPick?:boolean;rank?:number};
export type MarketIndex=Record<string,MarketValue>;
export type Quality={pos:string;count:number;starterCount:number;starterMarket:number;leagueMedian:number;
 coverage:number;depthMarket:number;ratio:number|null;assessment:'needs attention'|'comparable'|'strength'|'unverified'};
const POSITIONS=['QB','RB','WR','TE'] as const;
export function marketById(values:MarketIndex):MarketIndex {
 const indexed:MarketIndex={};
 for(const [key,row] of Object.entries(values)){
   if(!row||row.isPick||!Number.isFinite(row.value)||row.value<=0)continue;
   indexed[key]=row;
   if(row.sleeperId)indexed[row.sleeperId]=row;
 }
 return indexed;
}
function median(xs:number[]):number{
 if(!xs.length)return 0;const a=[...xs].sort((x,y)=>x-y),n=a.length;
 return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;
}
export function rosterQuality(
 rosters:Pick<FantasyRostersData,'teams'|'players'>,market:MarketIndex,
 selected:number,slots:string[]
):Quality[]{
 if(!rosters.teams.some(t=>t.rosterId===selected))return [];
 const result:Quality[]=[];
 for(const pos of POSITIONS){
   const starterCount=Math.max(1,slots.filter(x=>x===pos).length);
   const rows=rosters.teams.map(team=>{
     const ids=team.players.filter(id=>rosters.players[id]?.position?.toUpperCase()===pos);
     const priced=ids.map(id=>market[id]?.value).filter((v):v is number=>Number.isFinite(v)&&v>0).sort((a,b)=>b-a);
     return {id:team.rosterId,count:ids.length,coverage:ids.length?priced.length/ids.length:1,
       starterMarket:priced.slice(0,starterCount).reduce((a,b)=>a+b,0),
       depthMarket:priced.slice(starterCount,starterCount+2).reduce((a,b)=>a+b,0)};
   });
   const mine=rows.find(x=>x.id===selected)!;
   const eligible=rows.filter(x=>x.coverage>=.7);
   const mid=median(eligible.map(x=>x.starterMarket));
   const ratio=mine.coverage<.7||!mid?null:mine.starterMarket/mid;
   const assessment=ratio==null?'unverified':ratio<.8?'needs attention':ratio>1.2?'strength':'comparable';
   result.push({pos,count:mine.count,starterCount,starterMarket:mine.starterMarket,
     leagueMedian:mid,coverage:mine.coverage,depthMarket:mine.depthMarket,ratio,assessment});
 }
 return result.sort((a,b)=>(a.ratio??100)-(b.ratio??100));
}
export type Action={key:'quality'|'waiver'|'trade'|'risk'|'lineup';title:string;detail:string;count?:number};
export function rankedActions(quality:Quality[],needs:Need[],
 counts:{waiver:number;trade:number;risk:number},hasLineup:boolean):Action[]{
 const actions:Action[]=[];
 const weakest=quality.find(q=>q.assessment==='needs attention');
 const shortage=needs.find(n=>n.shortage>0);
 if(weakest)actions.push({key:'quality',title:'Review '+weakest.pos+' starting strength',
   detail:'Top '+weakest.starterCount+' '+weakest.pos+' market values are '+Math.round((1-(weakest.ratio||0))*100)+'% below the league median. Check real weekly projections before changing starters.'});
 else if(shortage)actions.push({key:'quality',title:'Review '+shortage.pos+' starter coverage',
   detail:'Fewer '+shortage.pos+'s than fixed starter slots. Review eligibility and active roster requirements.'});
 if(counts.waiver)actions.push({key:'waiver',title:'Investigate unrostered opportunities',
   detail:counts.waiver+' verified unrostered players have expanding workloads.',count:counts.waiver});
 if(counts.trade)actions.push({key:'trade',title:'Explore trade targets',
   detail:'Compare available assets with priced players on other rosters. Market value does not imply trade availability.',count:counts.trade});
 if(hasLineup)actions.push({key:'lineup',title:'Review this week’s lineup',
   detail:'Compare your current starters with the league-specific projection optimizer.'});
 if(counts.risk)actions.push({key:'risk',title:'Investigate shrinking roles',
   detail:counts.risk+' of your rostered players have declining observed usage.',count:counts.risk});
 return actions.slice(0,5);
}
