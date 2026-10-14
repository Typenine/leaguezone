'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {Need} from '@/lib/fantasy/personalized-decisions';
import {marketById,rosterQuality,rankedActions,type MarketIndex} from '@/lib/fantasy/decision-quality';

type Catalog={id:string;gsisId:string|null;name:string;position:string;team:string};
type Snapshot=FantasyRostersData&{catalog:Catalog[];starterSlots:string[];viewerRosterId:number|null};
type Signal={id:string;name:string;pos:string;team:string;baseline:number;recent:number;
 scoringBefore:number;scoringRecent:number;direction:'rising'|'falling';change:number};
type Candidate={signal:Signal;providerId:string|null;owner:FantasyRostersData['teams'][number]|null;match:string;
 decision?:{heading:string;why:string;next:string}|null};
type Focus='overview'|'waiver'|'trade'|'risk'|'lineup';
type Props={rosters:Snapshot;season:number;slug:string;teamId:number;needs:Need[];
 personal:{waiver:Candidate[];trade:Candidate[];risk:Candidate[]};focus:Focus;onFocus:(focus:Focus)=>void};
type ValuationPayload={values?:MarketIndex;error?:string};
const fmt=(v:number)=>Math.round(v).toLocaleString('en-US');
function chooseValue(values:MarketIndex,id:string){return values[id]?.value||0;}

