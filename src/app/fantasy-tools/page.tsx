import Link from 'next/link';
import {FANTASY_TOOLS,publicToolUrl} from '@/lib/fantasy/public-tools';
export const metadata={title:'Free Fantasy Football Tools | LeagueZone',description:'Use LeagueZone’s start/bench, waiver, trade, rankings, taxi and draft tools without an account.'};
export default function FantasyToolsPage(){
 return <main className="lz-dark-surface min-h-screen bg-[var(--brand-ink)] text-white">
  <section className="border-b border-white/15 bg-[#0d2034]">
   <div className="container mx-auto max-w-7xl px-4 py-12 sm:py-16">
    <p className="text-xs font-black uppercase tracking-wider text-[var(--brand-gold)]">Free tools · No sign-in required</p>
    <h1 className="mt-3 text-4xl font-black sm:text-5xl">Fantasy tools that help you decide</h1>
    <p className="mt-4 max-w-3xl text-base leading-7 text-white/75">Start or bench? Add or drop? Make a trade? Explore the tools immediately. Enter a Sleeper league ID and select a team only when you want recommendations tailored to that roster.</p>
    <div className="mt-6 flex flex-wrap gap-3">
     <Link href="/fantasy-tools/start-bench" className="inline-flex min-h-12 items-center rounded-lg bg-[var(--brand-gold)] px-5 font-black text-[var(--brand-ink)]">Try Start / Bench →</Link>
     <Link href="/research/decisions" className="inline-flex min-h-12 items-center rounded-lg border border-white/30 px-5 font-bold text-white">Explore public insights</Link>
    </div>
   </div>
  </section>
  <section className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{FANTASY_TOOLS.map((tool,i)=>
    <Link key={tool.key} href={publicToolUrl(tool.key)}
     className="group flex min-h-48 flex-col rounded-2xl border border-white/15 bg-white/[0.045] p-5 transition hover:border-[var(--brand-gold)]/70 hover:bg-white/[0.075] focus-visible:outline-2 focus-visible:outline-[var(--brand-gold)]">
     <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand-gold)]">{tool.group}</p>
     <h2 className="mt-3 text-lg font-black">{tool.label}</h2>
     <p className="mt-2 flex-1 text-sm leading-6 text-white/70">{tool.description}</p>
     <span className="mt-5 text-sm font-bold text-[var(--brand-gold)]">Open tool →</span>
    </Link>)}</div>
   <p className="mt-8 text-sm text-white/60">League personalization currently uses publicly accessible Sleeper NFL league data. No commissioner permission or account connection is required. Tools are read-only, and an anonymous visitor cannot access private saved boards or account history.</p>
  </section>
 </main>;
}
