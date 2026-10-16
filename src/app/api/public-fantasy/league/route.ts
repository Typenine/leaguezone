import {NextRequest,NextResponse} from 'next/server';
import {fetchLeagueContext,researchSleeperRosters,validLeagueId} from '@/lib/server/sleeper-research';
import {rateLimitByIpStrict} from '@/lib/server/rate-limit';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// The Sleeper player directory is substantially larger than the league summary.
export const maxDuration=60;
const headers={'Cache-Control':'public, max-age=0, s-maxage=90'};
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('leagueId');
 if(!validLeagueId(id))return NextResponse.json({error:'Enter a valid numeric Sleeper league ID.'},{status:400});
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 const raw=req.nextUrl.searchParams.get('rosterId');
 const rate=await rateLimitByIpStrict(ip,raw===null?'public-fantasy-preview':'public-fantasy-context',
  {maxRequests:raw===null?60:30,windowSeconds:300});
 if(!rate.allowed)return NextResponse.json({error:'Too many requests. Try again in a few minutes.'},{status:429});
 try{
  const state=await fetchLeagueContext(id);
  const teamName=(rosterId:number)=>{
   const roster=state.rosters.find(r=>r.roster_id===rosterId);
   const user=state.users.find(u=>u.user_id===roster?.owner_id);
   return user?.metadata?.team_name||user?.display_name||'Roster '+rosterId;
  };
  const teams=state.rosters.map(r=>({rosterId:r.roster_id,teamName:teamName(r.roster_id)}));
  if(raw===null)return NextResponse.json({leagueId:id,leagueName:state.league.name,
   season:Number(state.league.season),teams},{headers});
  const rosterId=Number(raw);
  if(!Number.isInteger(rosterId)||rosterId<=0)return NextResponse.json({error:'Select a league team.'},{status:400});
  const roster=state.rosters.find(r=>r.roster_id===rosterId);
  const owner=roster?.owner_id||roster?.co_owners?.[0];
  if(!owner)return NextResponse.json({error:'Sleeper has no assigned owner for that roster. Choose an assigned team.'},{status:422});
  // Only public Sleeper league data. Never retrieve connected-account settings,
  // account-stored notes, prospect boards, private receipts or commissioner data.
  const context=await researchSleeperRosters({sleeperLeagueId:id,sleeperUserId:owner,rosterId},state);
  return NextResponse.json({...context.rosters,catalog:context.catalog,
   starterSlots:context.starterSlots,taxiContext:context.taxiContext,
   viewerRosterId:rosterId,leaguePpr:context.leaguePpr,leagueName:state.league.name,
   teamName:teamName(rosterId)}, {headers});
 }catch(err){
  console.warn('[public-fantasy-league]',err instanceof Error?err.message:'unknown');
  const message=err instanceof Error?err.message:'';
  return NextResponse.json({error:message.includes('could not find')?
   'Sleeper could not find that league. Check the ID or league link.':
   'Sleeper could not load this league right now. Check the ID and retry.'},{status:message.includes('could not find')?404:502});
 }
}
