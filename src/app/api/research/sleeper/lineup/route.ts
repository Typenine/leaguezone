import {NextRequest,NextResponse} from 'next/server';
import {sql} from 'drizzle-orm';
import {requireUser} from '@/lib/server/session';
import {getDb} from '@/server/db/client';
import {rateLimitByIpStrict} from '@/lib/server/rate-limit';
import {fetchLeagueContext,matchesUser,validLeagueId} from '@/lib/server/sleeper-research';
import {buildResearchSleeperLineupV3} from '@/lib/fantasy/weekly-projections-next';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
const cache=new Map<string,{time:number;value:Awaited<ReturnType<typeof buildResearchSleeperLineupV3>>}>();
export async function GET(req:NextRequest){
 const user=req.cookies.has('lz_qa_session')?null:await requireUser();
 if(!user)return NextResponse.json({error:'Sign in to view your lineup.'},{status:401,headers});
 const id=req.nextUrl.searchParams.get('leagueId');
 if(!validLeagueId(id))return NextResponse.json({error:'Select a connected Sleeper league.'},{status:400,headers});
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 const rate=await rateLimitByIpStrict(ip,'sleeper-lineup',{maxRequests:12,windowSeconds:300});
 if(!rate.allowed)return NextResponse.json({error:'Too many lineup requests.'},{status:429,headers});
 try{
  const result=await getDb().execute(sql`SELECT sleeper_user_id,roster_id FROM leaguezone_sleeper_research_connections
   WHERE user_id=${user.userId}::uuid AND sleeper_league_id=${id} LIMIT 1`);
  const row=(result as unknown as {rows?:{sleeper_user_id:string;roster_id:number}[]}).rows?.[0];
  if(!row)return NextResponse.json({error:'Connect this Sleeper team before viewing personalized lineups.'},{status:403,headers});
  const connected=await fetchLeagueContext(id);
  const roster=connected.rosters.find(r=>r.roster_id===row.roster_id&&matchesUser(r,row.sleeper_user_id));
  if(!roster)return NextResponse.json({error:'This roster is no longer associated with the connected Sleeper username. Reconnect.'},{status:409,headers});
  const owner=connected.users.find(u=>u.user_id===roster.owner_id);
  const teamName=owner?.metadata?.team_name?.trim()||owner?.display_name?.trim()||'Roster '+row.roster_id;
  const key=user.userId+':'+id+':'+row.roster_id+':'+connected.league.season;
  const hit=cache.get(key);
  if(hit&&Date.now()-hit.time<5*60*1000)return NextResponse.json(hit.value,{headers});
  const value=await buildResearchSleeperLineupV3({leagueId:id,rosterId:row.roster_id,teamName});
  if(cache.size>80)cache.clear();
  cache.set(key,{time:Date.now(),value});
  return NextResponse.json(value,{headers});
 }catch(e){
  const msg=e instanceof Error?e.message:'Unavailable';
  if(msg.includes('current-season'))return NextResponse.json({error:msg},{status:409,headers});
  console.warn('[research-lineup]',msg);
  return NextResponse.json({error:'Lineup projections are temporarily unavailable.'},{status:502,headers});
 }
}
