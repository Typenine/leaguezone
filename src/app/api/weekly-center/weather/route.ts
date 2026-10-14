import {NextRequest,NextResponse} from 'next/server';
import {csvRows} from '@/lib/weekly-center';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const NWS='https://api.weather.gov';
const STADIUMS='https://raw.githubusercontent.com/greerreNFL/stadiums/main/data/stadiums.csv';
const headers={'Cache-Control':'public, s-maxage=1800, stale-while-revalidate=1800'};
function eq(a:string,b:string){return a.toLowerCase().replace(/[^a-z0-9]/g,'')===b.toLowerCase().replace(/[^a-z0-9]/g,'')}
export async function GET(req:NextRequest){
 const stadium=(req.nextUrl.searchParams.get('stadium')||'').trim();
 const kickoff=req.nextUrl.searchParams.get('kickoff')||'';
 const kickoffTime=Date.parse(kickoff),now=Date.now();
 if(!stadium||stadium.length>90||!/^[\w .&'()-]+$/.test(stadium)||!Number.isFinite(kickoffTime)||
     kickoffTime<now-6*3600_000||kickoffTime>now+7*86400_000)
  return NextResponse.json({error:'No NWS game-time forecast is available for this date or location.'},{status:400});
 try{
  const locations=await fetch(STADIUMS,{next:{revalidate:7*86400},signal:AbortSignal.timeout(12000)});
  if(!locations.ok)throw Error('stadium location source unavailable');
  const found=csvRows(await locations.text(),'stadium_name')
   .filter(r=>eq(r.stadium_name||'',stadium)&&r.country==='United States')
   .sort((a,b)=>(b.last_game_date||'').localeCompare(a.last_game_date||''))[0];
  if(!found) return NextResponse.json({error:'Weather is unavailable for this stadium. Overseas games are not covered by NWS.',
    source:'National Weather Service'},{status:404});
  const lat=Number(found.lat),lon=Number(found.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<18||lat>72||lon < -170||lon > -60)
   throw Error('Invalid stadium coordinates');
  const opts={next:{revalidate:86400},signal:AbortSignal.timeout(10000),headers:{
   'User-Agent':'LeagueZone (https://www.leaguezonehq.com)',Accept:'application/geo+json'
  }};
  const point=await fetch(NWS+'/points/'+lat.toFixed(4)+','+lon.toFixed(4),opts);
  if(!point.ok)throw Error('NWS point service unavailable');
  const metadata=await point.json() as {properties?:{forecastHourly?:string}};
  const url=metadata.properties?.forecastHourly;
  if(!url||!url.startsWith(NWS+'/gridpoints/'))throw Error('NWS forecast link unavailable');
  const forecast=await fetch(url,{next:{revalidate:1800},signal:AbortSignal.timeout(10000),headers:{
   'User-Agent':'LeagueZone (https://www.leaguezonehq.com)',Accept:'application/geo+json'}});
  if(!forecast.ok)throw Error('NWS hourly forecast unavailable');
  const json=await forecast.json() as {properties?:{periods?:Array<{
   startTime:string;endTime:string;temperature:number;temperatureUnit:string;windSpeed:string;
   windDirection:string;shortForecast:string;probabilityOfPrecipitation?:{value:number|null};
   isDaytime:boolean}>}};
  const period=json.properties?.periods?.find(p=>Date.parse(p.startTime)<=kickoffTime&&Date.parse(p.endTime)>kickoffTime);
  if(!period)return NextResponse.json({error:'The requested kickoff is outside the available forecast window.',
    source:'National Weather Service'},{status:404});
  return NextResponse.json({stadium,at:period.startTime,temperature:period.temperature,
   unit:period.temperatureUnit,wind:period.windSpeed,direction:period.windDirection,
   conditions:period.shortForecast,precipitation:period.probabilityOfPrecipitation?.value??null,
   source:'National Weather Service',sourceUrl:'https://www.weather.gov/documentation/services-web-api',
   notice:'Forecast, not an observation. Wind is not a fantasy-point projection.'},{headers});
 }catch{
  return NextResponse.json({error:'National Weather Service forecast unavailable; try again later.',
   source:'National Weather Service'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
