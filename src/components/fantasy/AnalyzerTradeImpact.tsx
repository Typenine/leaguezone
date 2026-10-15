'use client';
import {useEffect,useMemo,useState} from 'react';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {TradeValue} from '@/lib/types/trade-analyzer';
import {marketById} from '@/lib/fantasy/decision-quality';
import TradeImpactTool from '@/components/fantasy/TradeImpactTool';

type LeagueData=FantasyRostersData&{starterSlots:string[];viewerRosterId:number|null};
export type ConnectedTradeRosterContext={
 rosters:Pick<FantasyRostersData,'teams'|'players'>;
 starterSlots:string[];viewerRosterId:number|null;
 leagueName?:string;season?:number;
};
export default function AnalyzerTradeImpact({slug,a,b,values,connected}:{
 slug?:string;a:string[];b:string[];values:TradeValue[];
 connected?:ConnectedTradeRosterContext|null;
}){
 const [league,setLeague]=useState<LeagueData|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(connected||!slug){setLeague(null);setError('');return;}
  let live=true;setLeague(null);setError('');
  fetch('/api/league-opportunities/'+encodeURIComponent(slug),{credentials:'same-origin',cache:'no-store'})
   .then(async res=>{
    if(!res.ok)throw Error('Roster comparison requires league membership and current roster access.');
    return res.json() as Promise<LeagueData>;
   }).then(d=>{if(live)setLeague(d);}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Unavailable');});
  return ()=>{live=false;};
 },[slug,connected]);
 const market=useMemo(()=>marketById(Object.fromEntries(values.map(v=>[v.sleeperId,{
  name:v.name,position:v.position,sleeperId:v.sleeperId,value:v.value,isPick:v.isPick,
 }]))),[values]);
 const snapshot=connected||(league?{rosters:league,starterSlots:league.starterSlots||[],
  viewerRosterId:league.viewerRosterId}:null);
 if(!a.length||!b.length)return null;
 return <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
  <h2 className="mb-1 text-lg font-black">Impact on both actual rosters</h2>
  <p className="mb-4 text-sm text-[var(--muted)]">
   {connected?.leagueName?connected.leagueName+' · ':''}
   The original trade grade uses market values. The calculation below uses the connected league's
   player ownership, complete rosters and fixed starting slots to show changes for each team.
  </p>
  {error&&<p role="status" className="text-sm text-[var(--muted)]">{error}</p>}
  {!snapshot&&!error&&<p className="text-sm text-[var(--muted)]">Checking league rosters and player ownership…</p>}
  {snapshot&&<TradeImpactTool rosters={snapshot.rosters} market={market}
   teamId={snapshot.viewerRosterId??snapshot.rosters.teams[0]?.rosterId??0}
   starterSlots={snapshot.starterSlots} fixedAssets={{sideA:a,sideB:b}} slug={slug}/>}
 </section>;
}
