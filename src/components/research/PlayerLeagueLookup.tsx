'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
type League={leagueId:string;leagueSlug:string;leagueName:string;teamName:string};
type Catalog={id:string;gsisId:string|null;name:string;position:string;team:string};
type Team={rosterId:number;teamName:string;players:string[]};
type RosterPayload={provider:string;season:string;catalog:Catalog[];teams:Team[];error?:string};
type Status={message:string;owner:Team|null;player:Catalog|null;season:string;provider:string;stale:boolean};
export default function PlayerLeagueLookup({playerId}:{playerId:string}){
 const [leagues,setLeagues]=useState<League[]>([]);
 const [slug,setSlug]=useState('');
 const [loading,setLoading]=useState(false);
 const [signedIn,setSignedIn]=useState(false);
 const [status,setStatus]=useState<Status|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'})
   .then(r=>r.ok?r.json():null).then(data=>{
    if(!alive)return;
    const choices=data?.authenticated&&Array.isArray(data.leagues)?data.leagues:[];
    setSignedIn(Boolean(data?.authenticated));
    setLeagues(choices);
    if(choices.length)setSlug(choices[0].leagueSlug);
   }).catch(()=>{if(alive)setError('Cannot load your leagues.')});
  return ()=>{alive=false};
 },[]);
 async function check(){
  if(!slug)return;
  setStatus(null);setError('');setLoading(true);
  try{
   const response=await fetch('/api/league-opportunities/'+encodeURIComponent(slug),
    {credentials:'same-origin',cache:'no-store'});
   const data=await response.json() as RosterPayload;
   if(!response.ok)throw Error(data.error||'League lookup failed');
   const match=(data.catalog||[]).find(p=>p.gsisId===playerId);
   const owner=match?(data.teams||[]).find(t=>t.players.includes(match.id))||null:null;
   const message=!match?'This provider does not have a verified identity match for this NFL player. Ownership cannot be confirmed.':
    owner?'This player appears on the roster below in the current snapshot.':
    'Not rostered in this snapshot. Confirm waiver eligibility and current transactions.';
   setStatus({message,owner,player:match||null,season:data.season,provider:data.provider,
    stale:response.headers.get('x-leaguezone-data-mode')==='stale'});
  }catch(e){setError(e instanceof Error?e.message:'Unable to verify player ownership.')}
  finally{setLoading(false)}
 }
 return <div className="mt-7 max-w-2xl">
  {!signedIn&&<p className="mb-5 text-sm text-[var(--muted)]">Sign in to check your own league rosters. Public research is available without an account. <Link href="/login" className="underline text-[var(--brand-gold)]">Sign in</Link></p>}
  <label htmlFor="lz-own-league" className="block text-sm font-semibold">Your league</label>
  <select id="lz-own-league" value={slug} onChange={e=>{setSlug(e.target.value);setStatus(null);setError('')}}
   className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3" disabled={!leagues.length}>
   {!leagues.length&&<option value="">No leagues connected</option>}
   {leagues.map(l=><option key={l.leagueId} value={l.leagueSlug}>{l.leagueName}</option>)}
  </select>
  <button disabled={!slug||loading} type="button" onClick={()=>void check()}
   className="mt-4 rounded-lg bg-[var(--brand-gold)] px-5 py-3 text-sm font-bold text-[var(--brand-ink)] disabled:opacity-50">
   {loading?'Checking…':'Check roster ownership'}
  </button>
  {error&&<p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
  {status&&<div role="status" className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
   <p className="font-semibold">{status.player?.name||'Player identity not verified'}</p>
   <p className="mt-2 text-sm text-[var(--muted)]">{status.message}</p>
   {status.owner&&<p className="mt-2 text-base font-bold">{status.owner.teamName}</p>}
   {status.stale&&<p className="mt-2 text-xs text-amber-500">Roster data is a cached snapshot.</p>}
   <p className="mt-2 text-xs text-[var(--muted)]">Provider: {status.provider} · Season: {status.season}</p>
   <Link className="mt-4 inline-block text-sm font-semibold text-[var(--brand-gold)] underline"
    href={'/l/'+encodeURIComponent(slug)+'/opportunities'}>Open Roster Opportunity Finder</Link>
  </div>}
 </div>;
}