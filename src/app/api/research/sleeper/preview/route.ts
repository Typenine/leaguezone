import {NextRequest,NextResponse} from 'next/server';
import {requireUser} from '@/lib/server/session';
import {rateLimitByIpStrict} from '@/lib/server/rate-limit';
import {previewSleeperTeams,validLeagueId,validSleeperUserId} from '@/lib/server/sleeper-research';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){
 if(req.cookies.has('lz_qa_session')||!await requireUser())
  return NextResponse.json({error:'Sign in to preview a Sleeper team.'},{status:401,headers});
 const leagueId=req.nextUrl.searchParams.get('leagueId');
 const sleeperUserId=req.nextUrl.searchParams.get('sleeperUserId');
 if(!validLeagueId(leagueId)||!validSleeperUserId(sleeperUserId))
  return NextResponse.json({error:'Choose a league from your username search.'},{status:400,headers});
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 const rate=await rateLimitByIpStrict(ip,'sleeper-research-preview',{maxRequests:30,windowSeconds:300});
 if(!rate.allowed)return NextResponse.json({error:'Too many requests.'},{status:429,headers});
 try{
  return NextResponse.json(await previewSleeperTeams(leagueId,sleeperUserId),{headers});
 }catch(err){
  return NextResponse.json({error:err instanceof Error?err.message:'Sleeper unavailable.'},{status:502,headers});
 }
}
