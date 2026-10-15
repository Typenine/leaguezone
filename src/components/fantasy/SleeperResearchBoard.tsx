'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import ActionableDecisions from '@/components/fantasy/ActionableDecisions';
import DecisionFoundationPanel from '@/components/fantasy/DecisionFoundationPanel';
import {rosterNeeds,decisionCandidates} from '@/lib/fantasy/personalized-decisions';
import {validateResearchSnapshot,type ResearchSnapshot,type RadarSignal} from '@/lib/research-dashboard';
import type {FantasyRostersData} from '@/lib/providers/types';
import opportunityEngine from '../../../public/research/opportunities.js';
import decisionEngine from '../../../public/research/insights.js';

type Connection={leagueId:string;leagueName:string;teamName:string;rosterId:number;season:number};
type Catalog={id:string;gsisId:string|null;name:string;position:string;team:string};
type Context=FantasyRostersData&{catalog:Catalog[];viewerRosterId:number;starterSlots:string[];
  leaguePpr:number|null;leagueName:string;teamName:string;taxiContext?:import('@/lib/fantasy/taxi-context').TaxiContext|null};
type Signal=Omit<RadarSignal,'direction'>&{direction:'rising'|'falling';change:number;scoringChange:number};
type Ownership={player:ResearchSnapshot['players'][number];providerId:string|null;
  owner:FantasyRostersData['teams'][number]|null;match:'catalog'|'roster'|'unmatched'};
type Decision={heading:string;why:string;next:string;category:string}|null;
const engine=opportunityEngine as {radar:(d:ResearchSnapshot,scoring:string)=>Signal[];
 ownership:(players:ResearchSnapshot['players'],teams:FantasyRostersData['teams'],
 providers:FantasyRostersData['players'],catalog:Catalog[])=>Ownership[]};
const decisions=decisionEngine as {classify:(signal:Signal)=>Decision};

