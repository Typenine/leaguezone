'use client';

import {useMemo,useState} from 'react';
import type {WeeklyProjectedPlayer} from '@/lib/fantasy/lineup-types';

export default function LineupComparison({players,starterSlots}:{
 players:WeeklyProjectedPlayer[];starterSlots:string[];
}){
 const sorted=useMemo(()=>players.filter(p=>Number.isFinite(p.projection))
  .slice().sort((a,b)=>b.projection-a.projection||a.name.localeCompare(b.name)),[players]);
 const [first,setFirst]=useState('');
 const [second,setSecond]=useState('');
 const a=sorted.find(p=>p.id===(first||sorted[0]?.id));
 const b=sorted.find(p=>p.id===(second||sorted.find(p=>p.id!==a?.id)?.id));
 if(sorted.length<2)return <p className="mt-4 text-xs text-[var(--muted)]">Two mapped roster players are required for a comparison.</p>;
 const legal=(pos:string,slot:string)=>{
  const s=slot.toUpperCase(),p=pos.toUpperCase();
  return s===p||(s==='FLEX'&&['RB','WR','TE'].includes(p))||
   (s==='SUPER_FLEX'&&['QB','RB','WR','TE'].includes(p))||
   (s==='REC_FLEX'&&['WR','TE'].includes(p));
 };
 const shared=Boolean(a&&b&&starterSlots.some(slot=>legal(a.position,slot)&&legal(b.position,slot)));
 const gain=a&&b?a.projection-b.projection:0;
 const name=a&&b?(gain>0?a:b):null;
 const row=(p:WeeklyProjectedPlayer)=>(
  <div key={p.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-3">
   <p className="font-bold">{p.name} · {p.position}</p>
   <p className="mt-2 text-xl font-black">{p.projection.toFixed(1)} <span className="text-xs font-normal text-[var(--muted)]">projected points</span></p>
   <p className="mt-1 text-sm text-[var(--muted)]">Model range {p.rangeLow.toFixed(1)}–{p.rangeHigh.toFixed(1)} · {p.confidence} confidence</p>
   <p className="mt-1 text-xs text-[var(--muted)]">{p.opponent?'vs. '+p.opponent:'Opponent unavailable'} · {p.isBye?'Bye week':p.expectedRole||'Role unverified'}</p>
   {p.roleTrend&&<p className="mt-1 text-xs text-[var(--muted)]">Observed role: {p.roleTrend}</p>}
   {p.assumption&&<p className="mt-1 text-xs text-[var(--muted)]">{p.assumption}</p>}
  </div>
 );
 return <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" aria-label="Start sit comparison">
  <h4 className="font-black">Compare any two roster players</h4>
  <p className="mt-1 text-xs text-[var(--muted)]">Use the existing weekly projection model. A small projected difference can be outweighed by uncertainty; this is not an injury clearance or a guaranteed lineup gain.</p>
  <div className="mt-3 grid gap-3 sm:grid-cols-2">
   {[
    {label:'Player A',value:first||sorted[0]?.id||'',change:setFirst},
    {label:'Player B',value:second||sorted.find(p=>p.id!==a?.id)?.id||'',change:setSecond},
   ].map(input=><label key={input.label} className="text-xs font-semibold">{input.label}
    <select className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-strong)] p-2 text-[var(--text)]" value={input.value} onChange={e=>input.change(e.target.value)}>
      {sorted.map(p=><option key={p.id} value={p.id}>{p.name} ({p.position})</option>)}
    </select></label>)}
  </div>
  {a&&b&&<>
   {a.id===b.id?<p className="mt-3 text-sm text-[var(--muted)]">Select two different players.</p>:<>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">{row(a)}{row(b)}</div>
    <p className="mt-3 text-sm"><strong>Projected difference:</strong> {Math.abs(gain).toFixed(1)} points{gain===0?' (tie)':'. '+name?.name+' has the higher model estimate.'}</p>
    {!shared&&<p className="mt-2 text-xs text-amber-300">These positions do not share an eligible starting slot in the recorded lineup settings. They may not be directly interchangeable.</p>}
    {(a.isBye||b.isBye)&&<p className="mt-2 text-xs text-amber-300">One selection has a bye week. Confirm the matchup week before making a change.</p>}
    <p className="mt-2 text-xs text-[var(--muted)]">The projected point ranges may overlap even when one mean projection is higher. Check availability before lineup lock.</p>
   </>}
  </>}
 </section>;
}
