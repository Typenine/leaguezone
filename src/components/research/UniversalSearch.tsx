'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
type Player={id:string;n:string;pos:string;team:string};
type League={leagueId:string;leagueSlug:string;leagueName:string;teamName:string};
export default function UniversalSearch(){
 const [query,setQuery]=useState('');
 const [players,setPlayers]=useState<Player[]>([]);
 const [leagues,setLeagues]=useState<League[]>([]);
 const [year,setYear]=useState<number|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  fetch('/research/data/seasons.json').then(r=>r.json()).then((c:{years:number[]})=>{
   const latest=Math.max(...c.years.filter(Number.isInteger));
   if(!Number.isFinite(latest))throw Error('No seasons available');
   return fetch('/research/data/'+latest+'.json').then(r=>{if(!r.ok)throw Error('Research unavailable');return r.json()});
  }).then(d=>{if(alive&&Array.isArray(d.players)){setPlayers(d.players);setYear(d.year)}})
   .catch(()=>{if(alive)setError('The public player index is unavailable.')});
  fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null)
   .then(d=>{if(alive&&d?.authenticated&&Array.isArray(d.leagues))setLeagues(d.leagues)}).catch(()=>{});
  return ()=>{alive=false};
 },[]);
 const q=query.trim().toLowerCase();
 const results=useMemo(()=>q.length<2?[]:players.filter(p=>p.n.toLowerCase().includes(q)||p.team.toLowerCase()===q)
  .sort((a,b)=>Number(b.n.toLowerCase().startsWith(q))-Number(a.n.toLowerCase().startsWith(q))||a.n.localeCompare(b.n)).slice(0,30),[q,players]);
 const matching=useMemo(()=>q.length<2?[]:leagues.filter(l=>l.leagueName.toLowerCase().includes(q)||l.teamName.toLowerCase().includes(q)),[q,leagues]);
 return <section className="mt-7">
  <label htmlFor="lz-search" className="block text-sm font-semibold">Players and your leagues</label>
  <input id="lz-search" type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search player, team, or league"
   className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)]"/>
  {error&&<p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
  {year&&<p className="mt-3 text-xs text-[var(--muted)]">Player directory uses the {year} static research backup. Live research may be more recent.</p>}
  {q.length<2?<p className="mt-7 text-sm text-[var(--muted)]">Enter at least two characters to begin.</p>:<>
   <h2 className="mt-7 text-xl font-bold">Players</h2>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">{results.map(p=><Link key={p.id}
    href={'/research/players/'+encodeURIComponent(p.id)+'?season='+year}
    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
     <span className="block font-semibold">{p.n}</span><span className="text-xs text-[var(--muted)]">{p.pos} · {p.team}</span>
    </Link>)}{results.length===0&&<p className="text-sm text-[var(--muted)]">No matching players in the loaded season.</p>}</div>
   <h2 className="mt-8 text-xl font-bold">My Leagues</h2>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">{matching.map(l=><Link key={l.leagueId}
    href={'/l/'+encodeURIComponent(l.leagueSlug)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
    <span className="block font-semibold">{l.leagueName}</span><span className="text-xs text-[var(--muted)]">{l.teamName}</span>
   </Link>)}{matching.length===0&&<p className="text-sm text-[var(--muted)]">No matching leagues connected to this account.</p>}</div>
  </>}
 </section>;
}