async function get<T>(url:string):Promise<T>{
 const res=await fetch(url,{credentials:'same-origin',cache:'no-store'});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error((data as {error?:string}).error||'Unable to load research.');
 return data as T;
}
async function loadLeagueSeason(season:number):Promise<ResearchSnapshot>{
 if(!Number.isInteger(season)||season<2017||season>2100)throw Error('Invalid connected league season.');
 try{
  const catalog=await get<{schema:number;files:Record<string,{key:string}>}>('/api/research-feed/research/v1/catalog.json');
  const key=catalog.schema===1&&catalog.files?.[String(season)]?.key;
  if(!key||!/^research\/v1\/objects\/20\d\d-[a-f0-9]{64}\.json$/.test(key))
   throw Error('No published season file.');
  const data=await get<unknown>('/api/research-feed/'+key);
  return {...validateResearchSnapshot(data,season),source:'live'};
 }catch{
  const archived=await get<unknown>('/research/data/'+season+'.json');
  return {...validateResearchSnapshot(archived,season),source:'backup'};
 }
}
export default function SleeperResearchBoard({initialLeagueId}:{initialLeagueId:string}){
 const router=useRouter();
 const [connections,setConnections]=useState<Connection[]>([]);
 const [leagueId,setLeagueId]=useState(initialLeagueId);
 const [context,setContext]=useState<Context|null>(null);
 const [snapshot,setSnapshot]=useState<ResearchSnapshot|null>(null);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [error,setError]=useState('');
 const [focus,setFocus]=useState<'overview'|'waiver'|'trade'|'risk'>('overview');
 const [scoring,setScoring]=useState('half');
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  let active=true;
  get<{connections:Connection[]}>('/api/research/sleeper/connections')
   .then(d=>{if(active){setConnections(d.connections);if(!leagueId&&d.connections.length)setLeagueId(d.connections[0].leagueId);}})
   .catch(e=>{if(active){setError(e instanceof Error?e.message:'Unable to load connections');setStatus('error');}});
  return ()=>{active=false;};
 },[leagueId]);
 useEffect(()=>{
  if(!leagueId)return;
  let active=true;
  setStatus('loading');setError('');setContext(null);setSnapshot(null);
  get<Context>('/api/research/sleeper/context?leagueId='+encodeURIComponent(leagueId))
   .then(async c=>[c,await loadLeagueSeason(Number(c.season))] as const)
   .then(([c,d])=>{if(active){setContext(c);setSnapshot(d);setScoring(c.leaguePpr===1?'ppr':c.leaguePpr===0?'standard':'half');setStatus('ready');}})
   .catch(e=>{if(active){setError(e instanceof Error?e.message:'Research unavailable');setStatus('error');}});
  return ()=>{active=false;};
 },[leagueId,reload]);
 const report=useMemo(()=>{
  if(!snapshot||!context)return null;
  try{
   const signals=engine.radar(snapshot,scoring).filter(s=>s.direction==='rising'||s.direction==='falling');
   const byId=new Map(snapshot.players.map(p=>[p.id,p]));
   const owners=engine.ownership(signals.map(s=>byId.get(s.id)!).filter(Boolean),
    context.teams,context.players,context.catalog||[]);
   const rows=signals.map((signal,i)=>({
    signal,decision:decisions.classify(signal),owner:owners[i]?.owner||null,
    providerId:owners[i]?.providerId||null,match:owners[i]?.match||'unmatched'}));
   const needs=rosterNeeds(context.teams,context.players,context.viewerRosterId,context.starterSlots);
   return {needs,personal:{
    waiver:decisionCandidates(rows,needs,context.viewerRosterId,'sleeper','waiver'),
    trade:decisionCandidates(rows,needs,context.viewerRosterId,'sleeper','trade'),
    risk:decisionCandidates(rows,needs,context.viewerRosterId,'sleeper','my-roster'),
   },unmatched:rows.filter(x=>x.match==='unmatched').length};
  }catch{return null;}
 },[snapshot,context,scoring]);
 function changeLeague(next:string){
  setLeagueId(next);setFocus('overview');
  router.replace('/app/fantasy-team?leagueId='+encodeURIComponent(next),{scroll:false});
 }
 return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-white">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-xs font-black uppercase tracking-widest text-[var(--brand-gold)]">My Research · Sleeper</p>
    <h1 className="mt-2 text-3xl font-black uppercase sm:text-4xl">My Fantasy Decisions</h1>
    <p className="mt-2 max-w-3xl text-sm text-white/70">Research your Sleeper team without hosting a league website on LeagueZone. This is a read-only connection and does not grant transaction permissions.</p></div>
   <Link href="/app/connect-sleeper" className="min-h-11 rounded-lg border border-white/30 px-4 py-3 text-sm font-bold text-[var(--brand-gold)]">Manage connected teams</Link>
  </header>
  {connections.length===0&&status!=='error'&&<section className="rounded-xl border border-white/20 p-6">
   <h2 className="text-xl font-black">Connect your first Sleeper team</h2>
   <p className="mt-2 text-sm text-white/70">You do not need commissioner access or a LeagueZone-hosted league.</p>
   <Link href="/app/connect-sleeper" className="mt-4 inline-flex rounded-lg bg-[var(--brand-gold)] px-5 py-3 text-sm font-black text-[var(--brand-ink)]">Find my team →</Link>
  </section>}
  {connections.length>0&&<div className="flex flex-wrap items-end justify-between gap-4">
   <label className="text-sm font-bold">Connected Sleeper league
    <select value={leagueId} onChange={e=>changeLeague(e.target.value)}
     className="mt-2 block min-h-11 max-w-full rounded-lg border border-white/25 bg-[#15273a] px-3 text-white">
     {connections.map(l=><option key={l.leagueId} value={l.leagueId}>{l.leagueName} · {l.teamName}</option>)}
    </select></label>
   <button type="button" onClick={()=>setReload(n=>n+1)} disabled={status==='loading'}
    className="min-h-11 rounded-lg border border-white/30 px-4 text-sm font-bold">Refresh roster and research</button>
  </div>}
  {status==='loading'&&leagueId&&<p role="status" className="text-sm text-white/70">Loading your current Sleeper roster and published player research…</p>}
  {status==='error'&&<div className="rounded-xl border border-red-400/40 p-5">
   <p role="alert" className="text-sm text-red-200">{error}</p>
   <button type="button" className="mt-3 text-sm font-semibold text-[var(--brand-gold)] underline" onClick={()=>setReload(n=>n+1)}>Retry</button>
  </div>}
  {status==='ready'&&context&&snapshot&&report&&<div className="space-y-5">
   <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/15 p-4">
    <div>
     <h2 className="text-lg font-black">{context.teamName}</h2>
     <p className="mt-1 text-sm text-white/70">{context.leagueName} · {context.season} NFL season · Data through Week {snapshot.throughWeek}</p>
     {snapshot.source==='backup'&&<p className="mt-2 text-xs text-amber-200">Showing an archived research backup. Published live data may be newer.</p>}
     {context.leaguePpr!==null&&![0,.5,1].includes(context.leaguePpr)&&<p className="mt-1 text-xs text-amber-200">Custom PPR scoring: research signals use half-PPR approximation; league-specific scoring bonuses are not modeled here.</p>}
    </div>
    <label className="text-xs font-bold">Research scoring
     <select value={scoring} onChange={e=>setScoring(e.target.value)}
      className="mt-1 block rounded border border-white/25 bg-[#15273a] p-2 text-white">
      <option value="half">Half PPR</option><option value="ppr">Full PPR</option><option value="standard">Standard</option>
     </select></label>
   </div>
   <DecisionFoundationPanel key={leagueId}
    endpoint={'/api/research/sleeper/lineup?leagueId='+encodeURIComponent(leagueId)}
    rosters={context} teamId={context.viewerRosterId} starterSlots={context.starterSlots}
    needs={report.needs} waiver={report.personal.waiver} season={snapshot.year}
    throughWeek={snapshot.throughWeek} source={snapshot.source} taxiContext={context.taxiContext}
    scope={{type:'sleeper',id:leagueId}}
    onSelect={f=>{if(f==='waiver')setFocus('waiver');else document.getElementById('read-only-lineup-guide')?.scrollIntoView({behavior:'smooth'});}}/>
   <div className="flex flex-wrap gap-2" role="group" aria-label="Decision category">
    {([['overview','My next moves'],['waiver','Waiver watch'],['trade','Trade targets'],['risk','My roster alerts']] as const)
    .map(([value,label])=><button type="button" key={value} onClick={()=>setFocus(value)} aria-pressed={focus===value}
     className={'min-h-11 rounded-lg border px-4 text-sm font-bold '+(focus===value?'border-[var(--brand-gold)] bg-white/10':'border-white/20 hover:border-white/50')}>{label}</button>)}
   </div>
   <div id="read-only-lineup-guide" className="rounded-xl border border-white/15 p-4 sm:p-6">
    <ActionableDecisions rosters={context} season={snapshot.year} teamId={context.viewerRosterId}
     needs={report.needs} personal={report.personal} focus={focus} onFocus={key=>{if(key!=='lineup')setFocus(key);}}/>
    {focus==='risk'&&<div className="mt-6 grid gap-3 sm:grid-cols-2">
     {report.personal.risk.slice(0,20).map(item=><div key={item.signal.id} className="rounded-lg border border-white/15 p-4">
      <Link href={'/research/players/'+encodeURIComponent(item.signal.id)+'?season='+snapshot.year}
       className="font-bold text-[var(--brand-gold)] underline">{item.signal.name}</Link>
      <p className="mt-2 text-sm text-white/75">{item.decision?.why||'Recent workload has declined.'}</p>
     </div>)}
     {!report.personal.risk.length&&<p className="text-sm text-white/70">No verified declining-role signals currently match your roster.</p>}
    </div>}
   </div>
   <p className="text-xs text-white/65">Research-only mode does not make waiver claims or trades. Weekly lineup recommendations and player comparisons also work without hosting a LeagueZone league. Sleeper username ownership is not independently authenticated.</p>
  </div>}
 </div>;
}
