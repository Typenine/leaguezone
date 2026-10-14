'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,ArrowRight,Bookmark,CalendarClock,ExternalLink,RefreshCw,ShieldAlert,Users} from 'lucide-react';
import {TEAM_CODES} from '@/lib/weekly-center';
import {diffAvailability,keyPlayer,labelStatus,matchResearchPlayer,
 type AvailabilityPayload,type AvailabilityPlayer,type SeenEvent,type SeenState} from '@/lib/availability';
import {loadDashboardResearch,type ResearchSnapshot} from '@/lib/research-dashboard';
import {loadSavedLibrary} from '@/lib/saved-research-client';

const HISTORY_KEY='leaguezone:availability-observed:v1';
type Filter='reported'|'practice'|'game'|'all'|'watched';
type League={leagueId:string;leagueSlug:string;leagueName:string;teamName:string};
type LeagueRosters={provider:string;viewerRosterId?:number|null;teams:{rosterId:number;teamName:string;players:string[]}[];catalog?:{id:string;gsisId:string|null}[];error?:string};

const classes={
 panel:'rounded-xl border border-white/15 bg-white/[0.035] p-4 sm:p-5',
 input:'min-h-11 w-full rounded-lg border border-white/25 bg-[#122740] p-3 text-white placeholder:text-white/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e2bc71]',
 link:'font-semibold text-[#e2bc71] underline underline-offset-2 hover:text-[#f9e6ba]'
};
function getHistory():SeenState|undefined{
 try{
  const d=JSON.parse(localStorage.getItem(HISTORY_KEY)||'null') as SeenState;
  if(!d||typeof d!=='object'||!d.fingerprints||typeof d.fingerprints!=='object'||!Array.isArray(d.events))return undefined;
  return {fingerprints:Object.fromEntries(Object.entries(d.fingerprints).filter(([k,v])=>k.length<220&&typeof v==='string'&&v.length<260).slice(0,8000)),
   events:d.events.filter(e=>e&&typeof e.key==='string'&&e.key.length<220&&typeof e.current==='string'&&typeof e.previous==='string'&&typeof e.seenAt==='number').slice(-120)};
 }catch{return undefined}
}
const safeTime=(s:string|null|undefined)=>s&&Number.isFinite(Date.parse(s))?new Date(s).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not provided';
function isGameDesignation(p:AvailabilityPlayer){
 return Boolean(p.injuryStatus&&/out|doubtful|questionable|suspend|ir|pup/i.test(p.injuryStatus)||
  p.rosterStatus&&/ir|injured|pup/i.test(p.rosterStatus));
}
const identity=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
export default function AvailabilityCenter(){
 const [payload,setPayload]=useState<AvailabilityPayload|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [query,setQuery]=useState('');
 const [team,setTeam]=useState('');
 const [position,setPosition]=useState('');
 const [filter,setFilter]=useState<Filter>('reported');
 const [data,setData]=useState<ResearchSnapshot|null>(null);
 const [savedIds,setSavedIds]=useState<string[]>([]);
 const [recent,setRecent]=useState<SeenEvent[]>([]);
 const [selected,setSelected]=useState<AvailabilityPlayer|null>(null);
 const [tracked,setTracked]=useState(false);
 const [refresh,setRefresh]=useState(0);
 const [leagues,setLeagues]=useState<League[]>([]);
 const [leagueSlug,setLeagueSlug]=useState('');
 const [leagueLoading,setLeagueLoading]=useState(false);
 const [leagueMessage,setLeagueMessage]=useState('');
 const [leagueOwners,setLeagueOwners]=useState<Record<string,string>>({});

 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);
  const t=(p.get('team')||'').toUpperCase();
  if(TEAM_CODES.has(t))setTeam(t);
  const q=p.get('player');
  if(q&&q.length<150)setQuery(q);
  void loadSavedLibrary().then(v=>setSavedIds(v.items.filter(i=>i.type==='player').map(i=>i.key.slice(7))))
   .catch(()=>setSavedIds([]));
  void loadDashboardResearch().then(setData).catch(()=>setData(null));
  fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'})
   .then(r=>r.ok?r.json():null).then(d=>{
    if(d?.authenticated&&Array.isArray(d.leagues)){
      const linked=d.leagues.filter((l:League)=>typeof l.leagueSlug==='string');
      setLeagues(linked);if(linked.length)setLeagueSlug(linked[0].leagueSlug);
    }
   }).catch(()=>{});

 },[]);
 useEffect(()=>{
  let alive=true;
  setLoading(true);setError('');
  fetch('/api/availability',{cache:'no-store'}).then(async r=>{
   const j=await r.json() as AvailabilityPayload&{error?:string};
   if(!r.ok)throw Error(j.error||'The injury source is unavailable.');
   if(j.source!=='Sleeper'||!Array.isArray(j.players)||!Number.isFinite(Date.parse(j.retrievedAt)))throw Error('Invalid injury source');
   return j;
  }).then(j=>{
   if(!alive)return;
   setPayload(j);setLoading(false);
   // The first visit creates a baseline; it does not invent changes.
   const old=getHistory(),now=Date.now(),age=now-Date.parse(j.retrievedAt);
   if(age>=0&&age<=36*3600_000){
    const next=diffAvailability(old,j.players,now);
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(next));setTracked(true);setRecent(next.events.slice().reverse())}
    catch{setTracked(false);setRecent([])}
   }else {setTracked(false);setRecent([])}
  }).catch(e=>{if(alive){setLoading(false);setError(e instanceof Error?e.message:'Availability feed unavailable')}});
  return()=>{alive=false};
 },[refresh]);

 // No name-only fuzzy matching. Exact, unique team/position/name is accepted
 // only if a direct GSIS identity is absent and the source name matches.
 const researchByPlayer=useMemo(()=>{
  const map=new Map<string,ResearchSnapshot['players'][number]>();
  if(!data||!payload)return map;
  for(const p of data.players){
   const found=matchResearchPlayer(payload.players,p);
   if(found)map.set(keyPlayer(found),p);
  }
  return map;
 },[data,payload]);
 const watchSet=useMemo(()=>{
  const set=new Set(savedIds);
  return new Set([...researchByPlayer.entries()].filter(([,p])=>set.has(p.id)).map(([k])=>k));
 },[researchByPlayer,savedIds]);
 const positions=useMemo(()=>[...new Set(payload?.players.map(p=>p.position)||[])].sort(),[payload]);
 const teams=useMemo(()=>[...TEAM_CODES].sort(),[]);
 const players=useMemo(()=> (payload?.players||[]).filter(p=>{
  if(team&&p.team!==team)return false;
  if(position&&p.position!==position)return false;
  if(query){
   const q=identity(query);
   if(!identity(p.name).includes(q)&&!p.sleeperId.includes(query))return false;
  }
  if(filter==='watched'&&!watchSet.has(keyPlayer(p)))return false;
  if(filter==='game'&&!isGameDesignation(p))return false;
  if(filter==='practice'&&!p.practice)return false;
  return true;
 }),[payload,team,position,query,filter,watchSet]);
 const selectedResearch=selected?researchByPlayer.get(keyPlayer(selected)):null;
 const teammates=useMemo(()=>{
  if(!selected||!data)return [];
  const pool=data.players.filter(p=>p.team===selected.team&&p.pos===selected.position&&
   (!selectedResearch||p.id!==selectedResearch.id));
  return pool.map(p=>{
   const games=(p.w||[]).filter(w=>Number.isFinite(Number(w[2]))&&Number(w[0])>0).sort((a,b)=>Number(b[0])-Number(a[0])).slice(0,3);
   return {player:p,games:games.length,avg:games.length?+(games.reduce((sum,w)=>sum+Number(w[2]),0)/games.length).toFixed(1):null};
  }).sort((a,b)=>(b.avg||0)-(a.avg||0)).slice(0,8);
 },[selected,data,selectedResearch]);
 const fresh=payload?Date.now()-Date.parse(payload.retrievedAt)<=36*3600_000:false;
 async function checkLeague(){
  if(!leagueSlug||leagueLoading||!payload)return;
  setLeagueLoading(true);setLeagueMessage('Checking authorized league rosters…');setLeagueOwners({});
  try{
   const res=await fetch('/api/league-opportunities/'+encodeURIComponent(leagueSlug),{cache:'no-store',credentials:'same-origin'});
   const body=await res.json() as LeagueRosters;
   if(!res.ok)throw Error(body.error||'League roster lookup failed.');
   if(!Array.isArray(body.teams))throw Error('Incomplete league roster snapshot.');
   const owners:Record<string,string>={};
   for(const p of payload.players){
    // Provider Sleeper IDs must be compared to Sleeper rosters directly.
    // Other providers require a confirmed GSIS -> catalog match.
    let id:string|null=body.provider==='sleeper'?p.sleeperId:null;
    if(body.provider!=='sleeper'&&p.gsisId){
     const matches=(body.catalog||[]).filter(c=>c.gsisId===p.gsisId);
     if(matches.length===1)id=matches[0].id;
    }
    if(!id){owners[keyPlayer(p)]='Identity unverified';continue}
    const t=body.teams.find(t=>Array.isArray(t.players)&&t.players.includes(id));
    owners[keyPlayer(p)]=!t?'Not rostered in snapshot':t.rosterId===body.viewerRosterId?'On my roster':'Rostered: '+t.teamName;
   }
   setLeagueOwners(owners);
   setLeagueMessage('Authorized roster snapshot loaded'+
    (res.headers.get('x-leaguezone-data-mode')==='stale'?' (cached roster; verify transactions)':'')+
    '. Not rostered does not guarantee waiver eligibility.');
  }catch(e){setLeagueMessage(e instanceof Error?e.message:'Unable to check league rosters.')}
  finally{setLeagueLoading(false)}
 }

 const stats=[
  {label:'Players with reported metadata',value:payload?.totalReported??'—'},
  {label:'Game-related designations',value:payload?.players.filter(isGameDesignation).length??'—'},
  {label:'Reported practice participation',value:payload?.players.filter(p=>p.practice).length??'—'},
  {label:'My followed players',value:watchSet.size}
 ];
 return <div className="lz-dark-surface min-h-screen bg-[var(--brand-ink)] px-4 pb-24 pt-8 text-white sm:pt-12">
  <div className="mx-auto max-w-7xl">
   <header className="flex flex-wrap items-start justify-between gap-4">
    <div className="max-w-3xl">
     <p className="text-xs font-black uppercase tracking-[.22em] text-[#e2bc71]">LeagueZone / NFL Research</p>
     <h1 className="mt-2 text-3xl font-black uppercase sm:text-4xl">Availability & Opportunity</h1>
     <p className="mt-3 text-sm leading-6 text-white/75">
      Monitor reported player status, research teammates' recent opportunity, and follow updates involving your watched players.
      Metadata is not an official practice report or a confirmed lineup.
     </p>
    </div>
    <button type="button" onClick={()=>setRefresh(x=>x+1)} className="flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-4 text-sm font-semibold hover:border-[#e2bc71]">
     <RefreshCw size={16}/> Recheck source
    </button>
   </header>
   <nav aria-label="Availability page sections" className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-[#e2bc71]">
    <a href="#status" className="underline">Player status</a><a href="#changes" className="underline">Changes observed</a>
    <a href="#context" className="underline">Opportunity context</a>
    <Link href="/weekly" className="underline">NFL Weekly Center</Link>
   </nav>
   <div className="mt-6 rounded-lg border border-[#e2bc71]/30 bg-[#e2bc71]/10 p-4">
    <p className="text-sm text-white/85"><strong>Source:</strong> <a href="https://docs.sleeper.com/" target="_blank" rel="noopener noreferrer" className={classes.link}>Sleeper player metadata <ExternalLink size={12} className="inline"/></a>. This free API is documented for non-commercial use.
      {payload?' Retrieved '+safeTime(payload.retrievedAt)+'.':' Loading current report metadata.'}
      {payload&&(!fresh?' This snapshot is more than 36 hours old; it may not represent current availability.':'') }
    </p>
    <p className="mt-2 text-sm text-white/70">
     For authoritative, dated practice reports and final injury designations, see the{' '}
     <a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer" className={classes.link}>official NFL injury reports</a>.
     Missing metadata never means a player is healthy or available. The source does not include a verified timestamp for each individual designation.
    </p>
   </div>
   <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
    {stats.map(s=><div key={s.label} className={classes.panel}>
     <p className="text-2xl font-black tabular-nums">{s.value}</p><p className="mt-1 text-xs text-white/70">{s.label}</p></div>)}
   </div>
   {leagues.length>0&&<section className={classes.panel+' mt-5'}>
    <h2 className="text-base font-black uppercase">My league availability</h2>
    <p className="mt-2 text-sm text-white/70">Check which reported players appear on rosters in a league you belong to. No league data is exposed publicly.</p>
    <div className="mt-3 flex flex-wrap items-end gap-3">
     <label className="min-w-0 flex-1 text-xs font-semibold text-white/75">Connected league
      <select className={classes.input+' mt-2'} value={leagueSlug} onChange={e=>{setLeagueSlug(e.target.value);setLeagueOwners({});setLeagueMessage('')}}>
       {leagues.map(l=><option key={l.leagueId} value={l.leagueSlug}>{l.leagueName}</option>)}
      </select>
     </label>
     <button disabled={!payload||leagueLoading} onClick={()=>void checkLeague()} type="button"
      className="min-h-11 rounded-lg bg-[#e2bc71] px-4 text-sm font-bold text-[#0d1a2c] disabled:opacity-50">
      {leagueLoading?'Checking…':'Check league rosters'}</button>
    </div>
    {leagueMessage&&<p className="mt-3 text-xs text-white/70" role="status">{leagueMessage}</p>}
   </section>}
   <section id="status" className="mt-9 scroll-mt-24">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <h2 className="flex items-center gap-2 text-xl font-black uppercase"><ShieldAlert size={20}/> Player status</h2>
     <p className="text-sm text-white/70" role="status">{loading?'Loading…':error||players.length+' matching reports'}</p>
    </div>
    <div className={classes.panel+' mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'}>
     <label className="block text-xs font-semibold text-white/75">Find player
      <input type="search" value={query} onChange={e=>setQuery(e.target.value)} className={classes.input+' mt-2'} placeholder="Player name"/></label>
     <label className="block text-xs font-semibold text-white/75">NFL team
      <select value={team} onChange={e=>setTeam(e.target.value)} className={classes.input+' mt-2'}>
       <option value="">All teams</option>{teams.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
     <label className="block text-xs font-semibold text-white/75">Position
      <select value={position} onChange={e=>setPosition(e.target.value)} className={classes.input+' mt-2'}>
       <option value="">All positions</option>{positions.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
     <label className="block text-xs font-semibold text-white/75">Report type
      <select value={filter} onChange={e=>setFilter(e.target.value as Filter)} className={classes.input+' mt-2'}>
       <option value="reported">All reported statuses</option><option value="game">Game-related designations</option>
       <option value="practice">Practice participation</option><option value="watched">My watched players</option>
      </select></label>
    </div>
    {loading&&<p className="mt-5 text-sm text-white/70">Checking the cached provider metadata…</p>}
    {error&&<div className={classes.panel+' mt-4'} role="alert">
     <p className="text-sm text-amber-200">{error}</p><a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer" className={classes.link+' mt-2 inline-block text-sm'}>View official injury reports</a>
    </div>}
    {!loading&&!error&&!players.length&&<p className={classes.panel+' mt-4 text-sm text-white/70'}>
     No matching status metadata was returned. This does not confirm players are healthy. Try another filter or consult official injury reports.
    </p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
     {players.slice(0,120).map(p=>{
      const watched=watchSet.has(keyPlayer(p)),research=researchByPlayer.get(keyPlayer(p)),active=keyPlayer(selected||p)===keyPlayer(p)&&Boolean(selected);
      return <article key={p.sleeperId} className={classes.panel+' min-w-0'}>
       <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="truncate font-bold">{p.name}</p><p className="mt-1 text-xs text-white/70">{p.team} · {p.position}{watched?' · Watched':''}</p></div>
        {watched&&<Bookmark size={17} className="shrink-0 text-[#e2bc71]"/>}
       </div>
       <p className="mt-3 text-sm font-semibold text-[#f2d79c]">{labelStatus(p)}</p>
       <p className="mt-1 text-xs text-white/70">Practice: {p.practiceText||'Not provided'}{p.injuryStart?' · Injury start: '+p.injuryStart:''}</p>
       {leagueOwners[keyPlayer(p)]&&<p className="mt-2 text-xs font-semibold text-[#f2d79c]">{leagueOwners[keyPlayer(p)]}</p>}
       <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={()=>setSelected(active?null:p)}
         aria-expanded={active} className={classes.link+' text-sm'}>{active?'Close':'Opportunity context'} <ArrowRight size={13} className="inline"/></button>
        {research&&<Link href={'/research/players/'+encodeURIComponent(research.id)} className={classes.link+' text-sm'}>Player profile</Link>}
       </div>
      </article>;
     })}
    </div>
    {players.length>120&&<p className="mt-3 text-sm text-white/70">Showing 120 of {players.length} matches. Narrow your filters to find a player.</p>}
   </section>
   <section id="context" className="mt-10 scroll-mt-24">
    <h2 className="flex items-center gap-2 text-xl font-black uppercase"><Users size={20}/> Opportunity context</h2>
    {!selected&&<p className={classes.panel+' mt-4 text-sm text-white/75'}>
     Select Opportunity context on a player card to explore same-position teammates.
     This is historical research, not a projected starter or guaranteed replacement.
    </p>}
    {selected&&<div className={classes.panel+' mt-4'}>
     <h3 className="text-lg font-bold">{selected.name} · {selected.team} {selected.position}</h3>
     <p className="mt-1 text-sm text-white/70">Current reported metadata: {labelStatus(selected)}. LeagueZone cannot determine whether a teammate will start from this designation alone.</p>
     <div className="mt-4 flex flex-wrap gap-4 text-sm">
      <Link href={'/research/radar'} className={classes.link}>Opportunity Radar</Link>
      <Link href={'/weekly'} className={classes.link}>Week and opponent context</Link>
      <a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer" className={classes.link}>Official report</a>
     </div>
     {!data&&<p className="mt-4 text-sm text-white/70">Historical player research is unavailable. Links above still work.</p>}
     {data&&<><p className="mt-5 text-xs text-white/70">Same-team {selected.position} options · LeagueZone {data.year} stats through Week {data.throughWeek}
      {data.source==='backup'?' · Backup dataset':''}. Ranked by PPR points in last three recorded games. No starting assignments inferred.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
       {teammates.map(t=><Link key={t.player.id} href={'/research/players/'+encodeURIComponent(t.player.id)}
        className="rounded-lg border border-white/20 p-3 hover:border-[#e2bc71]">
        <p className="truncate font-semibold">{t.player.n}</p>
        <p className="mt-1 text-xs text-white/70">{t.games} recorded games · {t.avg===null?'No recent data':t.avg+' PPR FP/G'}</p>
       </Link>)}
      </div>
      {!teammates.length&&<p className="mt-3 text-sm text-white/70">No comparable teammates in the current published research snapshot.</p>}
     </>}
    </div>}
   </section>
   <section id="changes" className="mt-10 scroll-mt-24">
    <h2 className="flex items-center gap-2 text-xl font-black uppercase"><CalendarClock size={20}/> Observed status changes</h2>
    <p className="mt-2 text-sm text-white/75">Changes detected between visits to this device, not the official day-by-day NFL practice history.
     First visit establishes a baseline. A changed source field is not proof that the player's medical condition changed at that moment.</p>
    {!tracked&&<p className={classes.panel+' mt-3 text-sm text-white/70'}>
     A fresh, locally stored baseline could not be established. Historical updates are unavailable.</p>}
    {tracked&&!recent.length&&<p className={classes.panel+' mt-3 text-sm text-white/70'}>
     No changes observed since this browser began tracking. Return after the source refreshes to compare reports.</p>}
    <div className="mt-3 grid gap-2">{recent.slice(0,24).map((event,i)=><div key={event.key+event.seenAt+i}
     className="rounded-lg border border-white/15 p-4">
     <p className="text-sm font-semibold">{event.key.split('|')[0]} · {event.key.split('|')[1]} · {event.key.split('|')[2]}</p>
     <p className="mt-1 text-xs text-white/70">{event.previous||'Not reported'} → {event.current||'Not reported'}</p>
     <p className="mt-1 text-xs text-white/65">Observed on this device: {safeTime(new Date(event.seenAt).toISOString())}</p>
    </div>)}</div>
    <p className="mt-4 text-xs text-white/65">Notifications are not yet sent for injury changes because this provider's metadata does not establish official report times or guaranteed freshness. Existing research notifications are unaffected.</p>
   </section>
   <footer className="mt-10 border-t border-white/15 pt-4 text-xs text-white/65">
    Data from Sleeper's non-commercial API; no licensed complete practice-report feed, injury diagnosis, or Sunday inactive guarantee. External reporting and fantasy interpretation are distinct.
   </footer>
  </div>
 </div>;
}
