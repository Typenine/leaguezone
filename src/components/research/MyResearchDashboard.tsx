'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,ArrowDown,ArrowUp,Bookmark,BookOpen,Check,LayoutDashboard,RefreshCw,Settings2} from 'lucide-react';
import {loadSavedLibrary,type SavedLibrary} from '@/lib/saved-research-client';
import type {SavedItem} from '@/lib/saved-research';
import {DEFAULT_DASHBOARD_PREFERENCES,RESEARCH_POSITIONS,
  moveSection,normalizeDashboardPreferences,type DashboardPreferences,type DashboardSection,
  type ResearchPosition} from '@/lib/dashboard-preferences';
import {loadDashboardResearch,ownershipLabel,safeRecent,type RecentResearch,type RadarSignal,
  type ResearchSnapshot} from '@/lib/research-dashboard';

type League={leagueId:string;leagueSlug:string;leagueName:string;teamName:string};
const EMPTY_LEAGUES:League[]=[];
type RadarApi={radar:(data:ResearchSnapshot,scoring:string,week:number)=>RadarSignal[]};
declare global {interface Window {LZOpportunities?:RadarApi}}
let radarPromise:Promise<void>|null=null;
function ensureRadar():Promise<void>{
 if(window.LZOpportunities)return Promise.resolve();
 if(radarPromise)return radarPromise;
 radarPromise=new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='/research/opportunities.js';script.async=true;
  script.onload=()=>window.LZOpportunities?resolve():reject(Error('Research tools unavailable'));
  script.onerror=()=>reject(Error('Could not load opportunity research'));
  document.head.appendChild(script);
 }).catch(error=>{radarPromise=null;throw error});
 return radarPromise;
}
const HOME_KEY='leaguezone:dashboard:guest-prefs:v1';
function readLocal(key:string):unknown{
 try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}
}
function recentKey(id:string|null){return 'leaguezone:recent-research:'+(id?'user:'+id:'guest')+':v1'}
function seenKey(id:string|null){return 'leaguezone:dashboard-seen:'+(id?'user:'+id:'guest')+':v1'}
function pill(selected:boolean){return 'rounded-lg border px-3 py-2 text-xs font-semibold transition '+(selected?
 'border-[var(--brand-gold)] text-[var(--brand-gold)] bg-[var(--brand-gold)]/10':
 'border-white/20 text-white/60 hover:border-white/50')}
const sectionNames:Record<DashboardSection,string>={
 activity:'Watchlist activity',feed:'My research feed',leagues:'My leagues',recent:'Continue researching'
};
const playerLink=(id:string,year:number)=>'/research/players/'+encodeURIComponent(id)+'?season='+year;

