import {NextRequest,NextResponse} from 'next/server';
import {csvRows,normalizeGames} from '@/lib/weekly-center';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// nflverse's maintained game schedule; public CDN response shared for fifteen minutes.
const URL='https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
const headers={'Cache-Control':'public, s-maxage=900, stale-while-revalidate=3600'};
export async function GET(request:NextRequest){
 const today=new Date(),defaultYear=today.getUTCMonth()>=7?today.getUTCFullYear():today.getUTCFullYear()-1;
 const year=Number(request.nextUrl.searchParams.get('season')||defaultYear);
 if(!Number.isInteger(year)||year<2020||year>defaultYear+1)
  return NextResponse.json({error:'Invalid season'},{status:400,headers});
 try{
  const response=await fetch(URL,{next:{revalidate:900},signal:AbortSignal.timeout(12000),
   headers:{'User-Agent':'LeagueZone/1.0 (https://leaguezonehq.com)',Accept:'text/csv'}});
  if(!response.ok)throw Error('schedule source unavailable');
  const text=await response.text();
  const games=normalizeGames(csvRows(text),year);
  return NextResponse.json({season:year,source:'nflverse / nfldata',sourceUrl:'https://github.com/nflverse/nfldata',
   fetchedAt:new Date().toISOString(),games},{headers});
 }catch{
  return NextResponse.json({error:'The NFL schedule is temporarily unavailable. No results were fabricated.',
   sourceUrl:'https://github.com/nflverse/nfldata'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
