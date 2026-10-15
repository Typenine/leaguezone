'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {loadSavedSleeperTeams,preferredSleeperTeam,preferSleeperTeam,readRememberedLeague,
 rememberLeague,type SavedSleeperTeam} from '@/lib/fantasy/remembered-league';
import {publicToolUrl} from '@/lib/fantasy/public-tools';
type Selection={leagueId:string;rosterId:number|null;leagueName:string;teamName:string};
export default function ConnectedLeagueCard({homepage=false}:{homepage?:boolean}){
 const [connections,setConnections]=useState<SavedSleeperTeam[]>([]);
 const [selected,setSelected]=useState<Selection|null>(null);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [account,setAccount]=useState(false);
 useEffect(()=>{
  let active=true;const saved=readRememberedLeague();
  void loadSavedSleeperTeams().then(({connected,signedIn})=>{
   if(!active)return;
   setConnections(connected);setAccount(signedIn);
   const current=signedIn?preferredSleeperTeam(connected):null;
   if(current){setSelected(current);rememberLeague(current.leagueId,current.rosterId);}
   else if(!signedIn&&saved)setSelected({...saved,leagueName:'Last used Sleeper league',teamName:saved.rosterId?'Roster '+saved.rosterId:'Choose a team'});
   setStatus('ready');
  }).catch(()=>{
   if(!active)return;
   if(saved)setSelected({...saved,leagueName:'Last used Sleeper league',teamName:saved.rosterId?'Roster '+saved.rosterId:'Choose a team'});
   setStatus('error');
  });
  return ()=>{active=false;};
 },[]);
 function select(id:string){
  const next=connections.find(c=>c.leagueId===id);if(!next)return;
  setSelected(next);rememberLeague(next.leagueId,next.rosterId);
  void preferSleeperTeam(next.leagueId).catch(()=>{});
 }
 const connect=homepage?'/app/connect-sleeper?next=%2F%3Fview%3Dpublic':'/app/connect-sleeper';
 return <section aria-label="Current fantasy league" className="rounded-2xl border border-[var(--brand-gold)]/30 bg-[#102439] p-5 text-white sm:p-6">
  <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0">
   <p className="text-xs font-black uppercase tracking-widest text-[var(--brand-gold)]">Your fantasy workspace</p>
   {status==='loading'?<p role="status" className="mt-3 text-sm">Loading saved league…</p>:
    selected?<><h2 className="mt-2 text-2xl font-black">{selected.leagueName}</h2>
     <p className="mt-1 text-sm text-white/70">{selected.teamName} · Sleeper league {selected.leagueId}</p></>:
    <><h2 className="mt-2 text-2xl font-black">Your league, your decisions</h2>
     <p className="mt-2 text-sm text-white/70">Connect a Sleeper team once. It will be available on your homepage, Hub, and fantasy tools.</p></>}
   </div>
   {selected&&connections.length>1&&<label className="text-xs font-bold">Change league
    <select value={selected.leagueId} onChange={e=>select(e.target.value)}
     className="mt-1 block min-h-11 max-w-full rounded-lg border border-white/25 bg-[#071727] px-3 text-white">
     {connections.map(c=><option key={c.leagueId} value={c.leagueId}>{c.leagueName} · {c.teamName}</option>)}
    </select></label>}
  </div>
  {selected?<div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
   {[{href:account?'/app/fantasy-team?leagueId='+encodeURIComponent(selected.leagueId):publicToolUrl('roster',selected.leagueId,selected.rosterId),label:'My team decisions'},
    {href:publicToolUrl('start-bench',selected.leagueId,selected.rosterId),label:'Start / Bench'},
    {href:publicToolUrl('waivers',selected.leagueId,selected.rosterId),label:'Waiver Finder'},
    {href:publicToolUrl('trade',selected.leagueId,selected.rosterId),label:'Trade Analyzer'}].map(x=>
    <Link key={x.label} href={x.href} className="flex min-h-12 items-center justify-center rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-center text-sm font-bold hover:border-[var(--brand-gold)]">{x.label}</Link>)}
   </div>:<div className="mt-5 flex flex-wrap gap-3">
    <Link href={connect} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--brand-gold)] px-4 text-sm font-black text-[var(--brand-ink)]">Connect Sleeper team</Link>
    <Link href="/fantasy-tools/trade" className="inline-flex min-h-11 items-center rounded-lg border border-white/25 px-4 text-sm font-semibold">Try free Trade Analyzer</Link>
   </div>}
  {selected&&<div className="mt-4 flex gap-4 text-xs font-semibold">
    {account&&<Link href={connect} className="text-[var(--brand-gold)] underline">Manage connections</Link>}
    <Link href="/research" className="text-white/70 underline">Explore public research</Link>
   </div>}
  {status==='error'&&<p className="mt-2 text-xs text-amber-200">Account connections are unavailable. Showing the last-used device selection if saved.</p>}
 </section>;
}
