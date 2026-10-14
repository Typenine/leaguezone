import {sql} from 'drizzle-orm';
import {getDb} from '@/server/db/client';
import {isCronAuthorized} from '@/lib/server/cron-auth';
import {publicVapidKey,sendPush} from '@/lib/server/web-push';
import {announcement,type ResearchCatalog} from '@/lib/server/research-push';
import source from '../../../../../public/research/data-source.json';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
type Row={id:string;endpoint:string;p256dh:string;auth_secret:string};
const BATCH=50, PARALLEL=10, TIME_BUDGET_MS=40_000;
const rowsOf=(result:unknown)=>(result as {rows?:Row[]}).rows||[];
export async function GET(req:Request){
 if(!isCronAuthorized(req))return Response.json({error:'Unauthorized'},{status:401});
 if(!publicVapidKey())return Response.json({error:'Push keys unavailable'},{status:503});
 try{
  const result=await fetch(source.publicBase+'/research/v1/catalog.json',{cache:'no-store'});
  if(!result.ok)throw Error('Research catalog unavailable');
  const target=announcement(await result.json() as ResearchCatalog);
  if(!('version' in target))return Response.json({ok:true,...target});
  const {year,week,version}=target, db=getDb(), started=Date.now();
  let delivered=0,failed=0,removed=0;
  while(Date.now()-started<TIME_BUDGET_MS){
   // Claim before sending: one atomic statement marks the batch, so an
   // overlapping or retried cron run cannot select the same devices again.
   const claimed=rowsOf(await db.execute(sql`WITH picked AS (
     SELECT id FROM leaguezone_push_subscriptions
     WHERE research_updates=true AND last_research_version IS DISTINCT FROM ${version}
     ORDER BY updated_at ASC LIMIT ${BATCH} FOR UPDATE SKIP LOCKED)
    UPDATE leaguezone_push_subscriptions s SET last_research_version=${version}
    FROM picked WHERE s.id=picked.id
    RETURNING s.id::text AS id,s.endpoint,s.p256dh,s.auth_secret`));
   if(!claimed.length)break;
   const expired:string[]=[],retry:string[]=[];
   for(let i=0;i<claimed.length;i+=PARALLEL){
    await Promise.all(claimed.slice(i,i+PARALLEL).map(async entry=>{
     try{
      const status=await sendPush({endpoint:entry.endpoint,p256dh:entry.p256dh,auth:entry.auth_secret},
       {title:'LeagueZone Research updated',body:'Week '+week+' research is available.',
        url:'/research/radar',tag:'leaguezone-research-'+version});
      if(status>=200&&status<300)delivered++;
      else if(status===404||status===410){removed++;expired.push(entry.id)}
      else{failed++;retry.push(entry.id)}
     }catch{failed++;retry.push(entry.id)}
    }));
   }
   if(expired.length)await db.execute(sql`DELETE FROM leaguezone_push_subscriptions WHERE id::text IN ${expired}`);
   // Transient failures are released for the next scheduled run, not retried now.
   if(retry.length)await db.execute(sql`UPDATE leaguezone_push_subscriptions SET last_research_version=NULL
    WHERE id::text IN ${retry} AND last_research_version=${version}`);
   if(claimed.length<BATCH||retry.length===claimed.length)break;
  }
  return Response.json({ok:true,year,week,delivered,failed,removed});
 }catch(error){
  console.error('[research-push]',error instanceof Error?error.message:'error');
  return Response.json({error:'Unable to deliver research notifications'},{status:503});
 }
}
