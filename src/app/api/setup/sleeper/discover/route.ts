import {NextRequest,NextResponse} from 'next/server';
import {requireUser} from '@/lib/server/session';
import {rateLimitByIpStrict} from '@/lib/server/rate-limit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
 const user=await requireUser();
 if(!user)return NextResponse.json({error:'Sign in to find your Sleeper leagues.'},{status:401});
 const username=(request.nextUrl.searchParams.get('username')||'').trim();
 if(!/^[\w-]{2,30}$/.test(username))
   return NextResponse.json({error:'Enter your Sleeper username (2–30 letters, numbers, dashes or underscores).'},{status:400});
 const ip=request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 const limit=await rateLimitByIpStrict(ip,'sleeper-discover',{maxRequests:20,windowSeconds:300});
 if(!limit.allowed)return NextResponse.json({error:'Too many searches. Try again later.'},{status:429});
 const year=new Date().getUTCFullYear();
 try{
  const response=await fetch('https://api.sleeper.app/v1/user/'+encodeURIComponent(username),{
   signal:AbortSignal.timeout(8000),next:{revalidate:300}});
  if(response.status===404)return NextResponse.json({error:'No Sleeper account found for that username.'},{status:404});
  if(!response.ok)throw Error('Sleeper unavailable');
  const player=await response.json() as {user_id?:string;display_name?:string};
  if(!/^[0-9]+$/.test(player.user_id||''))throw Error('Unexpected Sleeper response');
  const results=await Promise.allSettled([year,year-1].map(async season=>{
   const r=await fetch('https://api.sleeper.app/v1/user/'+encodeURIComponent(player.user_id!)+'/leagues/nfl/'+season,{
    signal:AbortSignal.timeout(8000),next:{revalidate:120}});
   if(!r.ok)throw Error('Year unavailable');
   const data=await r.json() as Array<{league_id:string;name:string;season:string;total_rosters?:number}>;
   return Array.isArray(data)?data.filter(l=>/^\d+$/.test(l.league_id)&&Number(l.season)===season)
    .map(l=>({leagueId:l.league_id,name:l.name,season,lrosters:l.total_rosters??null})): [];
  }));
  const leagues=results.flatMap(result=>result.status==='fulfilled'?result.value:[]);
  if(!leagues.length&&results.every(result=>result.status==='rejected'))
   return NextResponse.json({error:'Sleeper leagues could not be loaded. You can still paste a league URL or ID.'},{status:502});
  return NextResponse.json({username:player.display_name||username,leagues},{
   headers:{'Cache-Control':'private, max-age=60'}});
 }catch{
  return NextResponse.json({error:'Sleeper is temporarily unavailable. Try pasting your league URL or ID.'},{status:502});
 }
}
