'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {Need} from '@/lib/fantasy/personalized-decisions';
import type {LineupOptimizerResponse} from '@/lib/fantasy/lineup-types';
import {marketById,type MarketIndex} from '@/lib/fantasy/decision-quality';
import {adviseLineup,adviseWaivers,type WaiverLead} from '@/lib/fantasy/decision-foundation';
import LineupComparison from '@/components/fantasy/LineupComparison';
import TeamManagementAdvisor from '@/components/fantasy/TeamManagementAdvisor';
import AdvancedDecisionTools, {type DecisionScope} from '@/components/fantasy/AdvancedDecisionTools';
import type {TaxiContext} from '@/lib/fantasy/taxi-context';

type Props={endpoint:string;rosters:Pick<FantasyRostersData,'teams'|'players'>;teamId:number;
 starterSlots:string[];needs:Need[];waiver:WaiverLead[];season:number;throughWeek:number;
 source:'live'|'backup';taxiContext?:TaxiContext|null;scope?:DecisionScope;onSelect?:(which:'waiver'|'lineup')=>void};
async function load(url:string){
 const res=await fetch(url,{credentials:'same-origin',cache:'no-store'});
 const body=await res.json().catch(()=>({})) as {error?:string;values?:MarketIndex};
 if(!res.ok)throw Error(body.error||'Temporarily unavailable.');
 return body;
}
export default function DecisionFoundationPanel({endpoint,rosters,teamId,starterSlots,needs,waiver,
 season,throughWeek,source,taxiContext,scope,onSelect}:Props){
 const [lineup,setLineup]=useState<LineupOptimizerResponse|null>(null);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const [market,setMarket]=useState<MarketIndex>({});
 useEffect(()=>{
  let active=true;
  setStatus('loading');setLineup(null);setError('');
  void load(endpoint).then(v=>{if(active){setLineup(v as unknown as LineupOptimizerResponse);setStatus('ready');}})
   .catch(e=>{if(active){setStatus('error');setError(e instanceof Error?e.message:'Unavailable');}});
  return ()=>{active=false;};
 },[endpoint,retry]);
 useEffect(()=>{
  let active=true;
  void load('/api/trade-analyzer/values').then(v=>{
   if(active&&v.values)setMarket(marketById(v.values));
  }).catch(()=>{});
  return ()=>{active=false;};
 },[]);
 const advice=useMemo(()=>adviseLineup(lineup),[lineup]);
 const waiverRows=useMemo(()=>adviseWaivers({leads:waiver,needs,rosters,teamId,market}).slice(0,3),
  [waiver,needs,rosters,teamId,market]);
 return <section aria-label="My decisions this week"
  className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] sm:p-6">
  <div className="flex flex-wrap justify-between gap-3">
   <div><p className="text-xs font-black uppercase tracking-wide text-[var(--accent)]">Your decision dashboard</p>
    <h2 className="mt-1 text-xl font-black sm:text-2xl">My decisions this week</h2>
    <p className="mt-1 text-sm text-[var(--muted)]">Prioritized lineup and roster questions, using your connected league.</p></div>
   <p className="text-xs text-[var(--muted)]">{season} stats through Week {throughWeek}{source==='backup'?' · Backup':''}</p>
  </div>
  <div className="mt-4 grid gap-4 lg:grid-cols-2">
   <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
    <h3 className="font-black">Start / Bench</h3>
    {status==='loading'&&<p role="status" className="mt-3 text-sm text-[var(--muted)]">Checking the current lineup and projections…</p>}
    {status==='error'&&<div className="mt-3 text-sm text-[var(--muted)]">{error} <button type="button" className="font-bold text-[var(--accent)] underline" onClick={()=>setRetry(i=>i+1)}>Retry</button></div>}
    {status==='ready'&&lineup&&!lineup.available&&<p className="mt-3 text-sm text-[var(--muted)]">{lineup.reason||'No current starting lineup found.'} You can still compare players below.</p>}
    {status==='ready'&&lineup?.available&&!advice&&<p className="mt-3 text-sm text-[var(--muted)]">No meaningful projected upgrade to your current starting lineup.</p>}
    {advice&&<div className="mt-3 space-y-2 text-sm">
     <p className="font-semibold">{advice.close?'Close call to review':'Lineup improvement to review'}</p>
     <p><strong>Start:</strong> {advice.start.map(p=>p.name).join(', ')}</p>
     <p><strong>Bench:</strong> {advice.bench.map(p=>p.name).join(', ')}</p>
     <p className="font-bold">Whole-lineup estimate: +{advice.gain.toFixed(1)} points</p>
     <p className="text-xs text-[var(--muted)]">{advice.close?'The projected difference is small or uncertain. Check injuries, role and upside before acting.':'The model prefers this legal lineup based on weekly projections. Confirm availability before lock.'}</p>
    </div>}
    {lineup&&<p className="mt-3 text-xs text-[var(--muted)]">Week {lineup.week} · {lineup.confidence} confidence · {lineup.modelVersion}</p>}
    {lineup&&lineup.projectedPlayers.length>1&&<details className="mt-3 border-t border-[var(--border)] pt-3">
     <summary className="cursor-pointer text-sm font-bold text-[var(--accent)]">Compare any two roster players</summary>
     <LineupComparison players={lineup.projectedPlayers} starterSlots={starterSlots}/>
    </details>}
    {onSelect&&<button type="button" onClick={()=>onSelect('lineup')}
     className="mt-3 text-sm font-bold text-[var(--accent)] underline">See lineup details →</button>}
   </article>
   <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
    <h3 className="font-black">Pickup opportunities</h3>
    <p className="mt-1 text-xs text-[var(--muted)]">Unrostered in the latest Sleeper snapshot; waiver eligibility must still be checked.</p>
    {waiverRows.length===0&&<p className="mt-3 text-sm text-[var(--muted)]">No verified unrostered players currently meet the rising-usage threshold.</p>}
    <div className="mt-3 space-y-3">
     {waiverRows.map(item=><div key={item.lead.signal.id} className="border-t border-[var(--border)] pt-3 first:border-0 first:pt-0">
      <Link className="font-bold text-[var(--accent)] underline" href={'/research/players/'+encodeURIComponent(item.lead.signal.id)+'?season='+season}>{item.lead.signal.name}</Link>
      <span className="ml-2 text-xs text-[var(--muted)]">{item.lead.signal.pos}</span>
      <p className="mt-1 text-sm">{item.level==='upgrade'?'Potential roster-value upgrade':item.level==='need'?'Addresses a depth need':'Worth monitoring'}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{item.reason}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Opportunities/game {item.lead.signal.baseline.toFixed(1)} → {item.lead.signal.recent.toFixed(1)} · FP/game {item.lead.signal.scoringBefore.toFixed(1)} → {item.lead.signal.scoringRecent.toFixed(1)}</p>
      {item.comparison&&item.marketValue!==null&&<p className="mt-1 text-xs text-[var(--muted)]">Market values: {item.marketValue.toLocaleString()} vs. your {item.comparison.name} ({item.comparison.value.toLocaleString()}). Not a drop recommendation.</p>}
     </div>)}
    </div>
    {onSelect&&<button type="button" onClick={()=>onSelect('waiver')}
     className="mt-3 text-sm font-bold text-[var(--accent)] underline">Explore waiver research →</button>}
   </article>
  </div>
  <TeamManagementAdvisor rosters={rosters} teamId={teamId} starterSlots={starterSlots}
    needs={needs} lineup={lineup} market={market} taxiContext={taxiContext||null}
    waiver={waiver} season={season} onSelectWaiver={onSelect?()=>onSelect('waiver'):undefined}/>
  {scope&&<AdvancedDecisionTools rosters={rosters} teamId={teamId} starterSlots={starterSlots}
   needs={needs} market={market} lineup={lineup} season={season} scope={scope}/>}
  <p className="mt-4 text-xs text-[var(--muted)]">Decisions are read-only. Availability, roster rules and lineup locks must be checked before acting. Market values measure dynasty assets, not weekly fantasy points.</p>
 </section>;
}
