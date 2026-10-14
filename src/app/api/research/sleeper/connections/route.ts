import {NextRequest,NextResponse} from 'next/server';
import {sql} from 'drizzle-orm';
import {getDb} from '@/server/db/client';
import {requireUser} from '@/lib/server/session';
import {rateLimitByIpStrict} from '@/lib/server/rate-limit';
import {validLeagueId,validSleeperUserId,previewSleeperTeams} from '@/lib/server/sleeper-research';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
async function account(req:NextRequest){
 if(req.cookies.has('lz_qa_session'))return null;
 return requireUser();
}
function rowsOf(value:unknown):Array<Record<string,unknown>>{
 return (value as {rows?:Array<Record<string,unknown>>}).rows||[];
}
function toEntry(r:Record<string,unknown>){
 return {leagueId:String(r.sleeper_league_id),sleeperUserId:String(r.sleeper_user_id),
   rosterId:Number(r.roster_id),season:Number(r.season),leagueName:String(r.league_name),
   teamName:String(r.team_name)};
}
export async function GET(req:NextRequest){
 const user=await account(req);
 if(!user)return fail('Sign in to view your Sleeper research connections.',401);
 try{
  const rows=await getDb().execute(sql`SELECT sleeper_league_id,sleeper_user_id,
    roster_id,season,league_name,team_name FROM leaguezone_sleeper_research_connections
    WHERE user_id=${user.userId}::uuid ORDER BY added_at DESC LIMIT 25`);
  return NextResponse.json({connections:rowsOf(rows).map(toEntry)},{headers});
 }catch{return fail('Research connections are temporarily unavailable.',503);}
}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return fail('Invalid origin.',403);
 const user=await account(req);
 if(!user)return fail('Sign in to connect your Sleeper team.',401);
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 const rate=await rateLimitByIpStrict(ip,'sleeper-research-connect',{maxRequests:12,windowSeconds:300});
 if(!rate.allowed)return fail('Too many connection requests. Try again later.',429);
 let data:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>1000)return fail('Request too large.',413);data=JSON.parse(raw);}
 catch{return fail('Invalid request.',400);}
 const leagueId=data?.leagueId,userId=data?.sleeperUserId,rosterId=data?.rosterId;
 if(!validLeagueId(leagueId)||!validSleeperUserId(userId)||!Number.isInteger(rosterId)||
  Number(rosterId)<1)return fail('Select a valid Sleeper league and roster.',400);
 try{
  const found=await previewSleeperTeams(leagueId,userId);
  const selected=found.teams.find(team=>team.rosterId===Number(rosterId));
  if(!selected)return fail('The selected roster does not belong to the supplied Sleeper username.',403);
  if(!Number.isInteger(found.season)||found.season<2017||found.season>2100)
   return fail('Invalid league season.',400);
  const count=await getDb().execute(sql`SELECT count(*)::int AS n
   FROM leaguezone_sleeper_research_connections WHERE user_id=${user.userId}::uuid`);
  if(Number(rowsOf(count)[0]?.n||0)>=25){
   const existing=await getDb().execute(sql`SELECT 1 FROM leaguezone_sleeper_research_connections
     WHERE user_id=${user.userId}::uuid AND sleeper_league_id=${leagueId}`);
   if(!rowsOf(existing).length)return fail('You can save up to 25 research connections.',409);
  }
  await getDb().execute(sql`INSERT INTO leaguezone_sleeper_research_connections
   (user_id,sleeper_league_id,sleeper_user_id,roster_id,season,league_name,team_name)
   VALUES (${user.userId}::uuid,${leagueId},${userId},${Number(rosterId)},
           ${found.season},${found.leagueName},${selected.teamName})
   ON CONFLICT (user_id,sleeper_league_id) DO UPDATE SET
     sleeper_user_id=excluded.sleeper_user_id,roster_id=excluded.roster_id,
     season=excluded.season,league_name=excluded.league_name,
     team_name=excluded.team_name,added_at=now()`);
  return NextResponse.json({connected:true,leagueId},{headers});
 }catch(err){
  console.warn('[sleeper-research-connect]',err instanceof Error?err.message:'connection failed');
  return fail('Unable to connect this team. Confirm that it appears in the chosen Sleeper league.',502);
 }
}
export async function DELETE(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return fail('Invalid origin.',403);
 const user=await account(req);
 if(!user)return fail('Sign in to disconnect your team.',401);
 const leagueId=req.nextUrl.searchParams.get('leagueId');
 if(!validLeagueId(leagueId))return fail('Invalid league.',400);
 try{
  await getDb().execute(sql`DELETE FROM leaguezone_sleeper_research_connections
   WHERE user_id=${user.userId}::uuid AND sleeper_league_id=${leagueId}`);
  return NextResponse.json({disconnected:true},{headers});
 }catch{return fail('Unable to disconnect right now.',503);}
}
