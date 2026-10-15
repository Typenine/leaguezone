'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FantasyRostersData } from '@/lib/providers/types';
import opportunityEngine from '../../../../../public/research/opportunities.js';
import decisionEngine from '../../../../../public/research/insights.js';
import {decisionCandidates,rosterNeeds} from '@/lib/fantasy/personalized-decisions';
import ActionableDecisions from '@/components/fantasy/ActionableDecisions';
import DecisionFoundationPanel from '@/components/fantasy/DecisionFoundationPanel';
import LineupComparison from '@/components/fantasy/LineupComparison';
import type {LineupOptimizerResponse} from '@/lib/fantasy/lineup-types';

type Signal = {
  id: string; name: string; team: string; pos: string; week: number;
  baseline: number; recent: number; change: number; direction: 'rising' | 'falling'; metric: string;
  scoringBefore: number; scoringRecent: number; scoringChange: number; relativeChange?: number;
};
type ResearchPlayer = { id: string; n: string; team: string; pos: string; ryr: number | null;
  w: Array<[number, string, number, number, number, number, number, ...number[]]>;
  u?: Array<{ week: number; team: string; att: number }> };
type Season = { year: number; throughWeek: number; updated: string; schema: number; players: ResearchPlayer[]; _researchSource?: 'live'|'backup' };
type CatalogPlayer = { id: string; gsisId: string | null; name: string; position: string; team: string };
type LeagueRosters = FantasyRostersData & { catalog: CatalogPlayer[]; viewerRosterId: number | null; leaguePpr: number | null; starterSlots: string[]; superflex:boolean|null; scoringIsCustom?:boolean;taxiContext?:import('@/lib/fantasy/taxi-context').TaxiContext|null };
type Ownership = { player: ResearchPlayer; owner: FantasyRostersData['teams'][number] | null;
  providerId: string | null; match: 'catalog' | 'roster' | 'unmatched' };
type OpportunityEngine = {
  radar: (data: Season, scoring: string) => Signal[];
  ownership: (players: ResearchPlayer[], teams: FantasyRostersData['teams'],
    providers: FantasyRostersData['players'], catalog: CatalogPlayer[]) => Ownership[];
};
// This is the exact same deterministic engine as the public Radar. The module
// also runs without a DOM in Vitest and in the static research application.
const engine = opportunityEngine as OpportunityEngine;
type Decision = {category:'watch'|'momentum'|'risk'; label:string; heading:string; why:string; next:string}|null;
const decisionModel = decisionEngine as {classify:(signal:Signal)=>Decision};

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error((await response.json().catch(() => ({})) as {error?: string}).error || `Data unavailable (${response.status})`);
  return response.json() as Promise<T>;
}

async function researchSeason(year: number): Promise<Season> {
  const local = `/research/data/${year}.json`;
  let remote: string | null = null;
  let alternateRemote: string | null = null;
  try {
    const config = await json<{publicBase?: string}>('/research/data-source.json');
    const base = String(config.publicBase || '').replace(/\/+$/, '');
    if (/^https:\/\/[^/]+$/i.test(base)) {
      const firstParty='/api/research-feed';
      let catalog:{schema:number;files:Record<string,{key:string}>};
      try {catalog=await json<typeof catalog>(firstParty+'/research/v1/catalog.json');}
      catch {catalog=await json<typeof catalog>(base+'/research/v1/catalog.json');}
      const key=catalog.schema===1&&catalog.files?.[String(year)]?.key;
      if(key&&/^research\/v1\/objects\/20\d\d-[a-f0-9]{64}\.json$/.test(key)){
        remote=firstParty+'/'+key;alternateRemote=base+'/'+key;
      }
    }
  } catch { /* The website's archived static copy is the fallback. */ }
  if (remote) {
    try {
      const data = await json<Season>(remote);
      if (data.year === year && data.schema === 3 && data.players?.length > 100) return {...data,_researchSource:'live'};
    } catch { /* Try the published Worker directly before using an archived bundle. */ }
    if(alternateRemote){
      try {const data=await json<Season>(alternateRemote);
        if(data.year===year&&data.schema===3&&data.players?.length>100)return {...data,_researchSource:'live'};
      } catch { /* Archived backup next. */ }
    }
  }
  const data = await json<Season>(local);
  if (data.year !== year || data.schema !== 3 || !Array.isArray(data.players) || data.players.length < 100) {
    throw new Error(`Research statistics are not available for ${year}.`);
  }
  return {...data,_researchSource:'backup'};
}

