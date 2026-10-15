'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import type {FantasyRostersData} from '@/lib/providers/types';
import type {LineupOptimizerResponse} from '@/lib/fantasy/lineup-types';
import type {MarketIndex} from '@/lib/fantasy/decision-quality';
import type {Need} from '@/lib/fantasy/personalized-decisions';
import {adviseLineup} from '@/lib/fantasy/decision-foundation';
import {rankProspects,type Prospect} from '@/lib/fantasy/decision-phase3';
import {PROSPECT_BASELINE_2027} from '@/components/draft/TeamProspectDraftboard';
import TradeImpactTool from '@/components/fantasy/TradeImpactTool';
export type DecisionScope={type:'hosted'|'sleeper'|'guest';id:string};
type Props={selectedTool?:Tab;rosters:Pick<FantasyRostersData,'teams'|'players'>;teamId:number;
 starterSlots:string[];needs:Need[];market:MarketIndex;
 lineup:LineupOptimizerResponse|null;season:number;scope:DecisionScope};
type BoardSave={boardVersion?:string;orderIds?:string[];target?:Record<string,boolean>;
 noFit?:Record<string,boolean>;unlikely?:Record<string,boolean>};
type Receipt={id:number;season:number;week:number;modelVersion:string;status:string;
 predictedGain:number;actualGain:number|null;recordedAt:string};
