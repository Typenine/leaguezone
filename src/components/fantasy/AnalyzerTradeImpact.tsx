'use client';
import {useEffect,useMemo,useState} from 'react';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {TradeValue} from '@/lib/types/trade-analyzer';
import {marketById} from '@/lib/fantasy/decision-quality';
import TradeImpactTool from '@/components/fantasy/TradeImpactTool';

type LeagueData=FantasyRostersData&{starterSlots:string[];viewerRosterId:number|null};
export default function AnalyzerTradeImpact({slug,a,b,values}:{
 slug:string;a:string[];b:string[];values:TradeValue[]}){
 const [league,setLeague]=useState<LeagueData|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let live=true;setLeague(null);setError('');
  fetch('/api/league-opportunities/'+encodeURIComponent(slug),{credentials:'same-origin',cache:'no-store'})
   .then(async res=>{
    if(!res.ok)throw Error('Roster comparison requires league membership and current roster access.');
    return res.json() as Promise<LeagueData>;
   }).then(d=>{if(live)setLeague(d);}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Unavailable');});
  return ()=>{live=false;};
 },[slug]);
 const market=useMemo(()=>marketById(Object.fromEntries(values.map(v=>[v.sleeperId,{
  name:v.name,position:v.position,sleeperId:v.sleeperId,value:v.value,isPick:v.isPick,
 }]))),[values]);
 if(!a.length||!b.length)return null;
 return <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
  <h2 className="mb-2 text-lg font-black">Impact on both teams</h2>
  {error&&<p className="text-sm text-[var(--muted)]">{error}</p>}
  {!league&&!error&&<p className="text-sm text-[var(--muted)]">Checking live team ownership…</p>}
  {league&&<TradeImpactTool rosters={league} market={market}
   teamId={league.viewerRosterId??league.teams[0]?.rosterId??0} starterSlots={league.starterSlots||[]}
   fixedAssets={{sideA:a,sideB:b}} slug={slug}/>}
 </section>;
}
