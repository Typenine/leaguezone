import {NextRequest,NextResponse} from 'next/server';
import {sql} from 'drizzle-orm';
import {requireUser} from '@/lib/server/session';
import {getUserLeagues} from '@/lib/server/user-auth';
import {getCurrentLeagueBySlug} from '@/lib/server/league-context';
import {getDb} from '@/server/db/client';
import {rateLimitByIpStrict} from '@/lib/server/rate-limit';
import {fetchLeagueContext,matchesUser,validLeagueId} from '@/lib/server/sleeper-research';
import {buildResearchSleeperLineupV3} from '@/lib/fantasy/weekly-projections-next';
import {adviseLineup} from '@/lib/fantasy/decision-foundation';
import {evaluateReceipt} from '@/lib/fantasy/decision-phase3';
import {loadScheduleWeek} from '@/lib/fantasy/weekly-projection-data';
import {getNFLState,getLeagueMatchups} from '@/lib/utils/sleeper-api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
type Scope={scopeKey:string;leagueId:string;rosterId:number;teamName:string;season:number;userId:string};
async function authorized(req:NextRequest):Promise<Scope|null>{
 if(req.cookies.has('lz_qa_session'))return null;
 const user=await requireUser();
 if(!user)return null;
 const type=req.nextUrl.searchParams.get('type');
 const id=req.nextUrl.searchParams.get('id');
 if(!id||id.length>100)return null;
 if(type==='hosted'){
  const league=await getCurrentLeagueBySlug(id);
  if(!league?.sleeperLeagueId)return null;
  const membership=(await getUserLeagues(user.userId)).find(x=>x.leagueId===league.id);
  if(membership?.rosterId==null)return null;
  const state=await fetchLeagueContext(league.sleeperLeagueId);
  const roster=state.rosters.find(x=>x.roster_id===membership.rosterId);
  if(!roster)return null;
  const owner=state.users.find(u=>u.user_id===roster.owner_id);
  return {scopeKey:'hosted:'+league.id,leagueId:league.sleeperLeagueId,
   rosterId:roster.roster_id,teamName:owner?.metadata?.team_name||owner?.display_name||'Roster '+roster.roster_id,
   season:Number(state.league.season),userId:user.userId};
 }
 if(type==='sleeper'&&validLeagueId(id)){
  const rows=await getDb().execute(sql`SELECT sleeper_user_id,roster_id
   FROM leaguezone_sleeper_research_connections
   WHERE user_id=${user.userId}::uuid AND sleeper_league_id=${id} LIMIT 1`);
  const row=(rows as unknown as {rows?:{sleeper_user_id:string;roster_id:number}[]}).rows?.[0];
  if(!row)return null;
  const state=await fetchLeagueContext(id);
  const roster=state.rosters.find(x=>x.roster_id===row.roster_id&&matchesUser(x,row.sleeper_user_id));
  if(!roster)return null;
  const owner=state.users.find(u=>u.user_id===roster.owner_id);
  return {scopeKey:'sleeper:'+id,leagueId:id,rosterId:roster.roster_id,
   teamName:owner?.metadata?.team_name||owner?.display_name||'Roster '+roster.roster_id,
   season:Number(state.league.season),userId:user.userId};
 }
 return null;
}
type Row={id:number;season:number;week:number;model_version:string;status:string;
 predicted_gain:number;actual_gain:number|null;recorded_at:string;
 suggested_start:string[];suggested_bench:string[];provider_league_id:string;roster_id:number};
