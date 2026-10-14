'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useRef} from 'react';
import {RESEARCH_DESTINATIONS,researchSectionKey} from '@/lib/navigation/research';

/** The same cross-tool navigation used by the static /research shell.
 * No account or database data is needed. */
export default function ResearchSectionNav(){
 const pathname=usePathname()||'/';
 const selected=researchSectionKey(pathname);
 const scroller=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  if(!selected||!scroller.current)return;
  const active=scroller.current.querySelector<HTMLElement>('[aria-current="page"]');
  if(active){
   const viewport=scroller.current;
   const target=active.offsetLeft-viewport.offsetLeft+active.offsetWidth/2-viewport.clientWidth/2;
   viewport.scrollTo({left:Math.max(0,target),behavior:'instant'});
  }
 },[selected]);
 if(!selected)return null;
 return <div data-research-section-nav className="relative z-30 w-full border-b border-white/15 bg-[#0d1a2c] text-white">
  <div className="mx-auto flex max-w-7xl min-w-0 items-center gap-3 px-4 sm:px-6">
   <span className="hidden shrink-0 border-r border-white/15 pr-4 text-[10px] font-black uppercase tracking-[.18em] text-[#e2bc71] lg:block">Research</span>
   <nav ref={scroller} aria-label="Research tools" className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain py-2.5 [scrollbar-width:thin] [scrollbar-color:#45566b_transparent]">
    {RESEARCH_DESTINATIONS.map(item=><Link key={item.key} href={item.href}
     aria-current={selected===item.key?'page':undefined}
     className={'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e2bc71] '+
      (selected===item.key?'bg-[#e2bc71]/15 text-[#f2d79c] ring-1 ring-[#e2bc71]/50':'text-[#c4d0df] hover:bg-white/10 hover:text-white')}>
     {item.label}</Link>)}
   </nav>
  </div>
 </div>;
}
