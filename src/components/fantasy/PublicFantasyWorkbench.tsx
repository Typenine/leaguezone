'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {TaxiContext} from '@/lib/fantasy/taxi-context';
import type {Need} from '@/lib/fantasy/personalized-decisions';
import {rosterNeeds,decisionCandidates} from '@/lib/fantasy/personalized-decisions';
import {validateResearchSnapshot,type ResearchSnapshot,type RadarSignal} from '@/lib/research-dashboard';
import DecisionFoundationPanel from '@/components/fantasy/DecisionFoundationPanel';
import {FANTASY_TOOLS,publicToolUrl,type PublicToolKey} from '@/lib/fantasy/public-tools';
import {PROSPECT_BASELINE_2027} from '@/components/draft/TeamProspectDraftboard';
import opportunityEngine from '../../../public/research/opportunities.js';
import decisionEngine from '../../../public/research/insights.js';

type Team={rosterId:number;teamName:string};
type Preview={leagueId:string;leagueName:string;season:number;teams:Team[]};
type Context=FantasyRostersData & {
 catalog:{id:string;gsisId:string|null;name:string;position:string;team:string}[];
 viewerRosterId:number;starterSlots:string[];leaguePpr:number|null;
 leagueName:string;teamName:string;taxiContext:TaxiContext|null};
type Signal=Omit<RadarSignal,'direction'>&{direction:'rising'|'falling';change:number;scoringChange:number};
type Ownership={player:ResearchSnapshot['players'][number];providerId:string|null;
 owner:FantasyRostersData['teams'][number]|null;match:'catalog'|'roster'|'unmatched'};
type Decision={heading:string;why:string;next:string;category:string}|null;
const engine=opportunityEngine as {radar:(d:ResearchSnapshot,scoring:string)=>Signal[];
 ownership:(players:ResearchSnapshot['players'],teams:FantasyRostersData['teams'],
 providers:FantasyRostersData['players'],catalog:Context['catalog'])=>Ownership[]};
