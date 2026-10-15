'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {MarketIndex} from '@/lib/fantasy/decision-quality';
import {tradeTeamImpact,type TradeImpact,type ImpactPlayer} from '@/lib/fantasy/decision-phase3';

type Props={rosters:Pick<FantasyRostersData,'teams'|'players'>;market:MarketIndex;
 starterSlots:string[];teamId:number;slug?:string;
 fixedAssets?:{sideA:string[];sideB:string[]}};
const fmt=(value:number)=>Math.round(value).toLocaleString();
const signed=(value:number)=>(value>0?'+':'')+fmt(value);
function assetNames(players:ImpactPlayer[]){
 return players.map(p=>p.name).join(', ')||'None';
}
export default function TradeImpactTool({rosters,market,starterSlots,teamId,slug,fixedAssets}:Props){
 const [other,setOther]=useState<number>(()=>rosters.teams.find(t=>t.rosterId!==teamId)?.rosterId||0);
 const [outgoing,setOutgoing]=useState<string[]>([]);
 const [incoming,setIncoming]=useState<string[]>([]);
 const team=rosters.teams.find(t=>t.rosterId===teamId);
 const opponent=rosters.teams.find(t=>t.rosterId===other);
 const assets=fixedAssets||{sideA:outgoing,sideB:incoming};
 const evaluated=useMemo<TradeImpact>(()=>{
  if(fixedAssets){
   const owner=(id:string)=>rosters.teams.find(t=>t.players.includes(id));
   const a=assets.sideA.map(owner),b=assets.sideB.map(owner);
   if(!a.length||!b.length||a.some(t=>!t)||b.some(t=>!t))
    return {valid:false,reason:'Roster impact requires players currently owned by two league teams. Unverified picks and free agents remain in the market-only comparison.',teams:[],valueDifference:null};
   if(a.some(t=>t?.rosterId!==a[0]?.rosterId)||b.some(t=>t?.rosterId!==b[0]?.rosterId))
    return {valid:false,reason:'Players on each side must belong to the same league team. Check the latest rosters.',teams:[],valueDifference:null};
   return tradeTeamImpact({rosters,market,starterSlots,teamA:a[0]!.rosterId,teamB:b[0]!.rosterId,
    sendsA:assets.sideA,sendsB:assets.sideB});
  }
  return tradeTeamImpact({rosters,market,starterSlots,teamA:teamId,teamB:other,
   sendsA:outgoing,sendsB:incoming});
 },[fixedAssets,assets.sideA,assets.sideB,rosters,market,starterSlots,teamId,other,outgoing,incoming]);
 const toggle=(id:string,side:'out'|'in')=>{
  const setter=side==='out'?setOutgoing:setIncoming;
  setter(old=>old.includes(id)?old.filter(x=>x!==id):old.length<4?[...old,id]:old);
 };
 const link=(slug?'/l/'+encodeURIComponent(slug):'')+'/trades/analyzer?a='+
  encodeURIComponent(assets.sideA.join(','))+'&b='+encodeURIComponent(assets.sideB.join(','));
 return <section aria-label="Trade impact on both teams" className="space-y-4">
  <div>
   <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">Roster-based impact</p>
   <p className="mt-1 text-sm text-[var(--muted)]">
    Calculated from the current roster snapshot for {rosters.teams.length} league teams, the players each team actually owns,
    your fixed starting slots, and dynasty market values. This is separate from the market fairness grade.
   </p>
  </div>
  {!fixedAssets&&<div className="space-y-3">
   <label className="block text-xs font-semibold">Trade partner
    <select value={other} onChange={e=>{setOther(Number(e.target.value));setIncoming([]);}}
     className="mt-1 block w-full min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-2 text-[var(--text)]">
     {rosters.teams.filter(t=>t.rosterId!==teamId).map(t=><option key={t.rosterId} value={t.rosterId}>{t.teamName}</option>)}
    </select></label>
   <div className="grid gap-3 md:grid-cols-2">{([{title:'You send',roster:team,selected:outgoing,side:'out'},
    {title:'You receive',roster:opponent,selected:incoming,side:'in'}] as const).map(col=><div key={col.side}
    className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-3">
    <h4 className="text-sm font-bold">{col.title} · {col.roster?.teamName||'Team'}</h4>
    <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">{(col.roster?.players||[]).filter(id=>rosters.players[id]).map(id=><label key={id}
     className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-black/5">
      <input type="checkbox" checked={col.selected.includes(id)} onChange={()=>toggle(id,col.side)}
       disabled={!col.selected.includes(id)&&col.selected.length>=4}/>
      <span className="min-w-0 flex-1 truncate">{rosters.players[id]?.fullName||id}</span>
      <span className="shrink-0 text-xs text-[var(--muted)]">{market[id]?.value?fmt(market[id].value):'Unpriced'}</span>
     </label>)}</div>
    <p className="mt-2 text-xs text-[var(--muted)]">Select up to 4 rostered players</p>
   </div>)}</div>
  </div>}
  {!evaluated.valid&&<p role="status" className="rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--muted)]">
   {evaluated.reason}
  </p>}
  {evaluated.valid&&<div className="grid gap-4 lg:grid-cols-2">{evaluated.teams.map(row=>{
   const changed=row.positional.filter(p=>
    p.playersBefore!==p.playersAfter||p.before!==p.after||
    row.sent.some(x=>x.position===p.position)||row.received.some(x=>x.position===p.position));
   return <article key={row.teamId} className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
    <h4 className="font-bold text-base">{row.name}</h4>
    <p className="mt-1 text-xs text-[var(--muted)]">
     Verified roster: {row.rosterBefore} players before, {row.rosterAfter} after the proposed exchange.
     {Math.round(row.coverage*100)}% market-price coverage.
    </p>
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
     <div className="rounded-lg border border-[var(--border)] p-2">
      <p className="text-xs font-semibold text-[var(--muted)]">Leaving this roster</p>
      <p className="mt-1">{assetNames(row.sent)}</p>
     </div>
     <div className="rounded-lg border border-[var(--border)] p-2">
      <p className="text-xs font-semibold text-[var(--muted)]">Joining this roster</p>
      <p className="mt-1">{assetNames(row.received)}</p>
     </div>
    </div>
    <p className="mt-3 text-sm">Change in total roster market value: <strong>{signed(row.marketDelta)}</strong></p>
    <h5 className="mt-4 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Positional strength, before and after</h5>
    <div className="mt-2 space-y-3">{changed.length?changed.map(p=><div key={p.position}
     className="rounded-lg border border-[var(--border)] p-3 text-sm">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-semibold">{p.position} · {p.playersBefore} rostered before, {p.playersAfter} after</p>
      {p.fixedSlots>0&&<p className="text-xs text-[var(--muted)]">{p.fixedSlots} fixed starting {p.fixedSlots===1?'slot':'slots'}</p>}
     </div>
     {p.fixedSlots>0?<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div>
       <p className="text-xs font-semibold text-[var(--muted)]">Before: {fmt(p.before)} in top-slot market value</p>
       <p className="mt-1">{assetNames(p.countedBefore)}</p>
      </div>
      <div>
       <p className="text-xs font-semibold text-[var(--muted)]">After: {fmt(p.after)} in top-slot market value</p>
       <p className="mt-1">{assetNames(p.countedAfter)}</p>
      </div>
     </div>:<p className="mt-2 text-xs text-[var(--muted)]">No fixed {p.position} slot. Roster depth changes are shown, but no top-slot value is assumed.</p>}
     {p.fixedSlots>0&&<p className="mt-2 text-xs font-semibold">Top-slot market value change: {signed(p.after-p.before)}</p>}
    </div>):<p className="text-sm text-[var(--muted)]">No QB, RB, WR or TE positional changes detected.</p>}</div>
   </article>;
  })}</div>}
  {evaluated.valid&&!fixedAssets&&<Link href={link}
   className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--accent)] underline">
   Open these players in the Trade Analyzer
  </Link>}
  {evaluated.valid&&<p className="text-xs text-[var(--muted)]">
   How it is calculated: remove the outgoing players from each actual roster, add the incoming players, then re-rank
   each position by dynasty value. The named players above are those counted toward fixed starting slots, not necessarily
   the manager's actual lineup. Flex/Superflex slots, weekly projections, draft picks and team strategy are not modeled
   in the positional comparison. No accept or reject recommendation is made.
  </p>}
 </section>;
}
