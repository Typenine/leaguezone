'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeftRight,CalendarDays,CloudSun,CloudOff,ExternalLink,RefreshCw,TrendingUp,Users} from 'lucide-react';
import {loadDashboardResearch,type ResearchSnapshot} from '@/lib/research-dashboard';
import {defenseAllowed,effectiveWeek,POSITIONS,TEAM_CODES,type NflGame,type DefenseMetric,type Position} from '@/lib/weekly-center';
import {loadSavedLibrary} from '@/lib/saved-research-client';

type Schedule={season:number;games:NflGame[];fetchedAt:string;error?:string};
type Depth={updated:string;players:{id:string|null;name:string;position:string;rank:number}[];error?:string;sourceUrl?:string};
type Forecast={at:string;temperature:number;unit:string;wind:string;direction:string;conditions:string;precipitation:number|null;error?:string};
type News={items:{title:string;url:string;published:string|null}[];notice:string;sourceUrl:string};
type Scores='ppr'|'half'|'standard';
const fmt=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const styles={
 panel:'rounded-xl border border-white/15 bg-white/[0.035] p-4 sm:p-5',
 muted:'text-sm text-white/60',
 small:'text-xs text-white/50',
 link:'text-[var(--brand-gold)] hover:underline',
 button:'rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-[var(--brand-gold)]/60 disabled:opacity-40',
};
const teamName=(team:string)=>team==='WAS'?'WAS':team;
function renderTime(kickoff:string|null){if(!kickoff)return 'Kickoff TBD';const value=Date.parse(kickoff);return Number.isFinite(value)?fmt.format(new Date(value)):'Kickoff TBD'}
function providerStatus(s:string|null){return s&&s.toLowerCase().includes('dome')||s&&s.toLowerCase()==='closed'}
const currentYear=()=>{const d=new Date();return d.getUTCMonth()>=7?d.getUTCFullYear():d.getUTCFullYear()-1};
export default function WeeklyCenter(){
 const [season,setSeason]=useState(currentYear);
 const [selectedWeek,setSelectedWeek]=useState<number|null>(null);
 const [schedule,setSchedule]=useState<Schedule|null>(null);
 const [scheduleError,setScheduleError]=useState('');
 const [analytics,setAnalytics]=useState<ResearchSnapshot|null>(null);
 const [analyticsError,setAnalyticsError]=useState('');
 const [scoring,setScoring]=useState<Scores>('half');
 const [position,setPosition]=useState<Position>('WR');
 const [team,setTeam]=useState('');
 const [depth,setDepth]=useState<Depth|null>(null);
 const [depthError,setDepthError]=useState('');
 const [depthLoading,setDepthLoading]=useState(false);
 const [weather,setWeather]=useState<Record<string,Forecast|string>>({});
 const [busyWeather,setBusyWeather]=useState<string|null>(null);
 const [news,setNews]=useState<News|null>(null);
 const [watched,setWatched]=useState<string[]>([]);
 const [showAllTeams,setShowAllTeams]=useState(false);
 const [refreshToken,setRefreshToken]=useState(0);
 useEffect(()=>{
  const qs=new URLSearchParams(window.location.search);
  const year=Number(qs.get('season')),week=Number(qs.get('week'));
  if(Number.isInteger(year)&&year>=2020&&year<=currentYear()+1)setSeason(year);
  if(Number.isInteger(week)&&week>=1&&week<=18)setSelectedWeek(week);
  void loadSavedLibrary().then(s=>setWatched(s.items.filter(i=>i.type==='player').map(i=>i.key.slice(7))))
   .catch(()=>setWatched([]));
 },[]);
 useEffect(()=>{
  let alive=true;setSchedule(null);setScheduleError('');setSelectedWeek(s=>s);
  fetch('/api/weekly-center/schedule?season='+season,{cache:'no-store'})
   .then(async r=>{const j=await r.json() as Schedule;if(!r.ok)throw Error(j.error||'Schedule unavailable');return j})
   .then(j=>{if(alive){setSchedule(j);setSelectedWeek(w=>w&&j.games.some(g=>g.week===w)?w:effectiveWeek(j.games))}})
   .catch(e=>{if(alive)setScheduleError(e instanceof Error?e.message:'Schedule unavailable')});
  return()=>{alive=false};
 },[season,refreshToken]);
 useEffect(()=>{
  let alive=true;
  setAnalytics(null);setAnalyticsError('');
  // Keep public research on the CDN/R2 path; nothing here queries Neon.
  loadDashboardResearch().then(j=>{
   if(!alive)return;
   if(j.year===season)setAnalytics(j);
   else setAnalyticsError('Published fantasy statistics for '+season+' are not available in the latest research snapshot.');
  }).catch(()=>{if(alive)setAnalyticsError('Player research is temporarily unavailable. Schedule and weather still work.')});
  return()=>{alive=false};
 },[season,refreshToken]);
 useEffect(()=>{
  let alive=true;
  fetch('/api/weekly-center/news',{cache:'no-store'}).then(r=>r.json()).then((j:News)=>{if(alive)setNews(j)})
   .catch(()=>{if(alive)setNews({items:[],notice:'News feed unavailable.',sourceUrl:'https://www.espn.com/nfl/'})});
  return()=>{alive=false};
 },[refreshToken]);
 const games=useMemo(()=>schedule?.games.filter(g=>g.week===selectedWeek)||[],[schedule,selectedWeek]);
 const metrics=useMemo(()=>analytics&&schedule?
  defenseAllowed(analytics,schedule.games,scoring):[],[analytics,schedule,scoring]);
 const teamMetrics=useMemo(()=>metrics.filter(m=>m.position===position)
  .sort((a,b)=>b.avg-a.avg),[metrics,position]);
 const watchedPlayers=useMemo(()=>{
  if(!analytics)return [];
  const ids=new Set(watched),teams=new Set(games.flatMap(g=>[g.home,g.away]));
  return analytics.players.filter(p=>ids.has(p.id)&&teams.has(p.team)).slice(0,24);
 },[analytics,watched,games]);
 const teams=useMemo(()=>[...TEAM_CODES].sort(),[]);
 const selectedGameTeams=useMemo(()=>new Set(games.flatMap(g=>[g.home,g.away])),[games]);
 function setWeek(week:number){
  setSelectedWeek(week);
  const url=new URL(window.location.href);
  url.searchParams.set('season',String(season));url.searchParams.set('week',String(week));
  window.history.replaceState(null,'',url.toString());
 }
 function setYear(year:number){
  setSeason(year);setSelectedWeek(null);setTeam('');setDepth(null);
  const url=new URL(window.location.href);
  url.searchParams.set('season',String(year));url.searchParams.delete('week');
  window.history.replaceState(null,'',url.toString());
 }
 async function requestWeather(game:NflGame){
  if(!game.stadium||!game.kickoff||busyWeather||weather[game.id])return;
  setBusyWeather(game.id);
  try{
   const r=await fetch('/api/weekly-center/weather?stadium='+encodeURIComponent(game.stadium)+
    '&kickoff='+encodeURIComponent(game.kickoff));
   const j=await r.json() as Forecast;
   setWeather(old=>({...old,[game.id]:r.ok?j:j.error||'Weather unavailable.'}));
  }catch{setWeather(old=>({...old,[game.id]:'Weather could not be loaded.'}))}
  finally{setBusyWeather(null)}
 }
 async function loadDepth(nextTeam:string){
  setTeam(nextTeam);setDepth(null);setDepthError('');
  if(!nextTeam)return;
  setDepthLoading(true);
  try{
   const r=await fetch('/api/weekly-center/depth?team='+encodeURIComponent(nextTeam)+'&season='+season);
   const j=await r.json() as Depth;
   if(!r.ok)throw Error(j.error||'Depth chart unavailable');
   setDepth(j);
  }catch(e){setDepthError(e instanceof Error?e.message:'Depth chart unavailable')}
  finally{setDepthLoading(false)}
 }
 const scoringName=scoring==='half'?'Half PPR':scoring==='ppr'?'PPR':'Standard';
 const dateRange=games.length?games.map(g=>g.kickoff).filter((s):s is string=>Boolean(s)).sort():[];
 return <div className="min-h-screen bg-[var(--brand-ink)] px-4 pb-24 pt-8 text-white sm:pt-12">
  <div className="mx-auto max-w-7xl">
   <header className="flex flex-wrap items-start justify-between gap-5">
    <div>
     <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--brand-gold)]">LeagueZone / NFL Research</p>
     <h1 className="mt-2 text-3xl font-black uppercase sm:text-5xl">Weekly Football Center</h1>
     <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
      NFL matchups, defensive fantasy tendencies, verified depth charts and kickoff weather. Built from published data, not projected scores.
     </p>
    </div>
    <button className={styles.button+' flex items-center gap-2'} type="button" onClick={()=>{setRefreshToken(x=>x+1);setWeather({});}}>
     <RefreshCw size={16} aria-hidden="true"/> Refresh data
    </button>
   </header>
   <nav aria-label="Weekly research navigation" className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
    <a href="#games" className={styles.link}>Games and weather</a>
    <a href="#matchups" className={styles.link}>Defensive matchups</a>
    <a href="#depth-charts" className={styles.link}>Depth charts</a>
    <a href="#news" className={styles.link}>NFL headlines</a>
    <Link href="/my-research" className={styles.link}>My Research</Link>
   </nav>
   <section className={styles.panel+' mt-6'} aria-label="Season and week filters">
    <div className="flex flex-wrap items-end gap-4">
     <label className="text-xs font-semibold text-white/70">Season
      <select value={season} onChange={e=>setYear(Number(e.target.value))}
       className="mt-2 block min-h-11 rounded-lg border border-white/25 bg-[#122740] p-2.5 text-white">
       {[currentYear(),currentYear()-1,currentYear()-2].map(y=><option key={y} value={y}>{y}</option>)}
      </select>
     </label>
     <label className="min-w-44 flex-1 text-xs font-semibold text-white/70">NFL week
      <select aria-label="NFL week" value={selectedWeek||''} disabled={!schedule}
       onChange={e=>setWeek(Number(e.target.value))}
       className="mt-2 block min-h-11 w-full rounded-lg border border-white/25 bg-[#122740] p-2.5 text-white disabled:opacity-60">
       {selectedWeek===null&&<option value="">Loading schedule</option>}
       {Array.from(new Set(schedule?.games.map(g=>g.week)||[])).map(w=><option value={w} key={w}>Week {w}</option>)}
      </select>
     </label>
     <div className="min-w-0 flex-1 text-sm text-white/60" role="status">
      {scheduleError||(!schedule?'Loading the NFL schedule…':
       'Week '+selectedWeek+' · '+games.length+' games'+(dateRange.length?' · '+new Date(dateRange[0]).toLocaleDateString('en-US',{month:'short',day:'numeric'}):''))}
     </div>
    </div>
   </section>
   <section id="games" className="mt-8 scroll-mt-28">
    <div className="flex flex-wrap items-end justify-between gap-3">
     <h2 className="flex items-center gap-2 text-xl font-black uppercase"><CalendarDays size={20} aria-hidden="true"/> Week {selectedWeek||'—'} games</h2>
     <p className={styles.small}>Scores update with the source schedule. Weather is a forecast for outdoor games within seven days.</p>
    </div>
    {scheduleError&&<p className="mt-4 rounded-lg border border-amber-400/30 p-4 text-sm text-amber-100">{scheduleError} <a className="underline" href="https://github.com/nflverse/nfldata" target="_blank" rel="noopener noreferrer">Schedule source</a></p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
     {games.map(g=>{
      const indoor=Boolean(providerStatus(g.roof));
      const forecast=weather[g.id];
      const metric=metrics.find(m=>m.team===g.home&&m.position===position);
      return <article key={g.id} className={styles.panel+' min-w-0'}>
       <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/55">
        <span>{renderTime(g.kickoff)}</span>
        <span className={g.status==='final'?'font-semibold text-emerald-300':'text-white/50'}>{g.status==='final'?'Final':'Scheduled'}</span>
       </div>
       <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div><strong className="text-xl">{teamName(g.away)}</strong>{g.awayScore!==null&&<p className="text-xl tabular-nums">{g.awayScore}</p>}</div>
        <span className="text-xs text-white/45">@</span>
        <div><strong className="text-xl">{teamName(g.home)}</strong>{g.homeScore!==null&&<p className="text-xl tabular-nums">{g.homeScore}</p>}</div>
       </div>
       <p className="mt-3 truncate text-center text-xs text-white/45" title={g.stadium||undefined}>{g.stadium||'Stadium not listed'}{g.roof?' · '+g.roof:''}</p>
       {metric&&<p className="mt-3 text-center text-xs text-white/55">Home defense allows {metric.avg.toFixed(1)} {scoringName} {position} points per game</p>}
       <div className="mt-4 border-t border-white/10 pt-3">
        {indoor?<p className="flex items-center gap-2 text-xs text-white/55"><CloudOff size={16}/> Listed as enclosed. Outdoor conditions are not shown as playing conditions.</p>:
         forecast?typeof forecast==='string'?<p role="status" className="text-xs text-amber-200">{forecast}</p>:
          <div><p className="flex items-center gap-2 text-sm font-semibold"><CloudSun size={17}/> {forecast.temperature}°{forecast.unit} · {forecast.conditions}</p>
           <p className="mt-1 text-xs text-white/55">Wind {forecast.wind} {forecast.direction} · Rain chance {forecast.precipitation===null?'—':forecast.precipitation+'%'}</p>
           <p className="mt-1 text-[11px] text-white/40">NWS forecast, not a game outcome or fantasy projection.</p></div>:
         <button type="button" onClick={()=>void requestWeather(g)} disabled={!g.kickoff||!g.stadium||busyWeather!==null}
          className={styles.button+' w-full'}>{busyWeather===g.id?'Loading NWS forecast…':'Check kickoff weather'}</button>}
       </div>
      </article>
     })}
    </div>
    {schedule&&!games.length&&<p className={styles.panel+' mt-4 text-sm text-white/60'}>No scheduled games found for the selected week.</p>}
    <p className="mt-3 text-xs text-white/45">Schedule: <a className="underline" href="https://github.com/nflverse/nfldata" target="_blank" rel="noopener noreferrer">nflverse / nfldata</a>. Weather: <a className="underline" href="https://www.weather.gov/documentation/services-web-api" target="_blank" rel="noopener noreferrer">National Weather Service</a>. Closed-roof status comes from the schedule, not a live roof sensor.</p>
   </section>
   <section id="matchups" className="mt-10 scroll-mt-28">
    <h2 className="flex items-center gap-2 text-xl font-black uppercase"><ArrowLeftRight size={20} aria-hidden="true"/> Defensive matchup research</h2>
    <p className="mt-2 max-w-3xl text-sm text-white/60">
     Fantasy points allowed to each position by opposing players in completed games. A higher rank means that defense has allowed more points, not that its next opponent is guaranteed to score more.
    </p>
    <div className="mt-4 flex flex-wrap gap-3">
     <label className="text-xs font-semibold text-white/60">Position
      <select value={position} onChange={e=>setPosition(e.target.value as Position)} className="mt-1 block min-h-11 rounded-lg border border-white/25 bg-[#122740] p-2.5 text-white">
       {POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}
      </select>
     </label>
     <label className="text-xs font-semibold text-white/60">Scoring
      <select value={scoring} onChange={e=>setScoring(e.target.value as Scores)} className="mt-1 block min-h-11 rounded-lg border border-white/25 bg-[#122740] p-2.5 text-white">
       <option value="half">Half PPR</option><option value="ppr">PPR</option><option value="standard">Standard</option>
      </select>
     </label>
     <label className="flex items-center gap-2 self-end pb-2 text-xs text-white/70">
      <input type="checkbox" checked={showAllTeams} onChange={e=>setShowAllTeams(e.target.checked)}/>Show all defenses</label>
    </div>
    <p className="mt-3 text-xs text-white/45">Stats through Week {analytics?.throughWeek||'—'} · {analytics?.source==='backup'?'Site backup data (may be older)':'Published research snapshot'}. {scoringName}.</p>
    {analyticsError&&<p role="status" className="mt-3 rounded-lg border border-amber-400/20 p-3 text-sm text-amber-100">{analyticsError}</p>}
    {!analytics&&!analyticsError&&<p role="status" className={styles.muted+' mt-3'}>Loading defensive statistics…</p>}
    <div className="mt-4 overflow-x-auto rounded-xl border border-white/15">
     <table className="min-w-[540px] w-full text-left text-sm">
      <thead className="bg-white/10 text-xs uppercase text-white/65"><tr>
       <th className="p-3">Rank</th><th className="p-3">Defense</th><th className="p-3">Games</th><th className="p-3">Allowed / game</th><th className="p-3">Last 3 games</th><th className="p-3">Vs league avg</th>
      </tr></thead>
      <tbody>{teamMetrics.filter(x=>showAllTeams||selectedGameTeams.has(x.team)).map(m=><tr key={m.team} className="border-t border-white/10">
       <td className="p-3 tabular-nums">#{m.rank}</td><td className="p-3 font-semibold">{m.team}</td>
       <td className="p-3 tabular-nums">{m.games}</td><td className="p-3 tabular-nums">{m.avg.toFixed(1)}</td>
       <td className="p-3 tabular-nums">{m.recent===null?'—':m.recent.toFixed(1)}</td>
       <td className="p-3 tabular-nums">{(m.avg-m.leagueAvg)>=0?'+':''}{(m.avg-m.leagueAvg).toFixed(1)}</td>
      </tr>)}</tbody>
     </table>
     {teamMetrics.length===0&&<p className="p-4 text-sm text-white/60">No complete-game fantasy matchup sample is published for this season.</p>}
    </div>
    <p className="mt-3 text-xs text-white/45">Method: Sum PPR points (adjusted for the selected scoring) by position in each opponent game, then divide by completed defensive games. The last-three value includes only verified games. Byes are excluded, and estimates are not provided for future games.</p>
    {watchedPlayers.length>0&&<div className={styles.panel+' mt-5'}>
     <h3 className="font-bold">Watched players in Week {selectedWeek}</h3>
     <div className="mt-3 flex flex-wrap gap-2">
      {watchedPlayers.map(p=><Link key={p.id} href={'/research/players/'+encodeURIComponent(p.id)+'?season='+season}
       className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold hover:border-[var(--brand-gold)]">
       {p.n} · {p.team}</Link>)}
     </div>
     <p className="mt-2 text-xs text-white/50">Team affiliation from the latest published player statistics, which may lag current transactions.</p>
    </div>}
   </section>
   <section id="depth-charts" className="mt-10 scroll-mt-28">
    <h2 className="flex items-center gap-2 text-xl font-black uppercase"><Users size={20} aria-hidden="true"/> NFL depth charts</h2>
    <p className="mt-2 text-sm text-white/60">Listed position and rank, as of the most recent available nflverse timestamp. Rankings do not establish snap share or injury status.</p>
    <label className="mt-4 block max-w-sm text-xs font-semibold text-white/60">Choose an NFL team
     <select value={team} onChange={e=>void loadDepth(e.target.value)} className="mt-2 block min-h-11 w-full rounded-lg border border-white/25 bg-[#122740] p-3 text-white">
      <option value="">Select team</option>{teams.map(t=><option key={t} value={t}>{t}</option>)}
     </select>
    </label>
    {depthLoading&&<p role="status" className="mt-3 text-sm text-white/60">Loading verified depth-chart snapshot…</p>}
    {depthError&&<p role="status" className="mt-3 text-sm text-amber-200">{depthError} <a target="_blank" rel="noopener noreferrer" className="underline" href="https://github.com/nflverse/nflverse-data/releases/tag/depth_charts">Source</a></p>}
    {depth&&<div className={styles.panel+' mt-4'}>
     <p className="text-xs text-white/55">Team {team} · Reported {new Date(depth.updated).toLocaleString('en-US')} · Source: <a className={styles.link} target="_blank" rel="noopener noreferrer" href={depth.sourceUrl||'https://github.com/nflverse/nflverse-data/releases/tag/depth_charts'}>nflverse</a></p>
     <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...new Set(depth.players.map(p=>p.position))].map(pos=><div key={pos} className="rounded-lg border border-white/10 p-3">
      <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-[var(--brand-gold)]">{pos}</h3>
      {depth.players.filter(p=>p.position===pos).map((p,i)=><div className="flex gap-2 py-1 text-sm" key={(p.id||p.name)+'-'+i}>
       <span className="w-6 shrink-0 text-white/40">{p.rank}</span>
       {p.id?<Link className="min-w-0 truncate hover:underline" href={'/research/players/'+encodeURIComponent(p.id)+'?season='+season}>{p.name}</Link>:
        <span className="min-w-0 truncate">{p.name}</span>}</div>)}
     </div>)}</div>
    </div>}
   </section>
   <section id="news" className="mt-10 scroll-mt-28">
    <h2 className="flex items-center gap-2 text-xl font-black uppercase"><TrendingUp size={20} aria-hidden="true"/> NFL headlines</h2>
    <p className="mt-2 text-sm text-white/60">Links to original reporting, not syndicated LeagueZone articles. The official ESPN feed may intermittently block automated access.</p>
    {news&&!news.items.length&&<div className={styles.panel+' mt-4'}>
     <p className="text-sm text-white/65">{news.notice}</p>
     <a href="https://www.espn.com/nfl/" target="_blank" rel="noopener noreferrer" className={styles.link+' mt-3 inline-flex items-center gap-1 text-sm'}>Browse NFL news at ESPN <ExternalLink size={14}/></a>
    </div>}
    {news&&news.items.length>0&&<div className="mt-4 grid gap-3 md:grid-cols-2">
     {news.items.slice(0,12).map((item,i)=><article key={item.url+'-'+i} className={styles.panel}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">ESPN · {item.published?new Date(item.published).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'Date not provided'}</p>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-start gap-2 font-semibold text-white hover:text-[var(--brand-gold)]">{item.title}<ExternalLink size={14} className="mt-1 shrink-0"/></a>
     </article>)}
    </div>}
    {!news&&<p role="status" className="mt-3 text-sm text-white/60">Checking the official NFL news feed…</p>}
   </section>
   <footer className="mt-12 border-t border-white/10 pt-6 text-xs leading-6 text-white/45">
    All matchup statistics are historical observations, not predictions. Data sources include nflverse and the National Weather Service. No practice-participation or comprehensive injury-report feed is included in Phase 4A.
   </footer>
  </div>
 </div>;
}
