'use client';
import {useEffect,useMemo,useState} from 'react';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {LineupOptimizerResponse} from '@/lib/fantasy/lineup-types';
import type {MarketIndex} from '@/lib/fantasy/decision-quality';
import {rosterQuality} from '@/lib/fantasy/decision-quality';
import type {Need} from '@/lib/fantasy/personalized-decisions';
import type {WaiverLead} from '@/lib/fantasy/decision-foundation';
import type {TaxiContext} from '@/lib/fantasy/taxi-context';
import type {NflGame} from '@/lib/weekly-center';
import {adviseTaxi,personalRankings,restOfSeasonPace,rosterImprovementPlan} from '@/lib/fantasy/decision-phase2';

type Props={rosters:Pick<FantasyRostersData,'teams'|'players'>;teamId:number;
 starterSlots:string[];needs:Need[];lineup:LineupOptimizerResponse|null;market:MarketIndex;
 taxiContext:TaxiContext|null;waiver:WaiverLead[];season:number;onSelectWaiver?:()=>void};
type Tab='plan'|'taxi'|'rankings'|'outlook';
const labels:Record<Tab,string>={plan:'Improve my team',taxi:'Taxi advisor',rankings:'Player rankings',outlook:'Season outlook'};
export default function TeamManagementAdvisor({rosters,teamId,starterSlots,needs,lineup,market,
 taxiContext,waiver,season,onSelectWaiver}:Props){
 const [tab,setTab]=useState<Tab>('plan');
 const [mode,setMode]=useState<'weekly'|'dynasty'>('dynasty');
 const [position,setPosition]=useState('ALL');
 const [showAll,setShowAll]=useState(false);
 const [schedule,setSchedule]=useState<NflGame[]|null>(null);
 const [scheduleError,setScheduleError]=useState('');
 useEffect(()=>{
  let active=true;
  setSchedule(null);setScheduleError('');
  fetch('/api/weekly-center/schedule?season='+season,{cache:'default'})
   .then(async response=>{
    const data=await response.json().catch(()=>({})) as {games?:NflGame[]};
    if(!response.ok||!Array.isArray(data.games))throw Error('Schedule unavailable');
    return data.games;
   }).then(games=>{if(active)setSchedule(games);}).catch(()=>{if(active)setScheduleError('The remaining NFL schedule could not be verified.');});
  return ()=>{active=false;};
 },[season]);
 const quality=useMemo(()=>rosterQuality(rosters,market,teamId,starterSlots),
  [rosters,market,teamId,starterSlots]);
 const improvements=useMemo(()=>rosterImprovementPlan({needs,quality,lineup}),[needs,quality,lineup]);
 const taxi=useMemo(()=>adviseTaxi(taxiContext,lineup,market),[taxiContext,lineup,market]);
 const ranking=useMemo(()=>personalRankings({rosters,teamId,market,weekly:lineup?.projectedPlayers||[],
  waiverIds:waiver.map(w=>w.providerId).filter((v):v is string=>!!v),needs,mode,position}),
  [rosters,teamId,market,lineup,waiver,needs,mode,position]);
 const pace=useMemo(()=>schedule&&lineup?restOfSeasonPace({
  players:lineup.projectedPlayers,schedule,week:lineup.week,season,now:Date.now()}):[],
  [schedule,lineup,season]);
 return <div className="mt-5 border-t border-[var(--border)] pt-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h3 className="text-lg font-black sm:text-xl">Team management and season outlook</h3>
    <p className="mt-1 text-sm text-[var(--muted)]">Choose what you want to decide. Detailed numbers are available inside each tool.</p></div>
  </div>
  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Decision tools">
   {(Object.keys(labels) as Tab[]).map(key=><button key={key} type="button" aria-pressed={tab===key}
    className={'min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold '+(tab===key?'border-[var(--accent)] bg-[var(--surface-2)] text-[var(--text)]':'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]')}
    onClick={()=>setTab(key)}>{labels[key]}</button>)}
  </div>
  {tab==='plan'&&<section className="mt-4" aria-label="Roster improvement priorities">
   <p className="mb-3 text-sm text-[var(--muted)]">Priority order is based on your starters, positional depth and verified market coverage. It is not a transaction recommendation.</p>
   {improvements.length===0&&<p className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--muted)]">No verified urgent roster weaknesses in the available comparison. Review player health and league trades for additional context.</p>}
   <div className="grid gap-3 md:grid-cols-2">{improvements.map((item,i)=><article key={item.key}
    className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
    <span className="text-xs font-semibold text-[var(--muted)]">Priority {i+1} · {item.priority==='high'?'Action worth reviewing':'Monitor and investigate'}</span>
    <h4 className="mt-1 font-bold">{item.headline}</h4>
    <p className="mt-2 text-sm text-[var(--muted)]">{item.why}</p>
   </article>)}</div>
   {onSelectWaiver&&<button type="button" onClick={onSelectWaiver}
    className="mt-4 text-sm font-bold text-[var(--accent)] underline">Explore players who could help →</button>}
  </section>}
  {tab==='taxi'&&<section className="mt-4" aria-label="Taxi squad decisions">
   {!taxiContext&&<p className="text-sm text-[var(--muted)]">Verified taxi roster data is unavailable for this provider or season. LeagueZone cannot assess a taxi move.</p>}
   {taxiContext&&<>
    <p className="text-sm text-[var(--muted)]">On taxi: {taxiContext.used}{taxiContext.maxSlots!==null?' of '+taxiContext.maxSlots+' Sleeper slots':' · Slot limit not available'}. Player placement and return eligibility must be checked against your league&apos;s rulebook and transaction history.</p>
    {!taxi.length&&<p className="mt-3 rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--muted)]">No taxi players are listed in the connected Sleeper roster. Review your league&apos;s taxi settings before placing anyone.</p>}
    <div className="mt-3 grid gap-3 md:grid-cols-2">{taxi.map(entry=><article key={entry.player.id}
     className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
     <div className="flex flex-wrap items-start justify-between gap-2">
      <h4 className="font-bold">{entry.player.name} <span className="text-xs font-normal text-[var(--muted)]">{entry.player.position}</span></h4>
      <span className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold">{entry.action}</span>
     </div>
     <p className="mt-2 text-sm text-[var(--muted)]">{entry.reason}</p>
     <p className="mt-2 text-xs text-[var(--muted)]">
      {entry.player.rookieYear!==null?'NFL entry: '+entry.player.rookieYear:'NFL entry year unverified'}
      {entry.weeklyProjection!==null?' · This week: '+entry.weeklyProjection.toFixed(1)+' projected pts':''}
      {entry.marketValue!==null?' · Dynasty reference: '+entry.marketValue.toLocaleString():''}
     </p>
    </article>)}</div>
    <p className="mt-3 text-xs text-[var(--muted)]">This advisor does not validate veteran eligibility, taxi resets, prior activation, deadlines, quarterback limits or available active roster slots. No player is moved automatically.</p>
   </>}
  </section>}
  {tab==='rankings'&&<section className="mt-4" aria-label="Personalized player rankings">
   <div className="flex flex-wrap items-end gap-3">
    <label className="text-xs font-semibold">Ranking type
     <select className="mt-1 block min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-2 text-[var(--text)]"
      value={mode} onChange={e=>{setMode(e.target.value as 'weekly'|'dynasty');setShowAll(false);}}>
      <option value="dynasty">Dynasty + team fit</option><option value="weekly">This week&apos;s projected points</option>
     </select></label>
    <label className="text-xs font-semibold">Position
     <select className="mt-1 block min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-2 text-[var(--text)]"
      value={position} onChange={e=>{setPosition(e.target.value);setShowAll(false);}}>
      {['ALL','QB','RB','WR','TE'].map(p=><option key={p} value={p}>{p==='ALL'?'All positions':p}</option>)}
     </select></label>
   </div>
   <p className="mt-3 text-sm text-[var(--muted)]">{mode==='weekly'?
    'Ranks your active roster by existing league-scoring projections for the current week. Taxi players are excluded.':
    'Ranks your roster and verified rising-usage unrostered candidates using existing dynasty market prices. A 6% or 12% team-need adjustment favors thin or short positions. Market source format may differ from your league; this is a value reference, not an exact league-calibrated valuation.'}</p>
   {!ranking.length&&<p className="mt-3 text-sm text-[var(--muted)]">{mode==='weekly'?'No verified current-week player projections are available.':'Market prices or matched player identifiers are unavailable.'}</p>}
   <div className="mt-3 space-y-2">{ranking.slice(0,showAll?80:16).map((item,i)=><div key={item.id}
    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-3">
    <div className="min-w-0"><p className="font-semibold">{i+1}. {item.name}</p>
     <p className="text-xs text-[var(--muted)]">{item.position} · {item.owned?'Your roster':'Unrostered in snapshot'}
      {item.fitBoost>0?' · Need adjustment +'+Math.round(item.fitBoost*100)+'%':''}</p></div>
    <strong className="shrink-0 text-sm">{mode==='weekly'?item.weeklyPoints?.toFixed(1)+' pts':Math.round(item.rankScore).toLocaleString()}</strong>
   </div>)}</div>
   {ranking.length>16&&!showAll&&<button type="button" className="mt-3 text-sm font-bold text-[var(--accent)] underline"
    onClick={()=>setShowAll(true)}>Show up to 80 ranked players</button>}
  </section>}
  {tab==='outlook'&&<section className="mt-4" aria-label="Rest-of-season planning outlook">
   <p className="text-sm text-[var(--muted)]">A planning baseline, not a rest-of-season prediction. Each player&apos;s current-week projection is held constant for their remaining scheduled NFL games; this does not model future injuries, usage shifts, opponent changes, or playoff odds.</p>
   {scheduleError&&<p role="status" className="mt-3 text-sm text-[var(--muted)]">{scheduleError} No extrapolated totals are shown.</p>}
   {!schedule&&!scheduleError&&<p role="status" className="mt-3 text-sm text-[var(--muted)]">Checking the published NFL schedule…</p>}
   {schedule&&(!lineup||pace.length===0)&&<p className="mt-3 text-sm text-[var(--muted)]">No remaining-game pace estimate is available for this roster and season.</p>}
   {pace.length>0&&<div className="mt-3 grid gap-3 md:grid-cols-2">
    {pace.slice(0,8).map(item=><article key={item.id}
     className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
     <div className="flex flex-wrap justify-between gap-2"><h4 className="font-bold">{item.name}</h4><span className="text-xs text-[var(--muted)]">{item.position}</span></div>
     <p className="mt-1 text-lg font-black">{item.pacePoints.toFixed(1)} <span className="text-xs font-normal text-[var(--muted)]">remaining-game pace pts</span></p>
     <p className="mt-1 text-xs text-[var(--muted)]">{item.weeklyProjection.toFixed(1)} current-week projected pts × {item.games} remaining scheduled games · {item.confidence} confidence</p>
     {item.byeWeeks.length>0&&<p className="mt-1 text-xs text-[var(--muted)]">Bye / no remaining game: Week {item.byeWeeks.join(', ')}</p>}
    </article>)}
   </div>}
   <p className="mt-3 text-xs text-[var(--muted)]">Source: NFL schedule and LeagueZone&apos;s existing current-week V3 projections. Totals are uncalibrated pace scenarios, not a modeled future schedule forecast.</p>
  </section>}
 </div>;
}
