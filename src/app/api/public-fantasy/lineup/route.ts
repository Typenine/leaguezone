import {NextRequest,NextResponse} from 'next/server';
import {fetchLeagueContext,validLeagueId} from '@/lib/server/sleeper-research';
import {rateLimitByIpStrict} from '@/lib/server/rate-limit';
import {buildResearchSleeperLineupV3} from '@/lib/fantasy/weekly-projections-next';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'public, max-age=0, s-maxage=120'};
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('leagueId');
 const rosterId=Number(req.nextUrl.searchParams.get('rosterId'));
 if(!validLeagueId(id)||!Number.isInteger(rosterId)||rosterId<=0)
  return NextResponse.json({error:'Choose a valid Sleeper league and team.'},{status:400});
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 const rate=await rateLimitByIpStrict(ip,'public-fantasy-lineup',{maxRequests:8,windowSeconds:300});
 if(!rate.allowed)return NextResponse.json({error:'Too many projection requests. Try again shortly.'},{status:429});
 try{
  const context=await fetchLeagueContext(id);
  const roster=context.rosters.find(r=>r.roster_id===rosterId);
  if(!roster)return NextResponse.json({error:'That roster is not in this league.'},{status:404});
  const user=context.users.find(u=>u.user_id===roster.owner_id);
  const teamName=user?.metadata?.team_name||user?.display_name||'Roster '+rosterId;
  // Existing V3 optimizer, with saveSnapshots=false. No changes to the
  // connected user's lineup or authenticated forecast history.
  const data=await buildResearchSleeperLineupV3({leagueId:id,rosterId,teamName});
  return NextResponse.json(data,{headers});
 }catch(err){
  const error=err instanceof Error?err.message:'';
  if(error.includes('current-season'))return NextResponse.json({error},{status:409});
  console.warn('[public-fantasy-lineup]',error);
  return NextResponse.json({error:'Current-week projections are unavailable for this league.'},{status:502});
 }
}
