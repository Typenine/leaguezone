import {notFound} from 'next/navigation';
import PublicFantasyWorkbench from '@/components/fantasy/PublicFantasyWorkbench';
import {FANTASY_TOOLS,isPublicToolKey} from '@/lib/fantasy/public-tools';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{tool:string}>}){
 const {tool}=await params;
 const item=FANTASY_TOOLS.find(t=>t.key===tool);
 return {title:item?item.label+' | Free LeagueZone Fantasy Tools':'Fantasy Tools | LeagueZone'};
}
export default async function Page({params,searchParams}:{params:Promise<{tool:string}>;
 searchParams:Promise<{leagueId?:string;rosterId?:string}>}){
 const [{tool},query]=await Promise.all([params,searchParams]);
 if(!isPublicToolKey(tool))notFound();
 return <PublicFantasyWorkbench key={tool} tool={tool}
  initialLeagueId={query.leagueId||''} initialRosterId={Number(query.rosterId)||null}/>;
}