async function attachPassAttempts(data: Season): Promise<void> {
  // The base R2 snapshot is authoritative. Optional attempts must match its
  // exact season, week and data version before being attached to a QB.
  const qbs = data.players.filter((p) => p.pos === 'QB');
  if (qbs.every((qb) => qb.w.every((row) => Number.isInteger(row[15]) && row[15] >= 0))) return;
  try {
    const config = await json<{publicBase?: string}>('/research/data-source.json');
    const base = String(config.publicBase || '').replace(/\/+$/, '');
    let advancedUrl: string | null = null;
    if (/^https:\/\/[^/]+$/i.test(base)) {
      const catalog = await json<{schema:number; files:Record<string,{throughWeek:number;updated:string}>;
        datasets?:{usage?:{schema:number;files:Record<string,{key:string;throughWeek:number;baseUpdated:string}>}}}>(
        base + '/research/v1/catalog.json',
      );
      const baseInfo = catalog.files?.[String(data.year)];
      const info = catalog.datasets?.usage?.files?.[String(data.year)];
      if (catalog.schema===1 && catalog.datasets?.usage?.schema===1 && baseInfo &&
          baseInfo.throughWeek===data.throughWeek && baseInfo.updated===data.updated &&
          info && info.throughWeek===data.throughWeek && info.baseUpdated===data.updated &&
          /^research\/v1\/objects\/20\d\d-[a-f0-9]{64}\.json$/.test(info.key)) {
        advancedUrl = '/api/research-feed/' + info.key;
      }
    }
    const local = '/research/data/usage/' + data.year + '.json';
    let usage: {schema:number;year:number;throughWeek:number;baseUpdated:string;
      players:Record<string,Array<[number,string,number]>>};
    try {usage = await json<typeof usage>(advancedUrl || local);}
    catch {usage = await json<typeof usage>(local);}
    if (usage.schema!==1 || usage.year!==data.year || usage.throughWeek!==data.throughWeek ||
        usage.baseUpdated!==data.updated) return;
    for (const player of qbs) {
      if (player.w.every((row) => Number.isInteger(row[15]) && row[15] >= 0)) continue;
      player.u = (usage.players[player.id] || []).map((row) => ({week:row[0],team:row[1],att:row[2]}));
    }
  } catch { /* No reliable attempts: QB signals remain omitted, never guessed. */ }
}

import type {FantasyTeamData} from '@/lib/providers/types';

type GuidedFinding={signal:Signal;decision:Decision;owner:FantasyTeamData|null;providerId:string|null};
function GuidedCard({item,season,slug,kind}:{
 item:GuidedFinding;season:number;slug:string;kind:'waiver'|'trade'|'risk';
}){
 const {signal,decision,owner,providerId}=item;
 return <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
   <div className="flex flex-wrap items-center justify-between gap-2">
     <Link href={`/research/players/${encodeURIComponent(signal.id)}?season=${season}`}
       className="font-bold text-accent underline underline-offset-2">{signal.name}</Link>
     <span className="text-xs font-semibold text-[var(--muted)]">{signal.pos} · {signal.team} · Week {signal.week}</span>
   </div>
   <p className="mt-2 text-sm font-bold text-[var(--text)]">{decision?.heading||'Opportunity changing'}</p>
   <p className="mt-1 text-sm text-[var(--muted)]">{decision?.why||'Review the observed workload before acting.'}</p>
   <p className="mt-2 text-xs text-[var(--muted)]">Opportunity per game: {signal.baseline.toFixed(1)} → {signal.recent.toFixed(1)}
     {' · '}Fantasy points per game: {signal.scoringBefore.toFixed(1)} → {signal.scoringRecent.toFixed(1)}</p>
   {owner&&<p className="mt-2 text-xs text-[var(--muted)]">Rostered by {owner.teamName}</p>}
   <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-accent underline">
    <Link href={`/research/players/${encodeURIComponent(signal.id)}?season=${season}`}>Research player</Link>
    {kind==='trade'&&providerId&&<Link href={`/l/${encodeURIComponent(slug)}/trades/analyzer?b=${encodeURIComponent(providerId)}`}>Check trade values</Link>}
    {kind==='waiver'&&<Link href={`/l/${encodeURIComponent(slug)}/rosters`}>Review league rosters</Link>}
    {kind==='risk'&&<Link href="/availability">Check injury status</Link>}
   </div>
 </article>;
}

