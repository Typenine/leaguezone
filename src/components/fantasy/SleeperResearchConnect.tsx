'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {parseSleeperLeagueInput} from '@/lib/sleeper-research-shared';

type League={leagueId:string;name:string;season:number;lrosters:number|null};
type Team={rosterId:number;teamName:string};
type Saved={leagueId:string;leagueName:string;teamName:string;season:number;rosterId:number};
async function json(url:string,init?:RequestInit){
 const res=await fetch(url,{credentials:'same-origin',cache:'no-store',...init});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||'Unable to complete request');
 return data;
}
export default function SleeperResearchConnect(){
 const router=useRouter();
 const [username,setUsername]=useState('');
 const [manual,setManual]=useState('');
 const [leagues,setLeagues]=useState<League[]>([]);
 const [userId,setUserId]=useState('');
 const [selected,setSelected]=useState('');
 const [teams,setTeams]=useState<Team[]>([]);
 const [choice,setChoice]=useState('');
 const [saved,setSaved]=useState<Saved[]>([]);
 const [loading,setLoading]=useState('');
 const [error,setError]=useState('');
 const [completed,setCompleted]=useState('');
 useEffect(()=>{
  json('/api/research/sleeper/connections').then(d=>setSaved(d.connections||[])).catch(()=>{});
 },[]);
 async function discover(){
  setLoading('discover');setError('');setLeagues([]);setSelected('');setTeams([]);setChoice('');
  try{
   const d=await json('/api/setup/sleeper/discover?username='+encodeURIComponent(username.trim()));
   setUserId(d.sleeperUserId||'');
   setLeagues(d.leagues||[]);
   if(!d.leagues?.length)setError('No leagues found for this season or last season. A Sleeper league URL may still work.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to find leagues');}
  finally{setLoading('');}
 }
 async function choose(id:string,uid=userId){
  setSelected(id);setTeams([]);setChoice('');setError('');setCompleted('');
  if(!uid){setError('Look up a Sleeper username first.');return;}
  setLoading('preview');
  try{
   const data=await json('/api/research/sleeper/preview?leagueId='+encodeURIComponent(id)+'&sleeperUserId='+encodeURIComponent(uid));
   const list=data.teams||[];
   setTeams(list);
   if(list.length===1)setChoice(String(list[0].rosterId));
   if(!list.length)setError('No roster in this league is associated with that Sleeper username. Try another username.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to load teams');}
  finally{setLoading('');}
 }
 async function save(){
  setError('');setLoading('save');
  try{
   const data=await json('/api/research/sleeper/connections',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({
     leagueId:selected,sleeperUserId:userId,rosterId:Number(choice)})});
   router.push('/app/fantasy-team?leagueId='+encodeURIComponent(data.leagueId));
  }catch(e){setError(e instanceof Error?e.message:'Unable to save connection');}
  finally{setLoading('');}
 }
 async function remove(id:string){
  if(!window.confirm('Disconnect this Sleeper team from your LeagueZone research account?'))return;
  setError('');setLoading('delete');
  try{
   await json('/api/research/sleeper/connections?leagueId='+encodeURIComponent(id),{method:'DELETE'});
   setSaved(current=>current.filter(x=>x.leagueId!==id));
   setCompleted('Research connection removed.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to disconnect');}
  finally{setLoading('');}
 }
 const parsed=parseSleeperLeagueInput(manual);
 return <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-white">
  <header>
   <p className="text-xs font-black uppercase tracking-widest text-[var(--brand-gold)]">Research-only connection</p>
   <h1 className="mt-2 text-3xl font-black uppercase sm:text-4xl">Connect My Fantasy Team</h1>
   <p className="mt-3 text-sm leading-6 text-white/75">Find your Sleeper team and personalize waiver, trade and roster research. You do not need to create a LeagueZone league, be a commissioner, or configure branding.</p>
   <p className="mt-2 text-xs text-white/65">Sleeper exposes read-only league data. Entering a username does not verify that you own that Sleeper account; these connections cannot make transactions or grant league administration access.</p>
  </header>
  {saved.length>0&&<section className="rounded-xl border border-white/20 p-5">
   <h2 className="font-bold">Previously connected teams</h2>
   <div className="mt-3 grid gap-3 sm:grid-cols-2">{saved.map(item=>
    <div key={item.leagueId} className="rounded-lg border border-white/15 p-3">
     <p className="font-bold">{item.leagueName}</p><p className="mt-1 text-sm text-white/70">{item.teamName} · {item.season}</p>
     <div className="mt-3 flex gap-4 text-xs font-bold">
      <Link href={'/app/fantasy-team?leagueId='+encodeURIComponent(item.leagueId)} className="text-[var(--brand-gold)] underline">View decisions</Link>
      <button type="button" disabled={loading!==''} onClick={()=>void remove(item.leagueId)} className="text-white/70 underline">Disconnect</button>
     </div>
    </div>)}</div>
  </section>}
  <section className="rounded-xl border border-white/20 bg-white/[0.035] p-5">
   <h2 className="text-lg font-black">1. Find your Sleeper account</h2>
   <label className="mt-4 block text-sm font-semibold" htmlFor="research-sleeper-username">Sleeper username</label>
   <div className="mt-2 flex flex-col gap-2 sm:flex-row">
    <input id="research-sleeper-username" value={username} onChange={e=>setUsername(e.target.value)}
      placeholder="Your Sleeper username" className="min-h-11 flex-1 rounded-lg border border-white/25 bg-[#15273a] px-3 text-white"/>
    <button type="button" onClick={()=>void discover()} disabled={loading!==''||!username.trim()}
      className="min-h-11 rounded-lg bg-[var(--brand-gold)] px-5 font-bold text-[var(--brand-ink)]">Find leagues</button>
   </div>
   {leagues.length>0&&<div className="mt-5">
    <h3 className="text-sm font-bold">2. Choose your league</h3>
    <div className="mt-3 grid gap-2">{leagues.map(l=><button type="button" key={l.leagueId}
     onClick={()=>void choose(l.leagueId)} disabled={loading!==''}
     aria-pressed={selected===l.leagueId}
     className={'flex items-center justify-between gap-3 rounded-lg border p-3 text-left '+(selected===l.leagueId?'border-[var(--brand-gold)] bg-white/10':'border-white/20 hover:border-white/50')}>
     <span className="font-semibold">{l.name} <span className="text-sm font-normal text-white/65">· {l.season}</span></span>
     <span className="text-xs text-[var(--brand-gold)]">Select →</span>
    </button>)}</div>
   </div>}
   <div className="mt-5 border-t border-white/15 pt-4">
    <label htmlFor="research-league-id" className="text-sm font-semibold">Or paste a Sleeper league link / ID</label>
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
     <input id="research-league-id" value={manual} onChange={e=>setManual(e.target.value)}
      placeholder="https://sleeper.com/leagues/…" className="min-h-11 flex-1 rounded-lg border border-white/25 bg-[#15273a] px-3 text-white"/>
     <button type="button" disabled={!parsed||!userId||loading!==''} onClick={()=>parsed&&void choose(parsed)}
      className="min-h-11 rounded-lg border border-[var(--brand-gold)]/60 px-4 font-bold text-[var(--brand-gold)]">Use this league</button>
    </div>
    <p className="mt-1 text-xs text-white/65">Look up a username first so we can find that account’s roster in the league.</p>
   </div>
  </section>
  {(teams.length>0)&&<section className="rounded-xl border border-white/20 bg-white/[0.035] p-5">
   <h2 className="text-lg font-black">3. Confirm the team to follow</h2>
   <p className="mt-2 text-sm text-white/70">Only rosters associated with the Sleeper username you entered are shown.</p>
   <div className="mt-4 grid gap-2">{teams.map(t=><label key={t.rosterId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/20 p-3">
    <input type="radio" name="research-roster" checked={choice===String(t.rosterId)} onChange={()=>setChoice(String(t.rosterId))}/>
    <span className="font-semibold">{t.teamName}</span></label>)}</div>
   <button type="button" disabled={loading!==''||!choice} onClick={()=>void save()}
    className="mt-5 min-h-11 w-full rounded-lg bg-[var(--brand-gold)] px-5 font-black text-[var(--brand-ink)]">
    {loading==='save'?'Connecting…':'Connect and view my research'}
   </button>
  </section>}
  {loading==='discover'&&<p role="status" className="text-sm text-white/70">Looking up Sleeper leagues…</p>}
  {loading==='preview'&&<p role="status" className="text-sm text-white/70">Checking your team roster…</p>}
  {error&&<p role="alert" className="rounded-lg border border-red-400/50 p-4 text-sm text-red-200">{error}</p>}
  {completed&&<p role="status" className="text-sm text-white/70">{completed}</p>}
  <p className="text-sm text-white/65">Want a branded league site instead? <Link href="/setup?new=1" className="font-semibold text-[var(--brand-gold)] underline">Use commissioner league setup</Link>.</p>
 </div>;
}