export default function ActionableDecisions({rosters,season,slug,teamId,needs,personal,focus,onFocus}:Props){
 const [raw,setRaw]=useState<MarketIndex>({});
 const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
 const [position,setPosition]=useState('WR');
 const [offer,setOffer]=useState('');
 const [extra,setExtra]=useState('');
 const [surplusOnly,setSurplusOnly]=useState(false);
 const [query,setQuery]=useState('');
 const [showAll,setShowAll]=useState(false);
 useEffect(()=>{
  let alive=true;
  fetch('/api/trade-analyzer/values',{credentials:'same-origin'})
   .then(async r=>{const d=await r.json() as ValuationPayload;if(!r.ok||!d.values)throw Error(d.error||'Market values unavailable');return d.values;})
   .then(values=>{if(alive){setRaw(values);setState('ready');}})
   .catch(()=>{if(alive)setState('error');});
  return ()=>{alive=false;};
 },[]);
 const market=useMemo(()=>marketById(raw),[raw]);
 const selected=rosters.teams.find(t=>t.rosterId===teamId);
 const quality=useMemo(()=>rosterQuality(rosters,market,teamId,rosters.starterSlots||[]),[rosters,market,teamId]);
 const actions=rankedActions(state==='ready'?quality:[],needs,{
  waiver:personal.waiver.length,trade:personal.trade.length,risk:personal.risk.length
 },rosters.viewerRosterId===teamId);
 const ownAssets=useMemo(()=>{
  if(!selected)return [];
  return selected.players.map(id=>({id,name:rosters.players[id]?.fullName||market[id]?.name||id,
   pos:rosters.players[id]?.position||'',value:chooseValue(market,id)}))
   .filter(item=>item.value>0).sort((a,b)=>b.value-a.value);
 },[selected,rosters,market]);
 const hypotheticalPicks=useMemo(()=>Object.entries(raw).filter(([,v])=>v.isPick&&v.value>0)
   .filter(([id,v])=>/^PICK_20\d\d_/.test(id)&&/20\d\d/.test(v.name))
   .sort((a,b)=>a[0].localeCompare(b[0])).slice(0,55)
   .map(([id,v])=>({id,name:v.name,pos:'PICK',value:v.value})),[raw]);
 const assets=[...ownAssets,...hypotheticalPicks];
 const selectedAssets=[offer,extra].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
 const offerTotal=selectedAssets.reduce((sum,id)=>sum+(assets.find(x=>x.id===id)?.value||0),0);
 const medianCount=useMemo(()=>{
  const counts=rosters.teams.map(t=>t.players.filter(id=>rosters.players[id]?.position?.toUpperCase()===position).length)
   .sort((a,b)=>a-b);
  if(!counts.length)return 0;
  const i=Math.floor(counts.length/2);
  return counts.length%2?counts[i]:(counts[i-1]+counts[i])/2;
 },[rosters,position]);
 const targets=useMemo(()=>{
  if(!offerTotal)return [];
  const q=query.trim().toLowerCase();
  return rosters.teams.filter(t=>t.rosterId!==teamId)
   .filter(t=>!surplusOnly||t.players.filter(id=>rosters.players[id]?.position?.toUpperCase()===position).length>medianCount)
   .flatMap(team=>team.players.map(id=>{
     const p=rosters.players[id],v=market[id];
     return {id,team,name:p?.fullName||v?.name||'',position:p?.position||'',value:v?.value||0};
   }))
   .filter(p=>p.position===position&&p.value>0&&p.value>=offerTotal*.65&&p.value<=offerTotal*1.4)
   .filter(p=>!q||p.name.toLowerCase().includes(q)||p.team.teamName.toLowerCase().includes(q))
   .sort((a,b)=>Math.abs(a.value-offerTotal)-Math.abs(b.value-offerTotal)||a.name.localeCompare(b.name))
   .slice(0,showAll?50:12);
 },[rosters,teamId,market,offerTotal,position,query,surplusOnly,medianCount,showAll]);
 const lineupUrl='/l/'+encodeURIComponent(slug)+'/opportunities';
 const targetUrl=(id:string)=>{
  const params=new URLSearchParams({a:selectedAssets.join(','),b:id});
  return '/l/'+encodeURIComponent(slug)+'/trades/analyzer?'+params.toString();
 };
 if(!selected)return <p className="mt-5 text-sm text-[var(--muted)]">Choose a roster to generate decisions.</p>;
 return <section className="mt-5 space-y-5" aria-label="Actionable recommendations">
  {focus==='overview'&&<>
   <div>
    <h3 className="text-lg font-black">Your next decisions</h3>
    <p className="mt-1 text-xs text-[var(--muted)]">Ranked research leads from your roster, verified ownership and measured usage. These are not automatic transactions.</p>
   </div>
   <div className="grid gap-3 md:grid-cols-2">
    {actions.map((a,i)=><button key={a.key} type="button" onClick={()=>onFocus(a.key==='quality'?'trade':a.key)}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-left hover:border-[var(--accent)]">
      <span className="text-xs font-black text-accent">#{i+1} · {a.key==='quality'?'Roster strength':a.key==='waiver'?'Waivers':a.key==='trade'?'Trades':a.key==='lineup'?'Lineup':'Roster alert'}</span>
      <strong className="mt-2 block text-base">{a.title}</strong><span className="mt-1 block text-sm text-[var(--muted)]">{a.detail}</span>
      <span className="mt-3 block text-xs font-bold text-accent">Investigate →</span></button>)}
   </div>
   {!actions.length&&<p className="text-sm text-[var(--muted)]">No strong recommendations from the available observations. Check the full finder for additional players.</p>}
  </>}
  {(focus==='overview'||focus==='trade')&&<>
   <div>
    <h3 className="text-lg font-black">Roster strength by position</h3>
    <p className="mt-1 text-xs text-[var(--muted)]">Uses market values of your highest-valued players at each position, relative to other teams in this league. This is a dynasty asset-strength comparison, not projected weekly points, and does not fully allocate flex spots.</p>
   </div>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {quality.map(q=><button type="button" key={q.pos} onClick={()=>{setPosition(q.pos);onFocus('trade');}}
      className="rounded-xl border border-[var(--border)] p-3 text-left hover:border-[var(--accent)]">
      <span className="font-black">{q.pos}</span>
      <span className="ml-2 text-xs text-[var(--muted)]">{q.count} rostered · {q.starterCount} core compared</span>
      <p className="mt-2 text-lg font-black">{state==='ready'&&q.ratio!==null?Math.round(q.ratio*100)+'% of median':'—'}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{state==='ready'?q.assessment==='unverified'?'Insufficient pricing coverage':q.assessment==='needs attention'?'Below typical team':q.assessment==='strength'?'Above typical team':'Comparable to median':'Loading market comparisons'}</p>
      {state==='ready'&&q.ratio!==null&&<p className="mt-1 text-xs text-[var(--muted)]">Core: {fmt(q.starterMarket)} · League median: {fmt(q.leagueMedian)}</p>}
    </button>)}
   </div>
  </>}
  {focus==='waiver'&&<>
   <h3 className="text-lg font-black">Waiver options for your roster</h3>
   <p className="text-sm text-[var(--muted)]">Verified unrostered Sleeper players with growing workloads, compared with your current players at their position. Verify your league&apos;s claim rules before adding anyone.</p>
   {rosters.provider!=='sleeper'?<p className="text-sm text-[var(--muted)]">Complete unrostered data is available here only for Sleeper leagues.</p>:
   <div className="grid gap-3 md:grid-cols-2">{personal.waiver.slice(0,18).map(item=>{
    const value=chooseValue(market,item.providerId||'');
    const own=ownAssets.filter(a=>a.pos===item.signal.pos);
    const weakest=own.slice().sort((a,b)=>a.value-b.value)[0];
    const comparable=weakest&&value>0;
    return <article key={item.signal.id} className="rounded-xl border border-[var(--border)] p-4">
     <div className="flex flex-wrap justify-between gap-2"><Link className="font-bold text-accent underline" href={'/research/players/'+encodeURIComponent(item.signal.id)+'?season='+season}>{item.signal.name}</Link>
      <span className="text-xs text-[var(--muted)]">{item.signal.pos} · {item.signal.team}</span></div>
     <p className="mt-2 text-sm">{item.decision?.heading||'Growing workload'}</p>
     <p className="mt-1 text-xs text-[var(--muted)]">Opportunities/game {item.signal.baseline.toFixed(1)} → {item.signal.recent.toFixed(1)} · Points/game {item.signal.scoringBefore.toFixed(1)} → {item.signal.scoringRecent.toFixed(1)}</p>
     {comparable?<p className="mt-3 text-xs text-[var(--muted)]">Market-value comparison: {fmt(value)} vs. your lowest-valued {item.signal.pos}, {weakest.name} ({fmt(weakest.value)}). {value>weakest.value?'Possible bench-upgrade research.':'Speculative upside candidate.'} Not a drop recommendation.</p>:
      <p className="mt-3 text-xs text-[var(--muted)]">No verified same-position market comparison. Evaluate roster eligibility and role before claiming.</p>}
     <Link className="mt-3 inline-block text-xs font-bold text-accent underline" href={'/research/players/'+encodeURIComponent(item.signal.id)+'?season='+season}>Review player evidence →</Link>
    </article>;
   })}</div>}
   {rosters.provider==='sleeper'&&!personal.waiver.length&&<p className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">No verified unrostered players currently meet the four-game rising-usage signal threshold.</p>}
  </>}
  {focus==='trade'&&<>
   <div><h3 className="text-lg font-black">Find a realistic trade-value range</h3>
    <p className="mt-1 text-sm text-[var(--muted)]">Match assets against actual players on other Sleeper rosters. Value similarity is a starting point, not a prediction that a manager will accept.</p></div>
   {rosters.provider!=='sleeper'?<p className="text-sm text-[var(--muted)]">League-specific trade target discovery currently requires Sleeper player IDs.</p>:
   <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 md:grid-cols-3">
    <label className="text-xs font-semibold">Target position
     <select className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]" value={position} onChange={e=>{setPosition(e.target.value);setShowAll(false);}}>
      {['QB','RB','WR','TE'].map(p=><option key={p}>{p}</option>)}</select></label>
    <label className="text-xs font-semibold">Asset to offer
     <select className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]" value={offer} onChange={e=>setOffer(e.target.value)}>
      <option value="">Select player or pick</option>
      <optgroup label="Players on my roster">{ownAssets.map(a=><option key={a.id} value={a.id}>{a.name} ({fmt(a.value)})</option>)}</optgroup>
      <optgroup label="Hypothetical draft picks — ownership not verified">{hypotheticalPicks.map(a=><option key={a.id} value={a.id}>{a.name} ({fmt(a.value)})</option>)}</optgroup>
     </select></label>
    <label className="text-xs font-semibold">Optional second asset
     <select className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]" value={extra} onChange={e=>setExtra(e.target.value)}>
      <option value="">No second asset</option>
      <optgroup label="Players on my roster">{ownAssets.filter(a=>a.id!==offer).map(a=><option key={a.id} value={a.id}>{a.name} ({fmt(a.value)})</option>)}</optgroup>
      <optgroup label="Hypothetical draft picks — ownership not verified">{hypotheticalPicks.filter(a=>a.id!==offer).map(a=><option key={a.id} value={a.id}>{a.name} ({fmt(a.value)})</option>)}</optgroup>
     </select></label>
    <label className="text-xs font-semibold">Search targets
     <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Player or team" className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]"/></label>
    <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
     <input type="checkbox" checked={surplusOnly} onChange={e=>setSurplusOnly(e.target.checked)} />
     Show only teams with more {position}s than the league median
    </label>
   </div>}
   {state==='loading'&&<p role="status" className="text-sm text-[var(--muted)]">Loading existing trade-market values…</p>}
   {state==='error'&&<p role="status" className="text-sm text-[var(--muted)]">Trade pricing is temporarily unavailable. Existing radar leads remain available in Advanced Finder.</p>}
   {state==='ready'&&rosters.provider==='sleeper'&&<div>
    <p className="mb-3 text-sm text-[var(--muted)]">{offerTotal?<>Selected offer value: <strong className="text-[var(--text)]">{fmt(offerTotal)}</strong> · Target values within approximately 65–140% of the offer. {targets.length} matches shown.</>:'Select an asset above to search other teams by trade value.'}</p>
    {selectedAssets.some(id=>hypotheticalPicks.some(p=>p.id===id))&&
     <p className="mb-3 rounded-lg border border-amber-500/40 p-3 text-xs text-[var(--text)]">Draft-pick ownership is not verified by this search. Confirm that you actually control any selected pick and review its exact value before making an offer.</p>}
    <div className="grid gap-3 md:grid-cols-2">
     {targets.map(t=><article key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-2"><strong>{t.name}</strong><span className="text-xs text-[var(--muted)]">{t.position} · {fmt(t.value)}</span></div>
      <p className="mt-1 text-xs text-[var(--muted)]">Owned by {t.team.teamName} · {Math.round(t.value/offerTotal*100)}% of proposed offer value</p>
      <Link href={targetUrl(t.id)} className="mt-3 inline-block text-sm font-bold text-accent underline">Open proposed trade in Analyzer →</Link>
     </article>)}
    </div>
    {offerTotal>0&&!targets.length&&<p className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--muted)]">No priced targets match this value range. Try a different offer or position.</p>}
    {offerTotal>0&&targets.length===12&&!showAll&&<button type="button" className="mt-3 text-sm font-bold text-accent underline" onClick={()=>setShowAll(true)}>Show more matching targets</button>}
   </div>}
   <p className="text-xs text-[var(--muted)]">The Trade Analyzer handles source-specific valuation and adjusts for multi-asset deals. These search results are not evaluated trades. You must verify draft-pick rights and manager interest.</p>
  </>}
  {focus==='overview'&&<p className="text-xs text-[var(--muted)]">Market coverage: {state==='ready'?'Available for matched Sleeper player IDs':state==='loading'?'Loading price context':'Values unavailable; showing observed usage only'}. No league settings or sources have been overridden.</p>}
  <div className="flex flex-wrap gap-4 text-xs font-bold text-accent underline">
   <Link href={lineupUrl}>Your league research</Link><Link href="/research/decisions">Public fantasy insights</Link>
  </div>
 </section>;
}
