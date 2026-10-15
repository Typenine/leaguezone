import {NextRequest,NextResponse} from 'next/server';
import {sql} from 'drizzle-orm';
import {requireUser} from '@/lib/server/session';
import {getDb} from '@/server/db/client';
import {researchSleeperRosters,validLeagueId} from '@/lib/server/sleeper-research';
import {rateLimitByIpStrict} from '@/lib/server/rate-limit';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){
 const user=req.cookies.has('lz_qa_session')?null:await requireUser();
 if(!user)return NextResponse.json({error:'Sign in for personalized research.'},{status:401,headers});
 const leagueId=req.nextUrl.searchParams.get('leagueId');
 if(!validLeagueId(leagueId))return NextResponse.json({error:'Select a connected Sleeper league.'},{status:400,headers});
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 const rate=await rateLimitByIpStrict(ip,'sleeper-research-context',{maxRequests:40,windowSeconds:300});
 if(!rate.allowed)return NextResponse.json({error:'Too many roster refreshes.'},{status:429,headers});
 try{
  const rows=await getDb().execute(sql`SELECT sleeper_league_id,sleeper_user_id,roster_id
   FROM leaguezone_sleeper_research_connections
   WHERE user_id=${user.userId}::uuid AND sleeper_league_id=${leagueId} LIMIT 1`);
  const row=(rows as unknown as {rows?:Array<{sleeper_league_id:string;sleeper_user_id:string;roster_id:number}>}).rows?.[0];
  if(!row)return NextResponse.json({error:'This league has not been connected to your account.'},{status:403,headers});
  const data=await researchSleeperRosters({
   sleeperLeagueId:row.sleeper_league_id,sleeperUserId:row.sleeper_user_id,rosterId:row.roster_id});
  return NextResponse.json({...data.rosters,catalog:data.catalog,viewerRosterId:data.viewerRosterId,
   starterSlots:data.starterSlots,taxiContext:data.taxiContext,leaguePpr:data.leaguePpr,leagueName:data.leagueName,teamName:data.teamName},{
   headers});
 }catch(err){
  console.warn('[sleeper-research-context]',err instanceof Error?err.message:'error');
  return NextResponse.json({error:err instanceof Error&&err.message.includes('no longer associated')?
   err.message:'Unable to load current Sleeper rosters. Try again shortly.'},{status:502,headers});
 }
}
