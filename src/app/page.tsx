import { cookies } from 'next/headers';
import Link from 'next/link';
import { verifySession } from '@/lib/server/auth';
import { PLATFORM, PRODUCT_FEATURES } from '@/lib/config/platform';

export const dynamic = 'force-dynamic';

const RESEARCH_TOOLS = [
  {
    number: '01',
    label: 'Player Statistics',
    title: 'Find the players behind the numbers.',
    description: 'Compare fantasy production, usage, scoring formats, weekly game logs, and league-wide stat leaders.',
    href: '/research/stats',
    action: 'Explore stats',
  },
  {
    number: '02',
    label: 'Opportunity Radar',
    title: 'See roles change before the box score tells you.',
    description: 'Separate targets, touches, and passing opportunity from fantasy production to spot changing roles.',
    href: '/research/radar',
    action: 'Open Radar',
  },
  {
    number: '03',
    label: 'Prediction Receipts',
    title: 'Measure the signals, not the hype.',
    description: 'Review historical signals alongside subsequent results and inspect the developing forward record.',
    href: '/research/receipts',
    action: 'Check receipts',
  },
  {
    number: '04',
    label: 'Development Lab',
    title: 'Study how players grow over time.',
    description: 'Follow season-by-season careers and compare players at similar stages of development.',
    href: '/research/development',
    action: 'Explore development',
  },
] as const;

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="pointer-events-none absolute -inset-5 rounded-full bg-[var(--brand-blue)]/15 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#081525] p-4 shadow-2xl shadow-black/40 sm:p-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-gold)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">LeagueZone</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Your football hub</span>
        </div>
        <div className="grid gap-3 pt-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/[0.07] p-5">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--brand-gold)]">01 / Research</span>
            <h3 className="mt-4 text-xl font-black uppercase tracking-tight text-white">Understand the players.</h3>
            <p className="mt-3 text-sm leading-6 text-white/60">Production, opportunity, history and development.</p>
            <div className="mt-5 space-y-2" aria-label="Research topics">
              {['Player comparisons', 'Usage trends', 'Season trajectories'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-md border border-white/10 bg-[#091a2d] px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-gold)]" />
                  <span className="text-xs font-semibold text-white/80">{item}</span>
                </div>
              ))}
            </div>
            <Link href="/research" className="mt-5 inline-flex text-xs font-black uppercase tracking-wider text-[var(--brand-gold)] hover:underline">
              Open Research <span aria-hidden="true" className="ml-1">↗</span>
            </Link>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/[0.035] p-5">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">02 / Leagues</span>
            <h3 className="mt-4 text-xl font-black uppercase tracking-tight text-white">Build your league&apos;s home.</h3>
            <p className="mt-3 text-sm leading-6 text-white/60">Teams, drafts, trades, records and league identity.</p>
            <div className="mt-5 space-y-2" aria-label="League website features">
              {['Team & league pages', 'Draft & trade tools', 'History & records'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-md border border-white/10 bg-[#091a2d] px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  <span className="text-xs font-semibold text-white/80">{item}</span>
                </div>
              ))}
            </div>
            <Link href="/demo" className="mt-5 inline-flex text-xs font-black uppercase tracking-wider text-sky-300 hover:underline">
              See a League <span aria-hidden="true" className="ml-1">↗</span>
            </Link>
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] text-white/35">Two connected parts of one fantasy football platform.</p>
      </div>
    </div>
  );
}

