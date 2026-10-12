import {sql} from 'drizzle-orm';
import {getDb} from '@/server/db/client';
import {isCronAuthorized} from '@/lib/server/cron-auth';
import {publicVapidKey,sendPush} from '@/lib/server/web-push';
import source from '../../../../../public/research/data-source.json';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
type Row={id:string;endpoint:string;p256dh:string;auth_secret:string};
export async function GET(req:Request){
 if(!isCronAuthorized(req))return Response.json({error:'Unauthorized'},{status:401});
 if(!publicVapidKey())return Response.json({error:'Push keys unavailable'},{status:503});
 try{
  const result=await fetch(source.publicBase+'/research/v1/catalog.json',{cache:'no-store'});
  if(!result.ok)throw Error('Research catalog unavailable');
  const catalog=await result.json() as {schema:number;files:Record<string,{throughWeek:number}>};
  if(catalog.schema!==1||!catalog.files)throw Error('Invalid catalog');
  const year=Math.max(...Object.keys(catalog.files).map(Number).filter(Number.isInteger));
  const week=catalog.files[String(year)]?.throughWeek;
  if(!Number.isInteger(week)||week<1||week>18||year<2020||year>new Date().getUTCFullYear()+1)
   return Response.json({ok:true,skipped:'no_validated_week'});
  const version=year+':'+week, db=getDb();
  const rows=await db.execute(sql`SELECT id::text,endpoint,p256dh,auth_secret FROM leaguezone_push_subscriptions
   WHERE research_updates=true AND last_research_version IS DISTINCT FROM ${version}
   ORDER BY updated_at ASC LIMIT 30`);
  let delivered=0,failed=0,removed=0;
  for(const entry of (rows as unknown as {rows?:Row[]}).rows||[]){
   try{
    const response=await sendPush({endpoint:entry.endpoint,p256dh:entry.p256dh,auth:entry.auth_secret},
     {title:'LeagueZone Research updated',body:'Week '+week+' research is available.',
      url:'/research/radar',tag:'leaguezone-research-'+version});
    if(response>=200&&response<300){
     delivered++;
     await db.execute(sql`UPDATE leaguezone_push_subscriptions SET
      last_research_version=${version},updated_at=now() WHERE id=${entry.id}::uuid`);
    }else if(response===404||response===410){
     removed++;
     await db.execute(sql`DELETE FROM leaguezone_push_subscriptions WHERE id=${entry.id}::uuid`);
    }else failed++;
   }catch{failed++}
  }
  return Response.json({ok:true,year,week,delivered,failed,removed});
 }catch(error){
  console.error('[research-push]',error instanceof Error?error.message:'error');
  return Response.json({error:'Unable to deliver research notifications'},{status:503});
 }
}
