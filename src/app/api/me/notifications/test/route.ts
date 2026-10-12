import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/lib/server/session';
import { sendWebPush,publicVapidKey,endpointHash } from '@/lib/server/web-push';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
  const session=await requireUser();
  if(!session)return Response.json({error:'Sign in required.'},{status:401});
  if(req.headers.get('origin')&&req.headers.get('origin')!==req.nextUrl.origin)
    return Response.json({error:'Invalid origin.'},{status:403});
  if(!publicVapidKey())return Response.json({error:'Push not configured.'},{status:503});
  const raw=await req.text();
  if(raw.length>3000)return Response.json({error:'Invalid request.'},{status:400});
  let endpoint='';
  try{endpoint=JSON.parse(raw)?.endpoint||'';}catch{}
  if(typeof endpoint!=='string'||!endpoint)return Response.json({error:'Endpoint required.'},{status:400});
  try{
    const db=getDb(),hash=endpointHash(endpoint);
    const result=await db.execute(sql`
      UPDATE user_push_subscriptions SET last_test_at=now()
      WHERE endpoint_hash=${hash} AND user_id=${session.userId}::uuid
       AND (last_test_at IS NULL OR last_test_at < now()-interval '1 minute')
      RETURNING endpoint,p256dh,auth
    `);
    const row=(result as {rows?:Array<{endpoint:string;p256dh:string;auth:string}>}).rows?.[0];
    if(!row)return Response.json({error:'No eligible subscription or test was recently sent.'},{status:429});
    const sent=await sendWebPush(row,{title:'LeagueZone test',body:'Notifications are connected to LeagueZone.',url:'/settings/notifications',tag:'leaguezone-test'});
    if(sent.gone)await db.execute(sql`DELETE FROM user_push_subscriptions
      WHERE endpoint_hash=${hash} AND user_id=${session.userId}::uuid`);
    return Response.json({ok:sent.ok,error:sent.ok?null:'Push provider rejected the request.'},{status:sent.ok?200:502});
  }catch{return Response.json({error:'Test notification failed.'},{status:503});}
}