export default function MyResearchDashboard({
 initialUserId=null,initialLeagues=EMPTY_LEAGUES,embedded=false
}:{initialUserId?:string|null;initialLeagues?:League[];embedded?:boolean}){
 const [userId,setUserId]=useState<string|null>(initialUserId);
 const [leagues,setLeagues]=useState<League[]>(initialLeagues);
 const [items,setItems]=useState<SavedItem[]>([]);
 const [libraryMode,setLibraryMode]=useState<'loading'|'guest'|'account'|'error'>('loading');
 const [preferences,setPreferences]=useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFERENCES);
 const [prefsStatus,setPrefsStatus]=useState('');
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [saving,setSaving]=useState(false);
 const [research,setResearch]=useState<ResearchSnapshot|null>(null);
 const [researchStatus,setResearchStatus]=useState('Loading published player research…');
 const [radarReady,setRadarReady]=useState(false);
 const [recent,setRecent]=useState<RecentResearch[]>([]);
 const [seenWeek,setSeenWeek]=useState<number|null>(null);
 const [allSignals,setAllSignals]=useState(false);
 const [rosterStatus,setRosterStatus]=useState('');
 const [owners,setOwners]=useState<Record<string,string>>({});
 const [rosterBusy,setRosterBusy]=useState(false);
 const followed=useMemo(()=>items.filter(x=>x.type==='player'),[items]);
 const favorite=leagues.find(x=>x.leagueId===preferences.favoriteLeagueId)||leagues[0]||null;

 const reload=useCallback(async()=>{
  setResearchStatus('Loading published player research…');
  try{
   const d=await loadDashboardResearch();
   setResearch(d);
   await ensureRadar();
   setRadarReady(true);
   setResearchStatus(d.source==='backup'?'Showing the validated site backup. The latest R2 update could not be loaded.':
    'Published '+d.year+' research through Week '+d.throughWeek+'.');
  }catch{
   setResearch(null);setRadarReady(false);
   setResearchStatus('Research data is unavailable. Your saved players and leagues are still accessible.');
  }
 },[]);

 useEffect(()=>{
  let active=true;
  async function start(){
   let identity=initialUserId;
   let connected=initialLeagues;
   if(!identity){
    try{
     const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'});
     const data=await r.json().catch(()=>({})) as {authenticated?:boolean;user?:{id?:string};leagues?:League[]};
     if(data.authenticated&&typeof data.user?.id==='string'){
       identity=data.user.id;
       connected=Array.isArray(data.leagues)?data.leagues:[];
     }
    }catch{/* Guest mode remains functional if authentication lookup fails. */}
   }
   if(!active)return;
   setUserId(identity);setLeagues(connected);
   setRecent(safeRecent(readLocal(recentKey(identity))));
   const storedSeen=Number(localStorage.getItem(seenKey(identity)));
   setSeenWeek(Number.isInteger(storedSeen)&&storedSeen>0?storedSeen:null);
   if(identity){
    try{
     const r=await fetch('/api/dashboard-preferences',{credentials:'same-origin',cache:'no-store'});
     if(!r.ok)throw Error('Cannot load account dashboard settings.');
     const data=await r.json() as {preferences:unknown};
     if(active)setPreferences(normalizeDashboardPreferences(data.preferences));
    }catch{
     if(active)setPrefsStatus('Account layout settings are unavailable. Changes cannot sync until this service is restored.');
    }
   }else setPreferences(normalizeDashboardPreferences(readLocal(HOME_KEY)));
   try{
    const library:SavedLibrary=await loadSavedLibrary();
    if(!active)return;
    if(identity&&!library.signedIn)throw Error('Account watchlist could not be verified.');
    setItems(library.items);
    setLibraryMode(library.signedIn?'account':'guest');
   }catch{if(active)setLibraryMode('error')}
  }
  void start();void reload();
  return()=>{active=false};
 },[initialUserId,initialLeagues,reload]);

 const signals=useMemo(()=>{
  if(!research||!radarReady||!window.LZOpportunities)return [];
  try{return window.LZOpportunities.radar(research,preferences.scoring,research.throughWeek)}
  catch{return []}
 },[research,radarReady,preferences.scoring]);
 const watchedIds=useMemo(()=>new Set(followed.map(x=>x.key.slice('player:'.length))),[followed]);
 const watchSignals=useMemo(()=>signals.filter(s=>watchedIds.has(s.id)),[signals,watchedIds]);
 const visibleSignals=useMemo(()=>signals.filter(s=>preferences.positions.includes(s.pos as ResearchPosition))
  .filter(s=>allSignals||watchedIds.has(s.id)).slice(0,24),[signals,preferences.positions,allSignals,watchedIds]);
 const newlyUpdated=research&&seenWeek!=null&&research.throughWeek>seenWeek;
 const sectionOrder=preferences.sections.filter(s=>!preferences.hidden.includes(s));
 function alter(p:DashboardPreferences){setPreferences(p);setDirty(true);setPrefsStatus('Unsaved layout changes.')}
 function flipSection(s:DashboardSection){alter({...preferences,hidden:preferences.hidden.includes(s)?
  preferences.hidden.filter(x=>x!==s):[...preferences.hidden,s]})}
 function togglePosition(p:ResearchPosition){
  const positions=preferences.positions.includes(p)?preferences.positions.filter(x=>x!==p):[...preferences.positions,p];
  if(positions.length)alter({...preferences,positions});
 }
 async function savePreferences(){
  if(saving)return;
  setSaving(true);setPrefsStatus('');
  const normalized=normalizeDashboardPreferences(preferences);
  try{
   if(userId){
    const r=await fetch('/api/dashboard-preferences',{
      method:'PUT',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(normalized)
    });
    if(!r.ok){
     const error=await r.json().catch(()=>({})) as {error?:string};
     throw Error(error.error||'Account settings could not be saved.');
    }
   }else localStorage.setItem(HOME_KEY,JSON.stringify(normalized));
   setPreferences(normalized);setDirty(false);
   setPrefsStatus(userId?'Layout saved to your account.':'Layout saved on this device.');
  }catch(e){setPrefsStatus(e instanceof Error?e.message:'Unable to save settings.')}
  finally{setSaving(false)}
 }
 function markSeen(){
  if(!research)return;
  try{localStorage.setItem(seenKey(userId),String(research.throughWeek));setSeenWeek(research.throughWeek)}
  catch{setPrefsStatus('Could not save the last-seen week on this device.')}
 }
 function clearRecent(){
  try{localStorage.removeItem(recentKey(userId));setRecent([])}
  catch{setPrefsStatus('Browser history could not be cleared.')}
 }
 async function checkLeague(){
  if(!userId||!favorite||rosterBusy)return;
  setRosterBusy(true);setRosterStatus('Checking your league’s cached roster snapshot…');setOwners({});
  try{
   const res=await fetch('/api/league-opportunities/'+encodeURIComponent(favorite.leagueSlug),{
    credentials:'same-origin',cache:'no-store'
   });
   const data=await res.json() as {error?:string};
   if(!res.ok)throw Error(data.error||'League roster lookup unavailable');
   const next:Record<string,string>={};
   followed.forEach(p=>{next[p.key]=ownershipLabel(p.key.slice(7),data)});
   setOwners(next);
   const stale=res.headers.get('x-leaguezone-data-mode')==='stale';
   setRosterStatus('Roster snapshot checked'+(stale?' (cached data may be stale)':'')+
    '. Not rostered does not guarantee waiver eligibility.');
  }catch(e){setRosterStatus(e instanceof Error?e.message:'Could not check your league.')}
  finally{setRosterBusy(false)}
 }
 const panels:Record<DashboardSection,React.ReactNode>={
  activity:<section aria-labelledby="lz-watch-activity" className="rounded-xl border border-white/15 bg-white/[0.035] p-4 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3"><div>
    <h2 id="lz-watch-activity" className="text-lg font-black uppercase tracking-wide">Watchlist activity</h2>
    <p className="mt-1 text-sm text-white/55">{followed.length} followed players · {watchSignals.length} measurable role changes</p>
   </div><Link className="text-sm font-semibold text-[var(--brand-gold)] underline" href="/saved">Manage watchlist</Link></div>
   {libraryMode==='loading'&&<p role="status" className="mt-4 text-sm text-white/60">Loading watchlist…</p>}
   {libraryMode==='error'&&<p role="alert" className="mt-4 text-sm text-red-300">Watchlist unavailable; account data was not replaced with browser bookmarks.</p>}
   {libraryMode==='guest'&&<p className="mt-4 text-xs text-white/50">Guest watchlists are stored on this device. Sign in to sync across devices.</p>}
   {libraryMode!=='loading'&&libraryMode!=='error'&&followed.length===0&&
    <div className="mt-4 rounded-lg border border-dashed border-white/20 p-4">
     <p className="text-sm text-white/65">Follow players from their profiles to see their opportunity changes here.</p>
     <Link href="/research/players" className="mt-3 inline-block text-sm font-bold text-[var(--brand-gold)] underline">Find players</Link>
    </div>}
   {followed.length>0&&<div className="mt-4 grid gap-2 sm:grid-cols-2">{followed.slice(0,12).map(p=>{
    const signal=watchSignals.find(s=>p.key==='player:'+s.id);
    return <Link key={p.key} href={research?playerLink(p.key.slice(7),research.year):p.href}
      className="block min-w-0 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 hover:border-[var(--brand-gold)]/50">
      <span className="block truncate font-semibold">{p.title}</span>
      <span className="mt-1 block text-xs text-white/55">{signal?
       (signal.direction==='rising'?'Rising ':'Falling ')+signal.metric+': '+signal.baseline+' → '+signal.recent+' per game':
       'No qualifying current opportunity signal'}</span>
      {signal&&<span className="mt-1 block text-xs text-white/45">Weeks {signal.baselineWeeks.join(', ')} vs {signal.recentWeeks.join(', ')}</span>}
     </Link>
   })}</div>}
   {followed.length>12&&<p className="mt-3 text-xs text-white/50">Showing 12 players · <Link href="/saved" className="underline">View all</Link></p>}
  </section>,
  feed:<section aria-labelledby="lz-research-feed" className="rounded-xl border border-white/15 bg-white/[0.035] p-4 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div><h2 id="lz-research-feed" className="text-lg font-black uppercase tracking-wide">My research feed</h2>
     <p className="mt-1 text-sm text-white/55">Measured opportunity changes, not predictions or trade recommendations.</p></div>
    <button type="button" onClick={()=>setAllSignals(!allSignals)} className={pill(allSignals)}>
      {allSignals?'Followed players only':'Explore all signals'}</button>
   </div>
   <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Feed positions">
    {RESEARCH_POSITIONS.map(p=><button key={p} type="button" aria-pressed={preferences.positions.includes(p)}
      className={pill(preferences.positions.includes(p))} onClick={()=>togglePosition(p)}>{p}</button>)}
   </div>
   {!research&&<p role="status" className="mt-4 text-sm text-white/65">{researchStatus}</p>}
   {research&&<p className="mt-3 text-xs text-white/50">{researchStatus}</p>}
   {research&&visibleSignals.length===0&&<p className="mt-4 text-sm text-white/60">
    No qualifying {allSignals?'published':'followed-player'} role changes in the current snapshot.
    {allSignals?' Try other positions.':' Follow more players or explore all signals.'}</p>}
   <div className="mt-4 space-y-2">{visibleSignals.map(signal=><article key={signal.week+':'+signal.id}
    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/10 p-4">
    <div className="min-w-0 flex-1"><Link href={playerLink(signal.id,research?.year||0)}
      className="font-semibold text-white hover:text-[var(--brand-gold)] hover:underline">{signal.name}</Link>
     <p className="mt-1 text-xs text-white/55">{signal.pos} · {signal.team} · Week {signal.week}
      {newlyUpdated&&signal.week>seenWeek!?' · New since last visit':''}</p>
     <p className="mt-2 text-sm text-white/75">{signal.metric}: {signal.baseline} → {signal.recent} per game</p>
     <p className="mt-1 text-xs text-white/50">Fantasy scoring over the same windows: {signal.scoringBefore} → {signal.scoringRecent} FP/G</p>
    </div>
    <span className={signal.direction==='rising'?
     'rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300':
     'rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300'}>
     {signal.direction==='rising'?'Opportunity rising':'Opportunity falling'}</span>
   </article>)}</div>
   <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
    <div className="flex gap-4 text-xs font-semibold text-[var(--brand-gold)]">
     <Link href="/research/radar" className="underline">Full Radar</Link>
     <Link href="/research/receipts" className="underline">Published receipts</Link>
     <Link href="/research/development" className="underline">Development Lab</Link>
    </div>
    {research&&<button type="button" onClick={markSeen} className={pill(false)}>
      <Check aria-hidden="true" className="mr-1 inline" size={14}/>Mark week reviewed</button>}
   </div>
   {seenWeek!=null&&<p className="mt-2 text-xs text-white/45">Last reviewed through Week {seenWeek} on this device.</p>}
  </section>,
  leagues:<section aria-labelledby="lz-linked-leagues" className="rounded-xl border border-white/15 bg-white/[0.035] p-4 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3"><div>
    <h2 id="lz-linked-leagues" className="text-lg font-black uppercase tracking-wide">League-aware research</h2>
    <p className="mt-1 text-sm text-white/55">Check followed players against rosters you are authorized to view.</p></div>
    <Link href="/app/leagues" className="text-sm font-semibold text-[var(--brand-gold)] underline">My leagues</Link>
   </div>
   {!userId&&<p className="mt-4 text-sm text-white/65">Sign in and connect a league to see roster ownership. <Link href="/login?next=%2Fmy-research" className="underline text-[var(--brand-gold)]">Sign in</Link></p>}
   {userId&&!leagues.length&&<p className="mt-4 text-sm text-white/65">No linked leagues yet. Your public research still works without one.</p>}
   {userId&&leagues.length>0&&<div className="mt-4">
    <label className="block text-xs font-semibold text-white/65" htmlFor="research-league">Research league</label>
    <select id="research-league" className="mt-2 w-full max-w-lg rounded-lg border border-white/25 bg-[#15273a] p-3 text-white"
      value={favorite?.leagueId||''} onChange={e=>{alter({...preferences,favoriteLeagueId:e.target.value||null});setOwners({});setRosterStatus('')}}>
      {leagues.map(l=><option value={l.leagueId} key={l.leagueId}>{l.leagueName}</option>)}
    </select>
    {favorite&&<p className="mt-2 text-xs text-white/55">Your team: {favorite.teamName} · <Link className="underline text-[var(--brand-gold)]" href={'/l/'+encodeURIComponent(favorite.leagueSlug)}>Open league</Link></p>}
    <button type="button" disabled={rosterBusy||!followed.length} onClick={()=>void checkLeague()}
      className="mt-4 min-h-11 rounded-md bg-[var(--brand-gold)] px-4 text-sm font-bold text-[var(--brand-ink)] disabled:opacity-50">
      {rosterBusy?'Checking…':'Check watched players in this league'}</button>
    {!followed.length&&<p className="mt-2 text-xs text-white/50">Follow a player first to compare against this league&apos;s roster.</p>}
    {rosterStatus&&<p role="status" className="mt-3 text-xs text-white/65">{rosterStatus}</p>}
    {Object.keys(owners).length>0&&<div className="mt-4 grid gap-2 sm:grid-cols-2">
     {followed.filter(x=>owners[x.key]).map(x=><div key={x.key} className="rounded-lg border border-white/10 p-3">
      <Link href={x.href} className="font-semibold hover:underline">{x.title}</Link>
      <p className="mt-1 text-xs text-white/55">{owners[x.key]}</p></div>)}</div>}
   </div>}
  </section>,
  recent:<section aria-labelledby="lz-recent-research" className="rounded-xl border border-white/15 bg-white/[0.035] p-4 sm:p-6">
   <div className="flex items-center justify-between gap-3">
    <div><h2 id="lz-recent-research" className="text-lg font-black uppercase tracking-wide">Continue researching</h2>
     <p className="mt-1 text-sm text-white/55">Recently visited public research on this device.</p></div>
    {recent.length>0&&<button type="button" className={pill(false)} onClick={clearRecent}>Clear</button>}
   </div>
   {recent.length===0&&<p className="mt-4 text-sm text-white/65">Your recently opened player profiles will appear here.</p>}
   <div className="mt-4 grid gap-2 sm:grid-cols-2">{recent.slice(0,8).map(x=><Link href={x.href} key={x.href}
    className="rounded-lg border border-white/10 p-3 hover:border-[var(--brand-gold)]/60">
    <span className="block truncate font-semibold">{x.title}</span>
    <span className="mt-1 block text-xs text-white/45">{new Date(x.visitedAt).toLocaleDateString()}</span>
   </Link>)}</div>
   {items.some(x=>x.type==='view')&&<div className="mt-5 border-t border-white/10 pt-4">
    <h3 className="text-sm font-bold">Saved research views</h3>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{items.filter(x=>x.type==='view').slice(0,5).map(x=>
     <Link key={x.key} href={x.href} className="text-xs font-semibold text-[var(--brand-gold)] underline">{x.title}</Link>)}</div>
   </div>}
  </section>
 };
 return <section data-testid="my-research-dashboard" className={embedded?'text-white':'min-h-screen bg-[var(--brand-ink)] px-4 py-8 text-white sm:py-12'}>
  <div className={embedded?'':'mx-auto max-w-6xl'}>
   <div className="flex flex-wrap items-start justify-between gap-4">
    <div><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--brand-gold)]">
      <LayoutDashboard aria-hidden="true" size={15}/>My research center</div>
     <h1 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">Your fantasy football, in focus.</h1>
     <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
      Your watched players, meaningful usage changes, recent research, and leagues in one place.</p></div>
    <div className="flex flex-wrap gap-2">
     <button type="button" onClick={()=>void reload()} className={pill(false)}><RefreshCw aria-hidden="true" size={14} className="mr-1 inline"/>Refresh research</button>
     <button type="button" aria-expanded={settingsOpen} aria-controls="lz-dashboard-settings"
       onClick={()=>setSettingsOpen(!settingsOpen)} className={pill(settingsOpen)}>
       <Settings2 aria-hidden="true" size={14} className="mr-1 inline"/>Customize</button>
    </div>
   </div>
   <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Dashboard summary">
    {[
     {n:String(followed.length),label:'Watched players',Icon:Bookmark},
     {n:String(watchSignals.length),label:'Watchlist signals',Icon:Activity},
     {n:String(leagues.length),label:'Connected leagues',Icon:LayoutDashboard},
     {n:String(recent.length),label:'Recently opened',Icon:BookOpen}
    ].map(({n,label,Icon})=><div key={label} className="rounded-xl border border-white/15 bg-white/[0.035] p-4">
     <Icon size={18} className="text-[var(--brand-gold)]" aria-hidden="true"/>
     <p className="mt-2 text-2xl font-black tabular-nums">{n}</p>
     <p className="text-xs text-white/55">{label}</p>
    </div>)}
   </div>
   {settingsOpen&&<div id="lz-dashboard-settings" className="mt-5 rounded-xl border border-[var(--brand-gold)]/40 bg-white/[0.035] p-4 sm:p-6">
    <h2 className="text-lg font-black uppercase">Customize your dashboard</h2>
    <p className="mt-1 text-xs text-white/55">{userId?'Layout and filters can sync with your account.':'Guest layout is saved only on this device.'}</p>
    <div className="mt-4 grid gap-5 lg:grid-cols-2">
     <div><h3 className="text-sm font-bold">Sections and order</h3>
      <div className="mt-2 space-y-2">{preferences.sections.map((s,i)=><div key={s} className="flex items-center gap-2 rounded-lg border border-white/10 p-2">
       <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <input type="checkbox" checked={!preferences.hidden.includes(s)} onChange={()=>flipSection(s)}/>
        {sectionNames[s]}</label>
       <button aria-label={'Move '+sectionNames[s]+' up'} type="button" disabled={i===0}
        onClick={()=>alter(moveSection(preferences,s,-1))} className={pill(false)+' disabled:opacity-30'}><ArrowUp size={14}/></button>
       <button aria-label={'Move '+sectionNames[s]+' down'} type="button" disabled={i===preferences.sections.length-1}
        onClick={()=>alter(moveSection(preferences,s,1))} className={pill(false)+' disabled:opacity-30'}><ArrowDown size={14}/></button>
      </div>)}</div>
     </div>
     <div><h3 className="text-sm font-bold">Fantasy scoring</h3>
      <select className="mt-2 w-full rounded-lg border border-white/20 bg-[#15273a] p-3 text-white" aria-label="Dashboard scoring format"
       value={preferences.scoring} onChange={e=>alter({...preferences,scoring:e.target.value as DashboardPreferences['scoring']})}>
       <option value="half">Half PPR</option><option value="ppr">PPR</option><option value="standard">Standard</option>
      </select>
      <p className="mt-3 text-xs text-white/55">Position filters are also available directly above the research feed.</p>
      <button type="button" onClick={()=>alter(DEFAULT_DASHBOARD_PREFERENCES)} className="mt-3 text-sm text-[var(--brand-gold)] underline">
       Restore default layout</button>
     </div>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
     <button type="button" disabled={saving||!dirty} onClick={()=>void savePreferences()}
      className="min-h-11 rounded-lg bg-[var(--brand-gold)] px-5 text-sm font-black text-[var(--brand-ink)] disabled:opacity-50">
      {saving?'Saving…':'Save dashboard settings'}</button>
     {prefsStatus&&<span role="status" className="text-xs text-white/65">{prefsStatus}</span>}
    </div>
   </div>}
   {newlyUpdated&&<div className="mt-5 rounded-lg border border-[var(--brand-gold)]/35 bg-[var(--brand-gold)]/10 px-4 py-3 text-sm text-white/80">
    New research is available since you reviewed Week {seenWeek}. Published data now runs through Week {research?.throughWeek}.
   </div>}
   {prefsStatus&&!settingsOpen&&dirty&&<p role="status" className="mt-3 text-xs text-white/60">{prefsStatus} <button type="button" onClick={()=>setSettingsOpen(true)} className="underline">Save settings</button></p>}
   <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-[var(--brand-gold)]">
    <Link className="underline" href="/research/players">Player directory</Link>
    <Link className="underline" href="/saved">Saved research</Link>
    <Link className="underline" href="/search">Search</Link>
    <Link className="underline" href="/research/radar">Opportunity Radar</Link>
   </div>
   <div className="mt-5 space-y-5">{sectionOrder.map(section=><div key={section}>{panels[section]}</div>)}</div>
   {!sectionOrder.length&&<p className="mt-5 text-sm text-white/60">All sections are hidden. Use Customize to show them again.</p>}
  </div>
 </section>
}