export default async function RootPage() {
  const cookieJar = await cookies();
  const sessionToken = cookieJar.get('evw_session')?.value || '';
  const claims = sessionToken ? verifySession(sessionToken) : null;
  const signedIn = claims?.type === 'user' && typeof claims.sub === 'string';

  return (
    <div className="overflow-hidden bg-[var(--brand-ink)] text-white">
      <section className="relative isolate border-b border-white/10" style={{ background: 'radial-gradient(ellipse at 78% 30%, rgba(28, 87, 127, .28), transparent 46%), linear-gradient(155deg, var(--brand-navy), var(--brand-ink) 78%)' }}>
        <div className="container mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 lg:py-28">
          <div className="max-w-2xl">
            <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--brand-gold)]">
              <span className="h-px w-7 bg-[var(--brand-gold)]" />
              The home for fantasy football
            </p>
            <h1 className="mt-6 text-5xl font-black uppercase leading-[0.99] tracking-tighter sm:text-6xl xl:text-7xl">
              Research the game.<br />
              <span className="text-[var(--brand-gold)]">Run your league.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/65 sm:text-lg">
              {PLATFORM.name} brings fantasy football research and league management together. Understand players, explore the trends, and give your league a home that lasts beyond a single season.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/research" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--brand-gold)] px-6 py-3 text-sm font-black uppercase tracking-wider text-[var(--brand-ink)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Explore Player Research <span className="ml-2" aria-hidden="true">↗</span>
              </Link>
              <Link href="/features" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/30 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:border-white/70 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Explore League Tools
              </Link>
            </div>
            <p className="mt-5 text-xs font-semibold tracking-wide text-white/45">
              Public player research. League websites. One destination.
            </p>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section id="explore" aria-labelledby="explore-title" className="container mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">Pick your starting point</p>
        <h2 id="explore-title" className="mt-3 max-w-3xl text-3xl font-black uppercase tracking-tight sm:text-5xl">Everything you need, wherever you play.</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/55">
          You do not need to run a LeagueZone league to use its research. And you do not need to leave your existing fantasy provider to build a better league experience.
        </p>
        <div className="mt-9 grid gap-4 md:grid-cols-2">
          <Link href="/research" className="group relative flex min-h-72 flex-col justify-between overflow-hidden rounded-xl border border-[var(--brand-gold)]/35 p-6 transition hover:border-[var(--brand-gold)] sm:p-8" style={{ background: 'linear-gradient(135deg, #153653, #0a1b30 78%)' }}>
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.23em] text-[var(--brand-gold)]">Fantasy Research</span>
              <h3 className="mt-5 text-3xl font-black uppercase tracking-tight sm:text-4xl">Know more.<br />Guess less.</h3>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/65">Player profiles, sortable stats, advanced usage, opportunity signals and career development.</p>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--brand-gold)] group-hover:underline">Explore Research <span aria-hidden="true">↗</span></span>
          </Link>
          <Link href="/features" className="group relative flex min-h-72 flex-col justify-between overflow-hidden rounded-xl border border-white/15 p-6 transition hover:border-white/40 sm:p-8" style={{ background: 'linear-gradient(135deg, #16283a, #09121f 78%)' }}>
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.23em] text-sky-300">League Management</span>
              <h3 className="mt-5 text-3xl font-black uppercase tracking-tight sm:text-4xl">More than<br />a scoreboard.</h3>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/65">A branded league website with team pages, draft tools, trade history, records and commissioner features.</p>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-sky-300 group-hover:underline">Explore League Websites <span aria-hidden="true">↗</span></span>
          </Link>
        </div>
      </section>

      <section id="research" aria-labelledby="research-title" className="border-y border-white/10 bg-[#091728]">
        <div className="container mx-auto max-w-7xl px-4 py-16 sm:py-20">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">Fantasy Research</p>
              <h2 id="research-title" className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-5xl">Go beyond the box score.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">Explore the underlying opportunity, not just last week&apos;s fantasy points. Start with open player data and dig deeper from there.</p>
            </div>
            <Link href="/research/players" className="inline-flex shrink-0 items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--brand-gold)] hover:underline">
              Browse Players <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {RESEARCH_TOOLS.map((tool) => (
              <Link key={tool.href} href={tool.href} className="group flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-[var(--brand-gold)]/50 hover:bg-white/[0.065] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-gold)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[var(--brand-gold)]">{tool.label}</span>
                  <span className="text-xs font-black text-white/20">{tool.number}</span>
                </div>
                <h3 className="mt-6 text-xl font-black uppercase leading-tight tracking-tight text-white">{tool.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-white/55">{tool.description}</p>
                <span className="mt-6 text-xs font-black uppercase tracking-wider text-[var(--brand-gold)] group-hover:underline">{tool.action} <span aria-hidden="true">↗</span></span>
              </Link>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h3 className="font-black uppercase tracking-wide">Roster Opportunity Finder</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">The next step is bringing player research into your own league to explore who is rostered and which moves might be realistic. League-connected tools are still being refined.</p>
            </div>
            <Link href={signedIn ? '/app' : '/login?next=%2Fapp'} className="inline-flex shrink-0 items-center justify-center rounded-md border border-white/25 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10">
              {signedIn ? 'My Leagues' : 'Sign In to My Leagues'} <span aria-hidden="true" className="ml-2">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section id="leagues" aria-labelledby="leagues-title" className="container mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <div className="grid gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-sky-300">League Management</p>
            <h2 id="leagues-title" className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-5xl">Your league deserves its own home.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/60">Scores and rosters are only part of the story. Keep your league&apos;s identity, decisions, draft nights and history in one place alongside your fantasy provider.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--brand-gold)] px-6 py-3 text-sm font-black uppercase tracking-wider text-[var(--brand-ink)] transition hover:brightness-110">Tour the Demo League</Link>
              <Link href={signedIn ? '/app' : '/register'} className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/25 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-white/10">{signedIn ? 'My Leagues' : 'Create a League Site'}</Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRODUCT_FEATURES.slice(0, 6).map((feature) => (
              <div key={feature.title} className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">{feature.eyebrow}</span>
                <h3 className="mt-3 font-black uppercase tracking-wide text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="connection-title" className="border-y border-white/10" style={{ background: 'linear-gradient(145deg, var(--brand-navy), #08121f)' }}>
        <div className="container mx-auto grid max-w-7xl gap-9 px-4 py-14 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">One Platform</p>
            <h2 id="connection-title" className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-5xl">From insight to league decisions.</h2>
            <p className="mt-4 text-base leading-7 text-white/60">The long-term goal is simple: less jumping between sites to understand players, evaluate your options, and run your league. Research and league tools are being developed together.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { step: '01', title: 'Research', detail: 'Explore real player production and opportunity.' },
              { step: '02', title: 'Evaluate', detail: 'Compare roles, trends and career progression.' },
              { step: '03', title: 'Act', detail: 'Bring that context to your fantasy league.' },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
                <span className="text-2xl font-black text-[var(--brand-gold)]">{item.step}</span>
                <h3 className="mt-4 text-lg font-black uppercase text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <div className="rounded-2xl border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/[0.06] px-6 py-10 text-center sm:px-10 sm:py-14">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--brand-gold)]">The next chapter of fantasy football</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black uppercase tracking-tight sm:text-4xl">Start with a player. Or start with your league.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/60">LeagueZone is building a single destination for the research you use and the leagues you care about.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/research" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--brand-gold)] px-6 py-3 text-sm font-black uppercase tracking-wider text-[var(--brand-ink)] transition hover:brightness-110">Open Research</Link>
            <Link href="/demo" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/30 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-white/10">Explore a League Site</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
