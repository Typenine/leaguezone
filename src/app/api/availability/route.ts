import {NextRequest,NextResponse} from 'next/server';
import {TEAM_CODES} from '@/lib/weekly-center';
import {readAvailability} from '@/lib/server/availability-source';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

export async function GET(req:NextRequest){
 const team=req.nextUrl.searchParams.get('team')?.toUpperCase()||'';
 if(team&&!TEAM_CODES.has(team))
   return NextResponse.json({error:'Invalid NFL team'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{
  const snapshot=await readAvailability();
  // CDN cache key is scoped to the filtered request URL. No Neon queries.
  const players=team?snapshot.players.filter(p=>p.team===team):snapshot.players;
  return NextResponse.json({...snapshot,players},{headers:{
   'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=3600'
  }});
 }catch{
  return NextResponse.json({
   error:'Availability metadata is temporarily unavailable. Official injury reports remain available at NFL.com.',
   officialUrl:'https://www.nfl.com/injuries/'
  },{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
