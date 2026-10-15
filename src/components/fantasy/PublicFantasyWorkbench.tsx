'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {parseSleeperLeagueInput} from '@/lib/sleeper-research-shared';
import {readRememberedLeague,rememberLeague,loadSavedSleeperTeams,preferredSleeperTeam,preferSleeperTeam,type SavedSleeperTeam} from '@/lib/fantasy/remembered-league';
import TradeAnalyzerPage from '@/app/trades/analyzer/page';
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
 const [connected,setConnected]=useState<SavedSleeperTeam[]>([]);
 const [connectionStatus,setConnectionStatus]=useState('');
 useEffect(()=>{
  let live=true;
  void loadSavedSleeperTeams().then(({connected:items,signedIn})=>{
   if(!live)return;
   setConnected(items);
   if(initialLeagueId)return;
   const choice=signedIn?preferredSleeperTeam(items):null;
   const remembered=choice?{leagueId:choice.leagueId,rosterId:choice.rosterId}:readRememberedLeague();
   if(remembered){setEntry(remembered.leagueId);setLeagueId(remembered.leagueId);setRosterId(remembered.rosterId);}
  }).catch(e=>{if(live){
   setConnectionStatus(e instanceof Error?e.message:'Unable to load saved teams');
   if(!initialLeagueId){const last=readRememberedLeague();if(last){
    setEntry(last.leagueId);setLeagueId(last.leagueId);setRosterId(last.rosterId);}}
  }});
  return ()=>{live=false;};
 },[initialLeagueId]);
 const selectedConnection=connected.find(c=>c.leagueId===leagueId)||null;
 const previewUrl=leagueId&&!selectedConnection?'/api/public-fantasy/league?leagueId='+encodeURIComponent(leagueId):null;
 useEffect(()=>{
  if(selectedConnection){
   setPreview({leagueId,leagueName:selectedConnection.leagueName,season:selectedConnection.season,
    teams:[{rosterId:selectedConnection.rosterId,teamName:selectedConnection.teamName}]});
   setRosterId(selectedConnection.rosterId);setStatus('ready');return;
  }
  if(!previewUrl){setPreview(null);setContext(null);return;}
  let live=true;setStatus('loading');setError('');setContext(null);
  void get<Preview>(previewUrl).then(v=>{if(live){setPreview(v);setStatus('ready');rememberLeague(leagueId,rosterId);}})
   .catch(e=>{if(live){setStatus('error');setError(e instanceof Error?e.message:'Unavailable');}});
  return ()=>{live=false;};
 },[previewUrl,selectedConnection,leagueId,retry]);
 useEffect(()=>{
  if(!leagueId||rosterId===null||!preview?.teams.some(t=>t.rosterId===rosterId)){setContext(null);return;}
  let live=true;setStatus('loading');setError('');setContext(null);setSnapshot(null);
  const path=selectedConnection?'/api/research/sleeper/context?leagueId='+encodeURIComponent(leagueId):
   '/api/public-fantasy/league?leagueId='+encodeURIComponent(leagueId)+'&rosterId='+rosterId;
  void get<Context>(path).then(async ctx=>({ctx,data:await researchSnapshot(Number(ctx.season))}))
   .then(({ctx,data})=>{if(live){setContext(ctx);setSnapshot(data);setStatus('ready');}})
   .catch(e=>{if(live){setStatus('error');setError(e instanceof Error?e.message:'Unable to load this roster');}});
  return ()=>{live=false;};
 },[leagueId,rosterId,preview,selectedConnection,retry]);
 const needs=useMemo(()=>context?rosterNeeds(context.teams,context.players,context.viewerRosterId,context.starterSlots):[],[context]);
 const waiver=useMemo(()=>context?waiverSignals(snapshot,context,needs):[],[context,snapshot,needs]);
 function updateSelection(id:string,roster:number|null){
  setLeagueId(id);setRosterId(roster);setPreview(null);setContext(null);setSnapshot(null);setError('');
  if(id)rememberLeague(id,roster);
  if(connected.some(c=>c.leagueId===id))void preferSleeperTeam(id).catch(()=>{});
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
   {tool==='trade'&&<section className="mt-6 rounded-2xl border border-white/20 bg-white/[0.035] p-4 sm:p-5">
    <h2 className="text-xl font-black">Trade Analyzer: no league required</h2>
    <p className="mt-2 text-sm text-white/70">Compare players and picks immediately. Connect a Sleeper league below to see the actual owners, players counted toward positional strength, and each roster before and after the same trade. No connection is needed for market values.</p>
    <div id="trade-market-and-roster" className="mt-4 rounded-xl bg-[var(--surface)] text-[var(--text)]"><TradeAnalyzerPage
     rosterContext={context?{rosters:context,starterSlots:context.starterSlots,
      viewerRosterId:context.viewerRosterId,leagueName:context.leagueName,season:Number(context.season)}:undefined}/></div>
   </section>}
   {tool!=='receipts'&&<>
    <section className="mt-6 rounded-2xl border border-white/20 bg-[#102439] p-4 sm:p-6" aria-label="Choose Sleeper league and team">
     <h2 className="text-lg font-black">{tool==='trade'?'Optional roster-based trade impact':'Your Sleeper league'}</h2>
     <p className="mt-1 text-sm text-white/70">Your last saved league loads automatically. To analyze a different league, enter a Sleeper league ID or link. No commissioner permission is required.</p>
     {connected.length>0&&<label className="mt-4 block max-w-lg text-xs font-semibold">Your saved Sleeper teams
      <select value={selectedConnection?.leagueId||''} onChange={e=>{const item=connected.find(c=>c.leagueId===e.target.value);
       if(item){setEntry(item.leagueId);updateSelection(item.leagueId,item.rosterId);}}}
       className="mt-1 block min-h-11 w-full rounded-lg border border-white/30 bg-[#071727] px-3 text-white">
       <option value="">Another league</option>
       {connected.map(c=><option key={c.leagueId} value={c.leagueId}>{c.leagueName} · {c.teamName}</option>)}
      </select></label>}
     {connectionStatus&&<p role="status" className="mt-2 text-xs text-amber-200">{connectionStatus}</p>}
     <form onSubmit={e=>{e.preventDefault();
      const id=parseSleeperLeagueInput(entry);
      if(!id){setError('Enter a valid Sleeper league ID or league URL.');return;}
      const item=connected.find(c=>c.leagueId===id);
      updateSelection(id,item?.rosterId||null);
     }} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex-1 text-xs font-semibold">Sleeper league ID
       <input required value={entry} onChange={e=>setEntry(e.target.value)}
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
      {tool==='trade'&&<p className="mt-2 text-sm">This league's rosters are connected to the trade shown above. <a href="#trade-market-and-roster" className="font-bold text-[var(--brand-gold)] underline">View market and roster impact together</a></p>}
      {!snapshot&&<span className="ml-2 text-amber-200">Historical opportunity feed unavailable; trend-based waiver matches may be empty.</span>}
     </div>
     <DecisionFoundationPanel key={leagueId+':'+rosterId+':'+tool}
      endpoint={'/api/public-fantasy/lineup?leagueId='+encodeURIComponent(leagueId)+'&rosterId='+rosterId}
      rosters={context} teamId={rosterId} starterSlots={context.starterSlots}
      needs={needs} waiver={waiver} season={Number(context.season)}
      throughWeek={snapshot?.throughWeek||0} source="live" taxiContext={context.taxiContext}
      scope={{type:'guest',id:leagueId}} tool={tool}/>
    </div>}
    {!context&&status!=='loading'&&tool!=='trade'&&<section className="mt-6 rounded-xl border border-white/15 bg-white/[0.035] p-5">
     <h2 className="font-bold">Explore before choosing a team</h2>
     <p className="mt-2 text-sm text-white/70">Roster-specific advice opens once a Sleeper team is selected. You can also use public research immediately:</p>
     <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-[var(--brand-gold)]">
      <Link href="/fantasy-tools/trade" className="underline">Trade Analyzer</Link>
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
