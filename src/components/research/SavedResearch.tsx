'use client';

import Link from 'next/link';
import {useCallback,useEffect,useState} from 'react';
import {readSaved,type SavedItem} from '@/lib/saved-research';
import {loadSavedLibrary,removeSaved} from '@/lib/saved-research-client';

type Mode='loading'|'account'|'guest'|'error';

export default function SavedResearch(){
  const [items,setItems]=useState<SavedItem[]>([]);
  const [mode,setMode]=useState<Mode>('loading');
  const [filter,setFilter]=useState<'all'|'player'|'view'>('all');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState<string|null>(null);

  const refresh=useCallback(async()=>{
    setMode('loading');setItems([]);setError('');
    try{
      const library=await loadSavedLibrary();
      setItems(library.items);
      setMode(library.signedIn?'account':'guest');
    }catch(cause){
      setMode('error');
      setError(cause instanceof Error?cause.message:'Saved research unavailable.');
    }
  },[]);

  useEffect(()=>{void refresh()},[refresh]);
  useEffect(()=>{
    if(mode!=='guest')return;
    const sync=()=>setItems(readSaved());
    window.addEventListener('storage',sync);
    return ()=>window.removeEventListener('storage',sync);
  },[mode]);

  const remove=async(item:SavedItem)=>{
    if(busy)return;
    setBusy(item.key);setError('');
    try{
      await removeSaved(item.key,mode==='account');
      setItems(previous=>previous.filter(x=>x.key!==item.key));
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Could not remove the bookmark.');
    }finally{setBusy(null)}
  };

  const visible=items.filter(item=>filter==='all'||item.type===filter);
  return <section className="mt-7">
    {mode==='loading'&&<p role="status" className="text-sm text-[var(--muted)]">Loading saved research…</p>}
    {error&&<div role="alert" className="mb-4 rounded-lg border border-red-500/40 p-4 text-sm text-red-400">
      {error} <button type="button" className="ml-2 underline" onClick={()=>void refresh()}>Retry</button>
    </div>}
    {mode==='guest'&&<p className="mb-5 text-sm text-[var(--muted)]">
      These bookmarks are saved only in this browser. <Link href="/login" className="font-semibold text-[var(--brand-gold)] underline">Sign in</Link> to sync them with your account and other devices.
    </p>}
    {mode==='account'&&<div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[var(--muted)]">Saved to your LeagueZone account and available across devices.</p>
      <button type="button" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" onClick={()=>void refresh()}>Refresh</button>
    </div>}
    {mode!=='loading'&&mode!=='error'&&items.length===0&&<div className="rounded-xl border border-[var(--border)] p-6">
      <h2 className="text-lg font-bold">No saved research yet</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Follow a player or save a research view to find it here.</p>
      <Link href="/research/players" className="mt-4 inline-block text-[var(--brand-gold)] underline">Browse players</Link>
    </div>}
    {items.length>0&&<>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Saved research categories">
        {([
          {id:'all',label:'All'},
          {id:'player',label:'Player watchlist'},
          {id:'view',label:'Research views'},
        ] as const).map(choice=><button key={choice.id} type="button" onClick={()=>setFilter(choice.id)}
          aria-pressed={filter===choice.id}
          className={`rounded-lg border px-3 py-2 text-sm ${filter===choice.id?'border-[var(--brand-gold)] text-[var(--brand-gold)]':'border-[var(--border)] text-[var(--muted)]'}`}>{choice.label}</button>)}
      </div>
      {visible.length===0&&<p className="text-sm text-[var(--muted)]">Nothing saved in this category.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map(item=><article key={item.key}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="min-w-0">
            <span className="text-xs text-[var(--muted)]">{item.type==='player'?'Followed player':'Research view'}</span>
            <Link href={item.href} className="block break-words font-semibold underline underline-offset-4">{item.title}</Link>
            <span className="text-xs text-[var(--muted)]">Saved {new Date(item.savedAt).toLocaleDateString()}</span>
          </div>
          <button type="button" disabled={Boolean(busy)} onClick={()=>void remove(item)}
            className="rounded border border-[var(--border)] px-3 py-2 text-xs disabled:opacity-50"
            aria-label={'Remove '+item.title}>{busy===item.key?'Removing…':'Remove'}</button>
        </article>)}
      </div>
    </>}
  </section>;
}
