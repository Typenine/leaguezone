'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {readSaved,writeSaved,safeHref,type SavedItem} from '@/lib/saved-research';
export default function SavedResearch(){
 const [items,setItems]=useState<SavedItem[]>([]);
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  const sync=()=>{setItems(readSaved());setReady(true)};
  sync();window.addEventListener('storage',sync);
  window.addEventListener('leaguezone:saved-changed',sync);
  return()=>{window.removeEventListener('storage',sync);window.removeEventListener('leaguezone:saved-changed',sync)};
 },[]);
 const remove=(key:string)=>{if(writeSaved(items.filter(x=>x.key!==key)))setItems(readSaved())};
 return <section className="mt-7">
  {!ready&&<p role="status">Loading your saved items…</p>}
  {ready&&items.length===0&&<div className="rounded-xl border border-[var(--border)] p-6">
   <h2 className="text-lg font-bold">No saved research yet</h2>
   <p className="mt-2 text-sm text-[var(--muted)]">On a research page, choose Save this research view to bookmark a player or filter selection.</p>
   <Link href="/research/players" className="mt-4 inline-block text-[var(--brand-gold)] underline">Browse players</Link>
  </div>}
  <div className="grid gap-3 sm:grid-cols-2">{items.map(item=><article key={item.key}
    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-4">
   <div className="min-w-0"><span className="text-xs text-[var(--muted)]">{item.type==='player'?'Player':'Research view'}</span>
    <Link href={safeHref(item.href)||'/research'} className="block break-words font-semibold underline">{item.title}</Link>
    <span className="text-xs text-[var(--muted)]">Saved {new Date(item.savedAt).toLocaleDateString()}</span></div>
   <button type="button" onClick={()=>remove(item.key)} className="rounded border border-[var(--border)] px-3 py-2 text-xs" aria-label={'Remove '+item.title}>Remove</button>
  </article>)}</div>
  {ready&&<p className="mt-4 text-xs text-[var(--muted)]">Bookmarks are stored on this device, not synchronized between browsers.</p>}
 </section>
}