export default function RosterOpportunitiesPage({ params }: { params: Promise<{leagueSlug: string}> }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [rosters, setRosters] = useState<LeagueRosters | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState('');
  const [position, setPosition] = useState('ALL');
  const [category, setCategory] = useState<'trade' | 'waiver' | 'roster'>('trade');
  const [scoring, setScoring] = useState('half');
  const [view, setView] = useState<'brief'|'finder'>('brief');
  const [focus, setFocus] = useState<'overview'|'waiver'|'trade'|'risk'|'lineup'>('overview');
  const [lineup, setLineup] = useState<LineupOptimizerResponse|null>(null);
  const [lineupError, setLineupError] = useState<string|null>(null);
  const [lineupLoading, setLineupLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    params.then(async ({ leagueSlug }) => {
      if (!alive) return;
      setSlug(leagueSlug);
      try {
        const response = await fetch(`/api/league-opportunities/${encodeURIComponent(leagueSlug)}`, {
          credentials: 'same-origin', cache: 'no-store',
        });
        const payload = await response.json() as LeagueRosters & {error?: string};
        if (!response.ok) throw new Error(payload.error || 'League rosters are unavailable.');
        const year = Number(payload.season);
        if (!Number.isInteger(year) || year < 2000) throw new Error('This league has no current football season.');
        const data = await researchSeason(year);
        await attachPassAttempts(data);
        if (!alive) return;
        setRosters(payload); setSeason(data);
        if (payload.viewerRosterId != null) setTeamId(String(payload.viewerRosterId));
        if (payload.leaguePpr === 0) setScoring('standard');
        else if (payload.leaguePpr === 0.5) setScoring('half');
        else if (payload.leaguePpr === 1) setScoring('ppr');
        setStale(response.headers.get('x-leaguezone-data-mode') === 'stale');
      } catch (cause) { if (alive) setError(cause instanceof Error ? cause.message : 'Opportunity data unavailable.'); }
    });
    return () => { alive = false; };
  }, [params]);

  const report = useMemo(() => {
    if (!season || !rosters) return null;
    const signals = engine.radar(season, scoring);
    const owners = engine.ownership(signals.map((s) => season.players.find((p) => p.id === s.id)!),
      rosters.teams, rosters.players, rosters.catalog || []);
    return { signals: signals.map((signal, i) => ({signal, decision: decisionModel.classify(signal), ...owners[i]})),
      unmatched: owners.filter((o) => o.match === 'unmatched').length };
  }, [season, rosters, scoring]);
  const visible = useMemo(() => {
    const sleeperRoster = rosters?.provider === 'sleeper';
    return report?.signals.filter(({signal, owner, match}) => {
    if (position !== 'ALL' && signal.pos !== position) return false;
    if (category === 'trade') return Boolean(teamId && owner && String(owner.rosterId) !== teamId && match !== 'unmatched');
    if (category === 'roster') return Boolean(owner && String(owner.rosterId) === teamId);
    // Yahoo does not expose a complete authoritative free-agent player pool here.
    return sleeperRoster && !owner && match === 'catalog';
  }).sort((a, b) => (b.signal.relativeChange || 0) - (a.signal.relativeChange || 0)
    || Math.abs(b.signal.change) - Math.abs(a.signal.change)) || [];
  }, [report, category, position, teamId, rosters]);


  // Candidate ownership is verified by the existing provider identity matcher.
  // Positional need is based on real roster counts and fixed starter slots.
  const needs = useMemo(() => rosters && teamId
    ? rosterNeeds(rosters.teams, rosters.players, Number(teamId), rosters.starterSlots||[])
    : [], [rosters,teamId]);
  const personal = useMemo(() => {
    const rows=report?.signals||[];
    const selected=Number(teamId);
    return {
      waiver:decisionCandidates(rows,needs,selected,rosters?.provider||'', 'waiver'),
      trade:decisionCandidates(rows,needs,selected,rosters?.provider||'', 'trade'),
      risk:decisionCandidates(rows,needs,selected,rosters?.provider||'', 'my-roster'),
    };
  },[report,needs,teamId,rosters]);
  const [lineupRetry,setLineupRetry]=useState(0);
  const isMyTeam=Boolean(rosters?.viewerRosterId!=null && String(rosters.viewerRosterId)===teamId);
  useEffect(()=>{
    if(!slug||!isMyTeam||view!=='brief'||focus!=='lineup')return;
    let alive=true;
    setLineup(null);setLineupError(null);setLineupLoading(true);
    json<LineupOptimizerResponse>('/api/league-opportunities/'+encodeURIComponent(slug)+'/lineup')
      .then(data=>{if(alive)setLineup(data);})
      .catch(err=>{if(alive)setLineupError(err instanceof Error?err.message:'Lineup unavailable');})
      .finally(()=>{if(alive)setLineupLoading(false);});
    return ()=>{alive=false;};
  },[slug,isMyTeam,view,focus,lineupRetry]);

  const rosterContext = useMemo(() => {
    const snapshot=rosters;
    if (!snapshot || !teamId) return null;
    const positions=['QB','RB','WR','TE'];
    const count=(team: FantasyRostersData['teams'][number],pos:string) =>
      team.players.filter((id)=>snapshot.players[id]?.position===pos).length;
    const selected=snapshot.teams.find((team)=>String(team.rosterId)===teamId);
    if (!selected) return null;
    return positions.map((pos)=>{
      const sorted=snapshot.teams.map((team)=>count(team,pos)).sort((a,b)=>a-b);
      const mid=Math.floor(sorted.length/2);
      const median=sorted.length ? sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2 : 0;
      return {pos,mine:count(selected,pos),median};
    });
  },[rosters,teamId]);

  return <main className="container mx-auto px-4 py-8 pb-28 text-[var(--text)]">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-accent">League research</p>
        <h1 className="mt-2 text-3xl font-black">Roster Opportunity Finder</h1></div>
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-accent underline"><Link href="/research/decisions">Fantasy Decision Center</Link><Link href="/research/radar">Explore Radar</Link>
        <Link href={`/l/${encodeURIComponent(slug || '')}/draft?view=team-prospect-draftboard`}>Open prospect board</Link></div>
    </div>
    <p className="mb-6 max-w-3xl text-sm text-[var(--muted)]">Match observed NFL usage changes against current league rosters. Select your team to separate players on other rosters, verified unrostered players, and your own roster.</p>
    {error && <div role="alert" className="rounded-lg border border-red-500/50 p-5">{error}</div>}
    {!error && (!season || !rosters || !report) && <p role="status">Loading research and league rosters…</p>}
    {season && rosters && report && <>
      <div className="mb-5 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold">Your team<select className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--surface-strong)] p-2.5" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">Select a team</option>{rosters.teams.map((team) => <option key={team.rosterId} value={team.rosterId}>{team.teamName}</option>)}
        </select></label>
        <label className="text-xs font-bold">Position<select className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--surface-strong)] p-2.5" value={position} onChange={(e) => setPosition(e.target.value)}>
          {['ALL','QB','RB','WR','TE'].map((p) => <option key={p} value={p}>{p === 'ALL' ? 'All positions' : p}</option>)}
        </select></label>
        <label className="text-xs font-bold">Scoring<select className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--surface-strong)] p-2.5" value={scoring} onChange={(e) => setScoring(e.target.value)}>
          <option value="half">Half PPR</option><option value="ppr">Full PPR</option><option value="standard">Standard</option>
        </select></label>
        <div className="text-xs text-[var(--muted)]"><span className="font-bold text-[var(--text)]">{rosters.season} season</span><br/>Research through Week {season.throughWeek}<br/>Updated {season.updated}</div>
      </div>
      {isMyTeam && view==='brief' && <DecisionFoundationPanel key={slug+':'+teamId}
       endpoint={'/api/league-opportunities/'+encodeURIComponent(slug||'')+'/lineup'}
       rosters={rosters} teamId={Number(teamId)} starterSlots={rosters.starterSlots||[]}
       needs={needs} waiver={personal.waiver} season={season.year}
       throughWeek={season.throughWeek} source={season._researchSource||'backup'} taxiContext={rosters.taxiContext}
       onSelect={setFocus}/>}
      {rosterContext && <section className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" aria-label="Roster construction">
        <h2 className="mb-2 text-sm font-bold">Your roster construction</h2>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {rosterContext.map(({pos,mine,median})=><div key={pos} className="rounded border border-[var(--border)] p-2">
            <span className="font-bold">{pos}</span> <span className="text-[var(--muted)]">{mine} players</span>
            <p className="text-xs text-[var(--muted)]">League median: {median}</p>
          </div>)}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">Roster counts provide context only. They do not measure player quality, lineup requirements, injury risk or trade feasibility.</p>
      </section>}
      {rosters.leaguePpr != null && ![0,0.5,1].includes(rosters.leaguePpr) &&
        <p className="mb-4 text-xs text-[var(--muted)]">This league has custom PPR ({rosters.leaguePpr}); the selected standard research scoring view is an approximation, not exact league scoring.</p>}

      <section className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6" aria-label="Personalized fantasy decisions">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-accent">Phase 5C · Your League</p>
            <h2 className="mt-2 text-2xl font-black">My Fantasy Decision Board</h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">See roster needs, players to investigate and lineup decisions in one place. Recommendations are based on observed statistics and verified ownership, not guessed trade availability.</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Decision board view">
            <button type="button" onClick={()=>setView('brief')} aria-pressed={view==='brief'}
              className={`rounded-lg border px-3 py-2 text-sm font-bold ${view==='brief'?'border-[var(--accent)] bg-accent-soft text-accent':'border-[var(--border)] text-[var(--text)]'}`}>My Decision Board</button>
            <button type="button" onClick={()=>setView('finder')} aria-pressed={view==='finder'}
              className={`rounded-lg border px-3 py-2 text-sm font-bold ${view==='finder'?'border-[var(--accent)] bg-accent-soft text-accent':'border-[var(--border)] text-[var(--text)]'}`}>Advanced Finder</button>
          </div>
        </div>
        {season._researchSource==='backup' && <p role="status" className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-[var(--text)]">Live research is unavailable. This is the archived Week {season.throughWeek} copy from {season.updated}; newer published results may exist. Do not treat this as the current week.</p>}
        {view==='brief' && <>
          {!teamId?<p className="mt-5 rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">Select a team above to see personalized findings. Only your assigned team can display private lineup projections.</p>:<>
            <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Decision category">
              {([
                ['overview','Overview'],['waiver','Waiver watch'],['trade','Trade research'],
                ['risk','My roster alerts'],['lineup','Lineup decisions']
              ] as const).map(([key,label])=><button type="button" key={key} aria-pressed={focus===key}
                onClick={()=>setFocus(key)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold sm:text-sm ${focus===key?'border-[var(--accent)] bg-accent-soft text-accent':'border-[var(--border)] text-[var(--text)]'}`}>
                {label}{key==='waiver'?' · '+personal.waiver.length:key==='trade'?' · '+personal.trade.length:key==='risk'?' · '+personal.risk.length:''}
              </button>)}
            </div>
            {(['overview','waiver','trade'] as const).includes(focus as 'overview'|'waiver'|'trade')&&
              <ActionableDecisions rosters={rosters} season={season.year} slug={slug||''} teamId={Number(teamId)}
                needs={needs} personal={personal} focus={focus} onFocus={setFocus}/>}
            {focus==='risk'&&<div className="mt-5">
              <h3 className="text-lg font-black">Your players with shrinking roles</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">A falling workload is a reason to investigate, not an automatic drop recommendation.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {personal.risk.slice(0,18).map(item=><GuidedCard key={item.signal.id} item={item} season={season.year} slug={slug||''} kind="risk"/>)}
              </div>
              {!personal.risk.length&&<p className="mt-4 rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--muted)]">No measured declining-role signals currently match your roster.</p>}
            </div>}
            {focus==='lineup'&&<div className="mt-5">
              <h3 className="text-lg font-black">Your weekly lineup decisions</h3>
              {!isMyTeam?<p className="mt-3 rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                Lineup projections are only available for the roster assigned to your account. Select your own team above to continue.</p>:<>
                {lineupLoading&&<p className="mt-3 text-sm" role="status">Loading your existing lineup projections…</p>}
                {lineupError&&<div className="mt-3 rounded-lg border border-red-400/50 p-4 text-sm">
                  {lineupError} <button type="button" className="ml-3 font-bold text-accent underline" onClick={()=>setLineupRetry(n=>n+1)}>Retry</button></div>}
                {lineup&&!lineupLoading&&<div className="mt-4">
                  <p className="text-sm text-[var(--muted)]">{lineup.season} · Week {lineup.week} · {lineup.confidence} projection confidence</p>
                  {!lineup.available?<p className="mt-3 rounded-lg border border-[var(--border)] p-4 text-sm">{lineup.reason||'No reliable lineup comparison is available for this week.'}</p>:<>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-xl">
                      <div className="rounded-xl border border-[var(--border)] p-4"><span className="text-xs text-[var(--muted)]">Current projected lineup</span><p className="text-xl font-black">{lineup.currentTotal==null?'—':lineup.currentTotal.toFixed(1)}</p></div>
                      <div className="rounded-xl border border-[var(--border)] p-4"><span className="text-xs text-[var(--muted)]">Optimized projected lineup</span><p className="text-xl font-black">{lineup.optimalTotal==null?'—':lineup.optimalTotal.toFixed(1)}</p></div>
                    </div>
                    <p className="mt-3 text-xs text-[var(--muted)]">{lineup.confidenceNote} These are model projections, not guaranteed points. Verify starters, injuries and the league&apos;s lineup rules.</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {lineup.optimalLineup.filter(entry=>entry.changed&&entry.player).map(entry=><article key={entry.slot+':'+entry.slotIndex} className="rounded-xl border border-[var(--border)] p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-accent">{entry.slot} · Suggested lineup review</p>
                        <p className="mt-2 font-bold">{entry.player?.name} <span className="text-xs font-normal text-[var(--muted)]">({entry.player?.position})</span></p>
                        <p className="mt-1 text-sm text-[var(--muted)]">Projected {entry.player?.projection.toFixed(1)} points · {entry.player?.confidence} confidence</p>
                        <Link href="/availability" className="mt-2 inline-block text-xs font-bold text-accent underline">Check availability</Link>
                      </article>)}
                    </div>
                    <LineupComparison players={lineup.projectedPlayers} starterSlots={rosters.starterSlots||[]}/>
                    {!lineup.optimalLineup.some(entry=>entry.changed&&entry.player)&&<p className="mt-3 text-sm text-[var(--muted)]">The model does not identify a different projected starting lineup this week.</p>}
                  </>}
                </div>}
              </>}
            </div>}
          </>}
        </>}
      </section>

      {view==='finder' && <>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Opportunity category">
        {(['trade','waiver','roster'] as const).map((key) => <button type="button" key={key} onClick={() => setCategory(key)} aria-pressed={category===key}
          className={`rounded-lg border px-4 py-2 text-sm font-bold ${category===key?'border-[var(--accent)] bg-accent-soft text-accent':'border-[var(--border)] text-[var(--muted)]'}`}>
          {({trade:'Other rosters',waiver:'Unrostered (Sleeper)',roster:'My roster'})[key]}</button>)}
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">{visible.length} matching signals. {report.unmatched} signals have unverified player identity and are excluded from ownership categories.
        {rosters.provider === 'yahoo' && ' Yahoo does not supply a full free-agent catalog here, so unrostered status cannot be verified.'}
        {stale && ' League roster data is a cached snapshot.'}
      </p>
      {!teamId && category !== 'waiver' ? <div className="rounded-xl border border-[var(--border)] p-5">Select your team to see {category === 'trade'?'other rosters':'your roster'}.</div> :
        visible.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map(({signal,decision,owner,player,providerId}) => <article key={signal.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-start justify-between gap-2"><div><Link href={`/research/players/${encodeURIComponent(signal.id)}?season=${season.year}`} className="font-bold text-accent underline">{signal.name}</Link>
            <p className="text-xs text-[var(--muted)]">{signal.pos} · {signal.team}{player.ryr === season.year?' · Rookie':''}</p></div>
            <span className={signal.direction==='rising'?'text-sm font-bold text-emerald-400':'text-sm font-bold text-red-400'}>Volume {signal.direction}</span></div>
          {decision && <div className="mt-3"><p className="text-sm font-bold text-[var(--text)]">{decision.label}: {decision.heading}</p><p className="mt-1 text-sm text-[var(--muted)]">{decision.why}</p></div>}
          <p className="mt-4 text-xl font-black">{signal.change>0?'+':''}{signal.change.toFixed(1)} <span className="text-xs font-medium text-[var(--muted)]">{signal.metric}/game</span></p>
          <p className="text-sm text-[var(--muted)]">{signal.baseline.toFixed(1)} to {signal.recent.toFixed(1)} opportunity · Fantasy points {signal.scoringBefore.toFixed(1)} to {signal.scoringRecent.toFixed(1)}/game</p>
          {decision && <p className="mt-3 text-xs text-[var(--muted)]"><span className="font-bold text-[var(--text)]">Before acting:</span> {decision.next}</p>}
          <p className="mt-3 text-sm">{owner ? <>On <Link href={`/l/${encodeURIComponent(slug || '')}/teams/${owner.rosterId}`} className="font-semibold text-accent underline">{owner.teamName}</Link></> : 'Unrostered in current Sleeper roster snapshot; confirm waiver eligibility'}</p>
          {owner && rosters.provider === 'sleeper' && providerId && <Link href={`/l/${encodeURIComponent(slug || '')}/trades/analyzer?b=${encodeURIComponent(providerId)}`} className="mt-3 inline-block text-xs font-semibold text-accent underline">Review in Trade Analyzer</Link>}
        </article>)}</div> : <div className="rounded-xl border border-[var(--border)] p-5 text-sm text-[var(--muted)]">No verified {category === 'waiver'?'unrostered':'rostered'} players meet this filter.</div>}
      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">Usage signals use the last two recorded games against the previous two, with a minimum change of 1.5 opportunities and 15%. These are ownership-filtered observations, not verified trade availability, league-specific valuations, or waiver eligibility. Ownership is a current roster snapshot; review league settings, player news, and price before acting. Future draft prospects and traded picks are outside this NFL player dataset.</p>
      </>}
    </>}
  </main>;
}
