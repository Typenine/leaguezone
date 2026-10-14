import {NextRequest,NextResponse} from 'next/server';
import {TEAM_CODES,csvRows,newestDepth} from '@/lib/weekly-center';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'public, s-maxage=14400, stale-while-revalidate=86400'};
export async function GET(request:NextRequest){
 const team=(request.nextUrl.searchParams.get('team')||'').toUpperCase();
 if(!TEAM_CODES.has(team))return NextResponse.json({error:'Invalid NFL team'},{status:400});
 const now=new Date(),year=Number(request.nextUrl.searchParams.get('season')||(now.getUTCMonth()>=7?now.getUTCFullYear():now.getUTCFullYear()-1));
 if(!Number.isInteger(year)||year<2025||year>now.getUTCFullYear()+1)
  return NextResponse.json({error:'Invalid season'},{status:400});
 try{
  const url='https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_'+year+'.csv';
  const response=await fetch(url,{next:{revalidate:14400},signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw Error('depth chart source unavailable');
  const source=await response.text();
  const result=newestDepth(csvRows(source,'dt'),team);
  if(!result.updated||!result.players.length)throw Error('depth chart unavailable');
  return NextResponse.json({...result,team,year,source:'nflverse depth charts',sourceUrl:'https://github.com/nflverse/nflverse-data/releases/tag/depth_charts',
   note:'Listed rank is not verified playing time or an official injury designation.'},{headers});
 }catch{
  return NextResponse.json({error:'No verified depth-chart snapshot is available for this team right now.',
   sourceUrl:'https://github.com/nflverse/nflverse-data/releases/tag/depth_charts'},
   {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