type Summary={evaluated:number;improved:number;accuracy:number|null};
type Tab='trade'|'draft'|'receipts';
const LABELS:Record<Tab,string>={trade:'Trade impact',draft:'Draft advisor',receipts:'Prediction receipts'};
export default function AdvancedDecisionTools({selectedTool,rosters,teamId,starterSlots,needs,market,lineup,season,scope}:Props){
 const [currentTab,setTab]=useState<Tab>('trade');
 const tab=selectedTool||currentTab;
 const [saved,setSaved]=useState<BoardSave|null>(null);
 const [boardState,setBoardState]=useState('Using existing scouting baseline');
 const [receipts,setReceipts]=useState<Receipt[]>([]);
 const [summary,setSummary]=useState<Summary|null>(null);
 const [receiptError,setReceiptError]=useState('');
 const [receiptState,setReceiptState]=useState('Loading prediction receipts…');
 const [receiptRetry,setReceiptRetry]=useState(0);
 const is2027=season+1===2027;
 useEffect(()=>{
  if(!is2027||scope.type!=='hosted'){setSaved(null);setBoardState('Using existing scouting baseline');return;}
  let live=true;
  setSaved(null);setBoardState('Using existing scouting baseline');
  fetch('/api/decision-draft-board?slug='+encodeURIComponent(scope.id)+'&classYear=2027',{credentials:'same-origin',cache:'no-store'})
   .then(async r=>{if(!r.ok)throw Error('Board not accessible');return r.json();})
   .then((d:{data?:BoardSave})=>{
    if(!live)return;
    if(d.data?.boardVersion?.startsWith('2027-preseason-')){
     setSaved(d.data);setBoardState('Your saved prospect order and player flags are applied');
    }
   }).catch(()=>{if(live)setBoardState('Your saved board is unavailable; using the scouting baseline');});
  return ()=>{live=false;};
 },[scope.id,scope.type,is2027]);
 const prospects=useMemo(()=>{
  const initial=PROSPECT_BASELINE_2027.map(p=>({...p}));
  if(!saved||!Array.isArray(saved.orderIds))return initial;
  const keyed=new Map(initial.map(p=>[p.id,p]));
  const used=new Set<string>();
  const arranged=[...saved.orderIds.map(id=>{const p=keyed.get(id);if(!p||used.has(id))return null;used.add(id);return p;}).filter((p):p is typeof initial[number]=>p!==null),
   ...initial.filter(p=>!used.has(p.id))];
  return arranged.map(p=>({...p,target:!!saved.target?.[p.id],
   noFit:!!saved.noFit?.[p.id],unlikely:!!saved.unlikely?.[p.id]}));
 },[saved]);
 const targets=useMemo(()=>is2027?rankProspects({prospects:prospects as Prospect[],needs,
  superflex:starterSlots.includes('SUPER_FLEX')||starterSlots.filter(s=>s==='QB').length>1}).slice(0,12):[],
 [prospects,needs,starterSlots,is2027]);
 const endpoint='/api/decision-receipts?type='+encodeURIComponent(scope.type)+'&id='+encodeURIComponent(scope.id);
 const currentAdvice=adviseLineup(lineup);
 useEffect(()=>{
  if(scope.type==='guest')return;
  let active=true;
  setReceiptState('Checking saved predictions…');setReceiptError('');
  const run=async()=>{
   let note='';
   if(currentAdvice&&lineup){
    try{
     const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store'});
     if(!r.ok){const data=await r.json().catch(()=>({})) as {error?:string};
      note=data.error||'This recommendation cannot be recorded now.';}
    }catch{note='Pregame recording is temporarily unavailable.';}
   }
   try{
    const r=await fetch(endpoint,{credentials:'same-origin',cache:'no-store'});
    const data=await r.json() as {receipts?:Receipt[];summary?:Summary;error?:string};
    if(!r.ok)throw Error(data.error||'Receipts unavailable');
    if(active){setReceipts(data.receipts||[]);setSummary(data.summary||null);
     setReceiptState('');setReceiptError(note);}
   }catch(e){if(active){setReceiptState('');setReceiptError(e instanceof Error?e.message:'Receipts unavailable');}}
  };
  void run();
  return ()=>{active=false;};
 // One immutable record per actual week/model is enforced on the server, not in this effect.
 },[endpoint,lineup?.week,lineup?.modelVersion,receiptRetry]);
 const grade=summary?.accuracy;
 return <section className="mt-5 border-t border-[var(--border)] pt-5" aria-label="Advanced decision tools">
  <h3 className="text-lg font-black sm:text-xl">Trade, draft and prediction tools</h3>
  <p className="mt-1 text-sm text-[var(--muted)]">Research the impact of your next move and review how earlier recommendations performed.</p>
  {!selectedTool&&<div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Advanced decisions">
   {(Object.keys(LABELS) as Tab[]).map(key=><button key={key} type="button" aria-pressed={tab===key}
    className={'min-h-11 rounded-lg border p-2 text-xs font-bold sm:text-sm '+(tab===key?'border-[var(--accent)] bg-[var(--surface-strong)]':'border-[var(--border)] text-[var(--muted)]')}
    onClick={()=>setTab(key)}>{LABELS[key]}</button>)}
  </div>}
  {tab==='trade'&&<div className="mt-4"><TradeImpactTool rosters={rosters} market={market}
   teamId={teamId} starterSlots={starterSlots} slug={scope.type==='hosted'?scope.id:undefined}/></div>}
  {tab==='draft'&&<div className="mt-4">
   {!is2027?<p className="text-sm text-[var(--muted)]">A verified scouting board for the upcoming {season+1} rookie class has not been published here yet. No prospect recommendations are being invented.</p>:<>
    <p className="text-sm text-[var(--muted)]">2027 rookie-class guidance based on the existing scouting board, your actual depth and starting requirements. Changes to the baseline are small and disclosed, not a prediction of NFL draft position.</p>
    <p className="mt-2 text-xs text-[var(--muted)]">{boardState}. Pick ownership, rookie availability and college declarations are not verified by this advisor.</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">{targets.map(row=><article key={row.prospect.id}
     className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
      <p className="font-bold">{row.prospect.name} <span className="text-xs font-normal text-[var(--muted)]">{row.prospect.pos} · {row.prospect.college}</span></p>
      <p className="mt-1 text-xs text-[var(--muted)]">Board #{row.boardRank} · Tier {row.prospect.tier} · Projected NFL range: {row.prospect.draftRange}</p>
      <p className="mt-2 text-sm">{row.reason}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{row.prospect.strengths.slice(0,2).join('; ')}. Watch: {row.prospect.concerns.slice(0,1).join('; ')||'Scouting uncertainties'}</p>
     </article>)}</div>
    {scope.type==='hosted'&&<Link href={'/l/'+encodeURIComponent(scope.id)+'/draft?view=team-prospect-draftboard'}
     className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-[var(--accent)] underline">Edit your saved prospect board →</Link>}
   </>}
  </div>}
  {tab==='receipts'&&<div className="mt-4">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div><h4 className="font-bold">Recorded start/bench recommendations</h4>
     <p className="mt-1 text-xs text-[var(--muted)]">One immutable pregame comparison per team, week and model. No postgame rewrites.</p></div>
    <button className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold"
     type="button" onClick={()=>setReceiptRetry(n=>n+1)}>Refresh receipts</button>
   </div>
   {receiptState&&<p role="status" className="mt-3 text-sm text-[var(--muted)]">{receiptState}</p>}
   {receiptError&&<p role="status" className="mt-3 text-xs text-[var(--muted)]">{receiptError}</p>}
   {summary&&<div className="mt-3 flex flex-wrap gap-3 text-sm">
    <span className="rounded-lg border border-[var(--border)] p-3"><strong>{summary.evaluated}</strong> evaluated</span>
    <span className="rounded-lg border border-[var(--border)] p-3"><strong>{summary.improved}</strong> positive outcomes</span>
    <span className="rounded-lg border border-[var(--border)] p-3"><strong>{grade===null?'Not enough data':grade+'%'}</strong> success rate</span>
   </div>}
   {!receiptState&&receipts.length===0&&<p className="mt-3 text-sm text-[var(--muted)]">No valid pregame recommendations have been captured for this team yet. Recording begins when an actionable suggestion is available before the verified first kickoff.</p>}
   <div className="mt-3 space-y-2">{receipts.map(r=><div key={r.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-sm">
    <div className="flex flex-wrap justify-between gap-2"><strong>{r.season} Week {r.week}</strong>
     <span className="text-xs text-[var(--muted)]">{r.status==='evaluated'?'Actual points verified':'Awaiting final points'}</span></div>
    <p className="mt-1 text-xs text-[var(--muted)]">{r.modelVersion} · Pregame model estimate: +{Number(r.predictedGain).toFixed(1)} pts</p>
    {r.status==='evaluated'&&r.actualGain!=null&&<p className="mt-1">Actual start-versus-bench advantage: {Number(r.actualGain)>0?'+':''}{Number(r.actualGain).toFixed(1)} pts</p>}
   </div>)}</div>
   <p className="mt-3 text-xs text-[var(--muted)]">Accuracy is the percentage of verified recommendations where suggested starters outscored suggested bench players. A recorded recommendation is not proof anyone followed it. Missing final points remain pending and are excluded from the denominator.</p>
  </div>}
 </section>;
}