async function list(scope:Scope){
 const results=await getDb().execute(sql`SELECT id,season,week,model_version,status,predicted_gain,
  actual_gain,recorded_at,suggested_start,suggested_bench,provider_league_id,roster_id
  FROM fantasy_decision_receipts
  WHERE user_id=${scope.userId}::uuid AND scope_key=${scope.scopeKey}
  ORDER BY season DESC,week DESC,recorded_at DESC LIMIT 18`);
 return (results as unknown as {rows?:Row[]}).rows||[];
}
export async function GET(req:NextRequest){
 try{
  const scope=await authorized(req);
  if(!scope)return NextResponse.json({error:'Connect and authenticate your own team to view receipts.'},{status:403,headers});
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  const rate=await rateLimitByIpStrict(ip,'decision-receipts-read',{maxRequests:25,windowSeconds:300});
  if(!rate.allowed)return NextResponse.json({error:'Too many requests'},{status:429,headers});
  const rows=await list(scope);
  const state=await getNFLState().catch(()=>null);
  const currentSeason=Number(state?.season||0),currentWeek=Number(state?.week||state?.display_week||0);
  const output=[];
  for(const row of rows){
   let status=row.status,actualGain=row.actual_gain;
   const complete=currentSeason>row.season||(currentSeason===row.season&&currentWeek>row.week);
   if(status==='pending'&&complete&&row.provider_league_id===scope.leagueId){
    const matchups=await getLeagueMatchups(scope.leagueId,row.week).catch(()=>[]);
    const own=matchups.find(x=>x.roster_id===row.roster_id);
    const result=evaluateReceipt({start:row.suggested_start,bench:row.suggested_bench,
     predictedGain:row.predicted_gain},own?.players_points||null,complete);
    if(result.status==='evaluated'){
     status='evaluated';actualGain=result.actualGain;
     await getDb().execute(sql`UPDATE fantasy_decision_receipts SET status='evaluated',
       actual_gain=${actualGain},evaluated_at=now()
       WHERE id=${row.id} AND user_id=${scope.userId}::uuid AND scope_key=${scope.scopeKey}
         AND status='pending'`);
    }
   }
   output.push({id:row.id,season:row.season,week:row.week,modelVersion:row.model_version,
    predictedGain:row.predicted_gain,actualGain,status,recordedAt:row.recorded_at});
  }
  const evaluated=output.filter(x=>x.status==='evaluated'&&x.actualGain!==null);
  return NextResponse.json({receipts:output,summary:{evaluated:evaluated.length,
   improved:evaluated.filter(x=>(x.actualGain||0)>0).length,
   accuracy:evaluated.length?Number((100*evaluated.filter(x=>(x.actualGain||0)>0).length/evaluated.length).toFixed(1)):null},
   methodology:'Actual gain compares the fantasy points scored by the suggested starters versus suggested bench players. It measures the recommendation, not whether a manager followed it.'},{headers});
 }catch(e){
  console.warn('[decision-receipts GET]',e instanceof Error?e.message:'unknown');
  return NextResponse.json({error:'Decision history unavailable. No accuracy claims were generated.'},{status:503,headers});
 }
}
export async function POST(req:NextRequest){
 try{
  const scope=await authorized(req);
  if(!scope)return NextResponse.json({error:'Connect and authenticate your own team before recording decisions.'},{status:403,headers});
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  const rate=await rateLimitByIpStrict(ip,'decision-receipts-write',{maxRequests:8,windowSeconds:300});
  if(!rate.allowed)return NextResponse.json({error:'Too many receipt requests'},{status:429,headers});
  const existing=await list(scope);
  const state=await getNFLState();
  if(String(state.season)!==String(scope.season))return NextResponse.json({error:'Only the current football season can be recorded.'},{status:409,headers});
  const week=Number(state.week??state.display_week);
  if(existing.some(x=>x.season===scope.season&&x.week===week))return NextResponse.json({recorded:true,existing:true},{headers});
  const schedule=await loadScheduleWeek(String(scope.season),week).catch(()=>null);
  const kickoff=schedule?.earliestKickoff?Date.parse(schedule.earliestKickoff):NaN;
  if(!schedule?.hasGames||!schedule.seasonValidated||!Number.isFinite(kickoff)||Date.now()>=kickoff)
   return NextResponse.json({error:'The verified pregame recording window is closed or unavailable.'},{status:409,headers});
  const lineup=await buildResearchSleeperLineupV3({leagueId:scope.leagueId,rosterId:scope.rosterId,teamName:scope.teamName});
  if(lineup.week!==week||Number(lineup.season)!==scope.season)
   return NextResponse.json({error:'The current projection is out of sync with the schedule.'},{status:409,headers});
  const recommended=adviseLineup(lineup);
  if(!recommended)return NextResponse.json({recorded:false,reason:'No eligible lineup change was recommended.'},{headers});
  const start=recommended.start.map(p=>p.id),bench=recommended.bench.map(p=>p.id);
  await getDb().execute(sql`INSERT INTO fantasy_decision_receipts
    (user_id,scope_key,provider_league_id,roster_id,season,week,model_version,predicted_gain,suggested_start,suggested_bench)
    VALUES (${scope.userId}::uuid,${scope.scopeKey},${scope.leagueId},${scope.rosterId},${scope.season},
     ${week},${lineup.modelVersion},${recommended.gain},${JSON.stringify(start)}::jsonb,${JSON.stringify(bench)}::jsonb)
    ON CONFLICT (user_id,scope_key,roster_id,season,week,model_version) DO NOTHING`);
  return NextResponse.json({recorded:true,week,modelVersion:lineup.modelVersion},{headers});
 }catch(e){
  console.warn('[decision-receipts POST]',e instanceof Error?e.message:'unknown');
  return NextResponse.json({error:'Could not verify and record the current decision. No receipt was created.'},{status:503,headers});
 }
}