const decisions=decisionEngine as {classify:(signal:Signal)=>Decision};
async function get<T>(path:string):Promise<T>{
 const res=await fetch(path,{cache:'no-store'});
 const body=await res.json().catch(()=>({})) as {error?:string};
 if(!res.ok)throw Error(body.error||'Live data unavailable. Try again.');
 return body as unknown as T;
}
async function researchSnapshot(year:number):Promise<ResearchSnapshot|null>{
 if(!Number.isInteger(year)||year<2017||year>2100)return null;
 try{
  const index=await get<{schema:number;files:Record<string,{key:string}>}>('/api/research-feed/research/v1/catalog.json');
  const key=index.files?.[String(year)]?.key;
  if(index.schema!==1||!key||!/^research\/v1\/objects\/20\d\d-[a-f0-9]{64}\.json$/.test(key))throw Error('No live object');
  return validateResearchSnapshot(await get<unknown>('/api/research-feed/'+key),year);
 }catch{
  try{return validateResearchSnapshot(await get<unknown>('/research/data/'+year+'.json'),year);}
  catch{return null;}
 }
}
function waiverSignals(snapshot:ResearchSnapshot|null,ctx:Context,needs:Need[]){
 if(!snapshot)return [];
 try{
  const score=ctx.leaguePpr===1?'ppr':ctx.leaguePpr===0?'standard':'half';
  const signals=engine.radar(snapshot,score);
  const lookup=new Map(snapshot.players.map(p=>[p.id,p]));
  const owners=engine.ownership(signals.map(s=>lookup.get(s.id)!).filter(Boolean),
   ctx.teams,ctx.players,ctx.catalog||[]);
  const rows=signals.map((signal,i)=>({
   signal,decision:decisions.classify(signal),owner:owners[i]?.owner||null,
   providerId:owners[i]?.providerId||null,match:owners[i]?.match||'unmatched'
  }));
  return decisionCandidates(rows,needs,ctx.viewerRosterId,'sleeper','waiver');
 }catch{return [];}
}
export default function PublicFantasyWorkbench({tool,initialLeagueId,initialRosterId}:{
 tool:PublicToolKey;initialLeagueId:string;initialRosterId:number|null;
}){
 const router=useRouter();
 const details=FANTASY_TOOLS.find(x=>x.key===tool)!;
 const valid=/^[0-9]{7,25}$/.test(initialLeagueId);
 const [entry,setEntry]=useState(valid?initialLeagueId:'');
 const [leagueId,setLeagueId]=useState(valid?initialLeagueId:'');
 const [rosterId,setRosterId]=useState<number|null>(valid?initialRosterId:null);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [context,setContext]=useState<Context|null>(null);
 const [snapshot,setSnapshot]=useState<ResearchSnapshot|null>(null);
 const [status,setStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle');
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const previewUrl=leagueId?'/api/public-fantasy/league?leagueId='+encodeURIComponent(leagueId):null;
 useEffect(()=>{
  if(!previewUrl){setPreview(null);setContext(null);return;}
  let live=true;setStatus('loading');setError('');setContext(null);
  void get<Preview>(previewUrl).then(v=>{if(live){setPreview(v);setStatus('ready');}})
   .catch(e=>{if(live){setStatus('error');setError(e instanceof Error?e.message:'Unavailable');}});
  return ()=>{live=false;};
 },[previewUrl,retry]);
 useEffect(()=>{
  if(!leagueId||rosterId===null||!preview?.teams.some(t=>t.rosterId===rosterId)){setContext(null);return;}
  let live=true;setStatus('loading');setError('');setContext(null);setSnapshot(null);
  const path='/api/public-fantasy/league?leagueId='+encodeURIComponent(leagueId)+'&rosterId='+rosterId;
  void get<Context>(path).then(async ctx=>({ctx,data:await researchSnapshot(Number(ctx.season))}))
   .then(({ctx,data})=>{if(live){setContext(ctx);setSnapshot(data);setStatus('ready');}})
   .catch(e=>{if(live){setStatus('error');setError(e instanceof Error?e.message:'Unable to load this roster');}});
  return ()=>{live=false;};
 },[leagueId,rosterId,preview,retry]);
 const needs=useMemo(()=>context?rosterNeeds(context.teams,context.players,context.viewerRosterId,context.starterSlots):[],[context]);
 const waiver=useMemo(()=>context?waiverSignals(snapshot,context,needs):[],[context,snapshot,needs]);
 function updateSelection(id:string,roster:number|null){
  setLeagueId(id);setRosterId(roster);setContext(null);setSnapshot(null);
  router.replace(publicToolUrl(tool,id,roster),{scroll:false});
 }
 const toolLinks=<nav aria-label="Fantasy advisor tools" className="flex gap-2 overflow-x-auto pb-2">
  {FANTASY_TOOLS.map(item=><Link key={item.key} href={publicToolUrl(item.key,leagueId,rosterId)}
   aria-current={item.key===tool?'page':undefined}
   className={'shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold sm:text-sm '+
    (item.key===tool?'border-[var(--brand-gold)] bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]':'border-white/20 text-white/75 hover:text-white')}>
    {item.label}</Link>)}
 </nav>;
 return <main className="lz-dark-surface min-h-screen bg-[var(--brand-ink)] text-white">
  <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-12">
   <Link href="/fantasy-tools" className="text-sm font-bold text-[var(--brand-gold)] hover:underline">← All fantasy tools</Link>
   <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--brand-gold)]">{details.group} · No account required</p>
     <h1 className="mt-2 text-3xl font-black sm:text-4xl">{details.label}</h1>
     <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">{details.description}</p></div>
    <Link href="/research/decisions" className="text-sm font-semibold text-white/75 underline">General NFL insights</Link>
   </div>
   <div className="mt-6">{toolLinks}</div>
   {tool==='receipts'&&<section className="mt-6 rounded-2xl border border-white/20 bg-white/[0.04] p-5 sm:p-6">
    <h2 className="text-xl font-bold">Public prediction outcomes</h2>
    <p className="mt-2 text-sm text-white/75">LeagueZone publishes public research receipts comparing earlier opportunity signals with what happened afterward. They are available without signing in.</p>
    <Link href="/research/receipts" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[var(--brand-gold)] px-4 font-bold text-[var(--brand-ink)]">View public prediction receipts →</Link>
    <p className="mt-3 text-xs text-white/65">Private start/bench decision history is separately saved to individual accounts. The public research receipts do not imply that a manager followed a recommendation.</p>
   </section>}
   {tool!=='receipts'&&<>
    <section className="mt-6 rounded-2xl border border-white/20 bg-[#102439] p-4 sm:p-6" aria-label="Choose Sleeper league and team">
     <h2 className="text-lg font-black">Use with your Sleeper league</h2>
     <p className="mt-1 text-sm text-white/70">No login, league hosting or commissioner permission. Use the numeric league ID from a Sleeper league URL, then choose a team to evaluate.</p>
     <form onSubmit={e=>{e.preventDefault();const id=entry.trim();
      if(!/^[0-9]{7,25}$/.test(id)){setError('Enter a numeric Sleeper league ID (7–25 digits).');return;}
      updateSelection(id,null);
     }} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex-1 text-xs font-semibold">Sleeper league ID
       <input inputMode="numeric" pattern="[0-9]{7,25}" required value={entry} onChange={e=>setEntry(e.target.value)}
        placeholder="Paste league ID" className="mt-1 block min-h-11 w-full rounded-lg border border-white/30 bg-[#071727] px-3 text-base text-white placeholder:text-white/45"/>
      </label>
      <button className="min-h-11 rounded-lg bg-[var(--brand-gold)] px-5 text-sm font-bold text-[var(--brand-ink)]" type="submit">Find teams</button>
     </form>
     {preview&&<label className="mt-4 block text-xs font-semibold">
       Choose a team · {preview.leagueName} ({preview.season})
       <select value={rosterId??''} onChange={e=>updateSelection(leagueId,e.target.value?Number(e.target.value):null)}
        className="mt-1 block min-h-11 w-full rounded-lg border border-white/30 bg-[#071727] px-3 text-white sm:max-w-lg">
        <option value="">Choose any team</option>
        {preview.teams.map(t=><option key={t.rosterId} value={t.rosterId}>{t.teamName}</option>)}
       </select>
      </label>}
     {status==='loading'&&<p role="status" className="mt-3 text-sm text-white/70">Checking Sleeper data…</p>}
     {error&&<div className="mt-3 flex flex-wrap gap-3 text-sm text-amber-200" role="alert">
       <span>{error}</span><button type="button" className="font-bold underline" onClick={()=>setRetry(x=>x+1)}>Retry</button>
      </div>}
    </section>
    {context&&rosterId!==null&&<div className="mt-6">
     <div className="mb-4 rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-sm">
      <strong>{context.teamName}</strong> · {context.leagueName} · {context.season} season
      {!snapshot&&<span className="ml-2 text-amber-200">Historical opportunity feed unavailable; trend-based waiver matches may be empty.</span>}
     </div>
     <DecisionFoundationPanel key={leagueId+':'+rosterId+':'+tool}
      endpoint={'/api/public-fantasy/lineup?leagueId='+encodeURIComponent(leagueId)+'&rosterId='+rosterId}
      rosters={context} teamId={rosterId} starterSlots={context.starterSlots}
      needs={needs} waiver={waiver} season={Number(context.season)}
      throughWeek={snapshot?.throughWeek||0} source="live" taxiContext={context.taxiContext}
      scope={{type:'guest',id:leagueId}} tool={tool}/>
    </div>}
    {!context&&status!=='loading'&&<section className="mt-6 rounded-xl border border-white/15 bg-white/[0.035] p-5">
     <h2 className="font-bold">Explore before choosing a team</h2>
     <p className="mt-2 text-sm text-white/70">The {details.label.toLowerCase()} opens when you select a publicly accessible Sleeper roster. You can also use these public tools immediately:</p>
     <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-[var(--brand-gold)]">
      <Link href="/trades/analyzer" className="underline">Trade Analyzer</Link>
      <Link href="/research/players" className="underline">Player research</Link>
      <Link href="/research/stats" className="underline">Stat leaders</Link>
      <Link href="/research/receipts" className="underline">Public prediction receipts</Link>
     </div>
     {tool==='draft'&&<div className="mt-5">
      <h3 className="text-sm font-bold">2027 scouting board preview</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{PROSPECT_BASELINE_2027.slice(0,6).map((p,i)=>
       <div key={p.id} className="rounded-lg border border-white/15 p-3 text-sm">
        <strong>{i+1}. {p.name}</strong> <span className="text-white/60">{p.pos} · {p.college}</span>
       </div>)}</div>
      <p className="mt-2 text-xs text-white/60">Early scouting baseline only, not a personalized or finalized NFL draft ranking.</p>
     </div>}
    </section>}
   </>}
  </div>
 </main>;
}
