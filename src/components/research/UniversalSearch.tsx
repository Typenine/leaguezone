'use client';
import Link from 'next/link';
import {Bookmark,BookmarkCheck} from 'lucide-react';
import {normalizeSaved,type SavedItem} from '@/lib/saved-research';
import {addSaved,loadSavedLibrary,removeSaved} from '@/lib/saved-research-client';
import {useEffect,useMemo,useState} from 'react';
import {loadPlayerIndex,type IndexPlayer,type PlayerIndex} from '@/lib/research-player-index';
type Player=IndexPlayer;
type League={leagueId:string;leagueSlug:string;leagueName:string;teamName:string};
export default function UniversalSearch(){
 const [query,setQuery]=useState('');
 const [players,setPlayers]=useState<Player[]>([]);
 const [leagues,setLeagues]=useState<League[]>([]);
 const [index,setIndex]=useState<Omit<PlayerIndex,'players'>|null>(null);
 const [indexState,setIndexState]=useState<'idle'|'loading'|'ready'>('idle');
 const year=index?.year??null;
 const [error,setError]=useState('');
 const [saved,setSaved]=useState<SavedItem[]>([]);
 const [savedMode,setSavedMode]=useState<'loading'|'account'|'guest'|'error'>('loading');
 const [busy,setBusy]=useState('');
 const [savedStatus,setSavedStatus]=useState('');
 useEffect(()=>{
  let alive=true;
  fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null)
   .then(d=>{if(alive&&d?.authenticated&&Array.isArray(d.leagues))setLeagues(d.leagues)}).catch(()=>{});
  void loadSavedLibrary().then(library=>{if(alive){setSaved(library.items);setSavedMode(library.signedIn?'account':'guest')}})
   .catch(()=>{if(alive)setSavedMode('error')});
  return ()=>{alive=false};
 },[]);
 const q=query.trim().toLowerCase();
 // The season player list is fetched once, on the first real search.
 useEffect(()=>{
  if(q.length<2||indexState!=='idle')return;
  setIndexState('loading');
  loadPlayerIndex().then(d=>{setPlayers(d.players);setIndex({year:d.year,throughWeek:d.throughWeek,source:d.source});setIndexState('ready')})
   .catch(()=>{setError('The public player index is unavailable.');setIndexState('ready')});
 },[q,indexState]);
 const results=useMemo(()=>q.length<2?[]:players.filter(p=>p.n.toLowerCase().includes(q)||p.team.toLowerCase()===q)
  .sort((a,b)=>Number(b.n.toLowerCase().startsWith(q))-Number(a.n.toLowerCase().startsWith(q))||a.n.localeCompare(b.n)).slice(0,30),[q,players]);
 const matching=useMemo(()=>q.length<2?[]:leagues.filter(l=>l.leagueName.toLowerCase().includes(q)||l.teamName.toLowerCase().includes(q)),[q,leagues]);
 async function togglePlayer(player:Player){
  if(busy||savedMode==='loading'||savedMode==='error')return;
  const item=normalizeSaved({type:'player',title:player.n,href:'/research/players/'+encodeURIComponent(player.id)});
  if(!item)return;
  setBusy(item.key);setSavedStatus('');
  try{
   if(saved.some(x=>x.key===item.key)){
    await removeSaved(item.key,savedMode==='account');
    setSaved(previous=>previous.filter(x=>x.key!==item.key));
    setSavedStatus(player.n+' removed from watchlist.');
   }else{
    const stored=await addSaved(item,savedMode==='account');
    setSaved(previous=>[stored,...previous.filter(x=>x.key!==stored.key)]);
    setSavedStatus(player.n+(savedMode==='account'?' added to your account watchlist.':' saved in this browser. Sign in to sync.'));
   }
  }catch(cause){setSavedStatus(cause instanceof Error?cause.message:'Watchlist update failed.')}
  finally{setBusy('')}
 }
 return <section className="mt-7">
  <label htmlFor="lz-search" className="block text-sm font-semibold">Players and your leagues</label>
  <input id="lz-search" type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search player, team, or league"
   className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)]"/>
  {error&&<p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
  {savedStatus&&<p role="status" className="mt-3 text-sm text-[var(--muted)]">{savedStatus}</p>}
  {savedMode==='error'&&<p role="alert" className="mt-3 text-sm text-red-400">Account watchlist unavailable. Saving is disabled until it can be loaded.</p>}
  {index&&<p className="mt-3 text-xs text-[var(--muted)]">{index.source==='live'?
   `Player directory: ${index.year} season${index.throughWeek?` through Week ${index.throughWeek}`:''} from published LeagueZone research.`:
   `Player directory uses the ${index.year} static research backup. Live research may be more recent.`}</p>}
  {indexState==='loading'&&<p role="status" className="mt-3 text-xs text-[var(--muted)]">Loading player directory…</p>}
  {q.length<2?<p className="mt-7 text-sm text-[var(--muted)]">Enter at least two characters to begin.</p>:<>
   <h2 className="mt-7 text-xl font-bold">Players</h2>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">{results.map(p=><div key={p.id} className="flex items-center gap-2"><Link
    href={'/research/players/'+encodeURIComponent(p.id)+'?season='+year}
    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
     <span className="block font-semibold">{p.n}</span><span className="text-xs text-[var(--muted)]">{p.pos} · {p.team}</span>
    </Link>
    <button type="button" disabled={savedMode==='loading'||savedMode==='error'||Boolean(busy)}
      aria-label={(saved.some(x=>x.key==='player:'+p.id)?'Unfollow ':'Follow ')+p.n}
      aria-pressed={saved.some(x=>x.key==='player:'+p.id)}
      onClick={()=>void togglePlayer(p)}
      className="rounded-lg border border-[var(--border)] p-3 text-[var(--research-link)] disabled:opacity-50">
      {saved.some(x=>x.key==='player:'+p.id)?<BookmarkCheck aria-hidden="true" size={20}/>:<Bookmark aria-hidden="true" size={20}/>}
    </button></div>)}{results.length===0&&<p className="text-sm text-[var(--muted)]">No matching players in the loaded season.</p>}</div>
   <h2 className="mt-8 text-xl font-bold">My Leagues</h2>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">{matching.map(l=><Link key={l.leagueId}
    href={'/l/'+encodeURIComponent(l.leagueSlug)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
    <span className="block font-semibold">{l.leagueName}</span><span className="text-xs text-[var(--muted)]">{l.teamName}</span>
   </Link>)}{matching.length===0&&<p className="text-sm text-[var(--muted)]">No matching leagues connected to this account.</p>}</div>
  </>}
 </section>;
}