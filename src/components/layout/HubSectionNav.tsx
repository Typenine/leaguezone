'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const nav=[
 {href:'/app',label:'Overview'},
 {href:'/app/fantasy-team',label:'My Team'},
 {href:'/fantasy-tools',label:'Tools'},
 {href:'/my-research',label:'My Research'},
 {href:'/saved',label:'Watchlists'},
 {href:'/app/leagues',label:'League Websites'},
 {href:'/app/connect-sleeper',label:'Connections'},
] as const;
export default function HubSectionNav({outsideApp=false}:{outsideApp?:boolean}){
 const pathname=usePathname()||'/app';
 if(outsideApp&&!['/my-research','/saved'].some(p=>pathname===p||pathname.startsWith(p+'/')))return null;
 return <nav aria-label="Hub sections" className="border-b border-white/15 bg-[#0d1a2c] text-white">
  <div className="container mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:thin]">
   {nav.map(item=><Link key={item.href} href={item.href} aria-current={pathname===item.href?'page':undefined}
    className={'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold sm:text-sm '+(
     pathname===item.href?'bg-[var(--brand-gold)]/15 text-[var(--brand-gold)] ring-1 ring-[var(--brand-gold)]/50':'text-white/75 hover:bg-white/10 hover:text-white'
    )}>{item.label}</Link>)}
  </div>
 </nav>;
}
