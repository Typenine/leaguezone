import Link from 'next/link';
import {Search,Bookmark,Bell,Users,Settings,Smartphone} from 'lucide-react';
export const metadata={title:'Your LeagueZone | LeagueZone',robots:{index:false}};
const tools=[
 {href:'/search',label:'Search players and leagues',detail:'Find research profiles and your leagues.',Icon:Search},
 {href:'/saved',label:'Saved research',detail:'Revisit saved player profiles and research views.',Icon:Bookmark},
 {href:'/notifications',label:'Notifications',detail:'Control research push alerts on this device.',Icon:Bell},
 {href:'/app',label:'My leagues',detail:'Open the leagues connected to your account.',Icon:Users},
 {href:'/settings',label:'Account settings',detail:'Manage your LeagueZone profile.',Icon:Settings},
 {href:'/install',label:'Install the app',detail:'Set up LeagueZone on your phone or computer.',Icon:Smartphone},
] as const;
export default function Page(){
 return <main className="container mx-auto max-w-4xl px-4 py-10">
  <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-gold)]">Your LeagueZone</p>
  <h1 className="mt-2 text-4xl font-black">Profile & Tools</h1>
  <div className="mt-8 grid gap-3 sm:grid-cols-2">{tools.map(({href,label,detail,Icon})=><Link key={href} href={href}
   className="flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--brand-gold)]">
   <Icon aria-hidden="true" size={22} className="shrink-0 text-[var(--brand-gold)]"/>
   <div><h2 className="text-base font-bold">{label}</h2><p className="mt-2 text-sm text-[var(--muted)]">{detail}</p></div>
  </Link>)}</div>
 </main>;
}
