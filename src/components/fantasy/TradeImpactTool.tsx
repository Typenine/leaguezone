'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {MarketIndex} from '@/lib/fantasy/decision-quality';
import {tradeTeamImpact} from '@/lib/fantasy/decision-phase3';
type Props={rosters:Pick<FantasyRostersData,'teams'|'players'>;market:MarketIndex;
 starterSlots:string[];teamId:number;slug?:string;
 fixedAssets?:{sideA:string[];sideB:string[]}};
export default function TradeImpactTool({rosters,market,starterSlots,teamId,slug,fixedAssets}:Props){
 const [other,setOther]=useState<number>(()=>rosters.teams.find(t=>t.rosterId!==teamId)?.rosterId||0);
 const [outgoing,setOutgoing]=useState<string[]>([]);
 const [incoming,setIncoming]=useState<string[]>([]);
 const team=rosters.teams.find(t=>t.rosterId===teamId);
 const opponent=rosters.teams.find(t=>t.rosterId===other);
 const assets=fixedAssets||{sideA:outgoing,sideB:incoming};
 const evaluated=useMemo(()=>{
  if(fixedAssets){
   const owner=(id:string)=>rosters.teams.find(t=>t.players.includes(id));
   const a=assets.sideA.map(owner),b=assets.sideB.map(owner);
   if(!a.length||!b.length||a.some(t=>!t)||b.some(t=>!t))
    return {valid:false,reason:'Only verified rostered players can receive team-impact analysis. Pick ownership is not validated here.',teams:[],valueDifference:null};
   if(a.some(t=>t?.rosterId!==a[0]?.rosterId)||b.some(t=>t?.rosterId!==b[0]?.rosterId))
    return {valid:false,reason:'Trade sides include assets owned by multiple teams. Choose a valid two-team proposal.',teams:[],valueDifference:null};
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
 const summary=evaluated.valid?evaluated.teams:[];
 const link=(slug?'/l/'+encodeURIComponent(slug):'')+'/trades/analyzer?a='+
  encodeURIComponent(assets.sideA.join(','))+'&b='+encodeURIComponent(assets.sideB.join(','));
 return <section aria-label="Trade impact on both teams" className="space-y-3">
  <p className="text-sm text-[var(--muted)]">Compare actual rosters before and after a proposed player trade. Measures dynasty market value and position-level starter value, not future wins or guaranteed weekly points.</p>
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
      <span className="shrink-0 text-xs text-[var(--muted)]">{market[id]?.value?Math.round(market[id].value).toLocaleString():'Unpriced'}</span>
     </label>)}</div>
    <p className="mt-2 text-xs text-[var(--muted)]">Select up to 4 players</p>
   </div>)}</div>
  </div>}
  {!evaluated.valid&&<p className="rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--muted)]">{evaluated.reason}</p>}
  {evaluated.valid&&<div className="grid gap-3 md:grid-cols-2">{summary.map(row=><article key={row.teamId}
   className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
   <h4 className="font-bold">{row.name}</h4>
   <p className="mt-1 text-sm">Dynasty value change: <strong>{row.marketDelta>=0?'+':''}{row.marketDelta.toLocaleString()}</strong></p>
   <p className="mt-1 text-xs text-[var(--muted)]">{Math.round(row.coverage*100)}% player-value coverage across before/after rosters</p>
   <div className="mt-3 grid grid-cols-2 gap-2 text-xs">{row.positional.filter(x=>x.before!==x.after||x.playersBefore!==x.playersAfter).map(p=><div key={p.position}
    className="rounded-lg border border-[var(--border)] p-2">
    <strong>{p.position}</strong> · {p.playersBefore} → {p.playersAfter} players
    <p className="mt-1 text-[var(--muted)]">Top-slot asset values: {Math.round(p.before).toLocaleString()} → {Math.round(p.after).toLocaleString()}</p>
   </div>)}</div>
  </article>)}</div>}
  {evaluated.valid&&!fixedAssets&&<Link href={link} className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--accent)] underline">Open these assets in the Trade Analyzer →</Link>}
  {evaluated.valid&&<p className="text-xs text-[var(--muted)]">A positive number shows market assets gained, not a trade grade. Position totals use valued top players for fixed slots; flex roles, bench fit, picks, contract rules and starting-lineup projections are not modeled. Both teams may have different needs.</p>}
 </section>;
}
