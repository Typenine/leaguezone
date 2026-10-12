import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { publicVapidKey,sendWebPush,endpointHash } from '@/lib/server/web-push';
import opportunityEngine from '../../../../../public/research/opportunities.js';
import source from '../../../../../public/research/data-source.json';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

type Row={user_id:string;data:unknown;endpoint:string;p256dh:string;auth:string};
type Signal={id:string;name:string;direction:'rising'|'falling';change:number;metric:string};
type Research={schema:number;year:number;throughWeek:number;updated:string;players:unknown[]};
type Catalog={schema:number;files:Record<string,{key:string;throughWeek:number;updated:string}>};

export async function GET(req:NextRequest){
  if(!process.env.CRON_SECRET||req.headers.get('authorization')!==('Bearer '+process.env.CRON_SECRET))
    return Response.json({error:'Unauthorized'},{status:401});
  if(!publicVapidKey())return Response.json({status:'disabled',reason:'VAPID not configured.'});
  try{
    // Consume only the published immutable public research snapshot.
    const base=String(process.env.RESEARCH_R2_PUBLIC_BASE||source.publicBase).replace(/\/+$/,'');
    if(!/^https:\/\/[^/]+$/.test(base))throw Error('Invalid research source.');
    const catalogResponse=await fetch(base+'/research/v1/catalog.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!catalogResponse.ok)throw Error('Research catalog unavailable.');
    const catalog=await catalogResponse.json() as Catalog;
    if(catalog.schema!==1||!catalog.files)throw Error('Research catalog invalid.');
    const year=Math.max(...Object.keys(catalog.files).map(Number).filter(y=>Number.isInteger(y)&&y>=2000&&y<=2100));
    if(!Number.isInteger(year))throw Error('No published research seasons.');
    const entry=catalog.files[String(year)];
    if(!entry||!/^research\/v1\/objects\/20\d\d-[a-f0-9]{64}\.json$/.test(entry.key))
      throw Error('Invalid published research key.');
    const response=await fetch(base+'/'+entry.key,{cache:'no-store',signal:AbortSignal.timeout(18000)});
    if(!response.ok)throw Error('Published research temporarily unavailable.');
    const data=await response.json() as Research;
    if(data.schema!==3||data.year!==year||data.throughWeek!==entry.throughWeek||
      data.updated!==entry.updated||!Array.isArray(data.players)||data.players.length<100)
      throw Error('Published research validation failed.');
    const signals=opportunityEngine.radar(data,'half') as Signal[];
    if(!signals.length)return Response.json({status:'no-signals',year,week:data.throughWeek});
    const byId=new Map(signals.map(signal=>[signal.id,signal]));
    const db=getDb();
    // Bounded, once-per-week fanout. This never queries Sleeper or league data.
    const result=await db.execute(sql`
      SELECT l.user_id::text AS user_id,l.data,s.endpoint,s.p256dh,s.auth
      FROM user_research_library l
      JOIN user_notification_preferences p ON p.user_id=l.user_id
      JOIN user_push_subscriptions s ON s.user_id=l.user_id
      WHERE p.enabled=true AND p.role_changes=true
        AND jsonb_typeof(l.data->'players')='array'
        AND jsonb_array_length(l.data->'players')>0
      ORDER BY l.user_id,s.endpoint_hash LIMIT 250
    `);
    const rows=(result as {rows?:Row[]}).rows||[];
    const groups=new Map<string,Row[]>();
    for(const row of rows){
      const group=groups.get(row.user_id)||[];
      group.push(row);groups.set(row.user_id,group);
    }
    let attempted=0,pushed=0;
    for(const [userId,devices] of groups){
      const dataRow=devices[0].data as {players?:Array<{id?:string}>};
      const watched=(Array.isArray(dataRow?.players)?dataRow.players:[])
        .map(p=>p.id?byId.get(p.id):undefined)
        .filter((value):value is Signal=>value!==undefined)
        .sort((a,b)=>Math.abs(b.change)-Math.abs(a.change));
      if(!watched.length)continue;
      const signal=watched[0];
      const claim=await db.execute(sql`
        INSERT INTO user_push_role_alerts(user_id,player_id,year,week,direction)
        VALUES(${userId}::uuid,${signal.id},${year},${data.throughWeek},${signal.direction})
        ON CONFLICT DO NOTHING RETURNING user_id
      `);
      if(!((claim as {rows?:unknown[]}).rows||[]).length)continue;
      attempted++;
      let succeeded=0;
      for(const device of devices){
        const payload={
          title:'LeagueZone Opportunity Radar',
          body:signal.name+': '+signal.direction+' '+signal.metric+
            ' ('+(signal.change>0?'+':'')+signal.change.toFixed(1)+'/game) through Week '+data.throughWeek+'.',
          url:'/research/players/'+encodeURIComponent(signal.id)+'?season='+year,
          tag:'leaguezone-role-'+year+'-'+data.throughWeek+'-'+signal.id
        };
        const delivery=await sendWebPush(device,payload);
        if(delivery.ok){pushed++;succeeded++;}
        if(delivery.gone){
          await db.execute(sql`DELETE FROM user_push_subscriptions
            WHERE user_id=${userId}::uuid AND endpoint_hash=${endpointHash(device.endpoint)}`);
        }
      }
      if(!succeeded){
        await db.execute(sql`DELETE FROM user_push_role_alerts
          WHERE user_id=${userId}::uuid AND player_id=${signal.id}
          AND year=${year} AND week=${data.throughWeek} AND direction=${signal.direction}`);
      }
    }
    return Response.json({status:'ok',year,week:data.throughWeek,accounts:groups.size,attempted,pushed});
  }catch(error){
    console.error('[research-alerts]',error instanceof Error?error.message:'Unknown error');
    return Response.json({error:'Alert delivery unavailable. No stale research signals sent.'},{status:503});
  }
}
