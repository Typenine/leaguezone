import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/lib/server/session';
import { publicVapidKey,validSubscription,endpointHash } from '@/lib/server/web-push';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const error=(message:string,status:number)=>Response.json({error:message},{status,headers});
const originValid=(req:NextRequest)=>!req.headers.get('origin')||req.headers.get('origin')===req.nextUrl.origin;
async function body(req:NextRequest):Promise<Record<string,unknown>|null>{
  if(!req.headers.get('content-type')?.startsWith('application/json'))return null;
  const raw=await req.text();
  if(raw.length>5000)return null;
  try{const b=JSON.parse(raw);return b&&!Array.isArray(b)&&typeof b==='object'?b:null;}catch{return null;}
}
export async function GET(){
  const session=await requireUser();
  if(!session)return error('Sign in required.',401);
  try{
    const db=getDb();
    const prefs=await db.execute(sql`SELECT enabled,role_changes FROM user_notification_preferences
      WHERE user_id=${session.userId}::uuid LIMIT 1`);
    const subs=await db.execute(sql`SELECT COUNT(*)::int AS count FROM user_push_subscriptions
      WHERE user_id=${session.userId}::uuid`);
    const row=(prefs as unknown as unknown as {rows?:Array<{enabled:boolean;role_changes:boolean}>}).rows?.[0];
    const count=(subs as unknown as unknown as {rows?:Array<{count:number}>}).rows?.[0]?.count||0;
    return Response.json({configured:!!publicVapidKey(),publicKey:publicVapidKey(),
      enabled:row?.enabled||false,roleChanges:row?.role_changes??true,subscribed:count>0},{headers});
  }catch{return error('Notification settings unavailable.',503);}
}
export async function PUT(req:NextRequest){
  const session=await requireUser();
  if(!session)return error('Sign in required.',401);
  if(!originValid(req))return error('Invalid origin.',403);
  const b=await body(req);
  if(!b||typeof b.enabled!=='boolean'||typeof b.roleChanges!=='boolean')return error('Invalid settings.',400);
  try{
    const db=getDb();
    await db.execute(sql`INSERT INTO user_notification_preferences(user_id,enabled,role_changes)
      VALUES(${session.userId}::uuid,${b.enabled},${b.roleChanges})
      ON CONFLICT(user_id) DO UPDATE SET
       enabled=EXCLUDED.enabled,role_changes=EXCLUDED.role_changes,updated_at=now()`);
    return Response.json({ok:true},{headers});
  }catch{return error('Could not save settings.',503);}
}
export async function POST(req:NextRequest){
  const session=await requireUser();
  if(!session)return error('Sign in required.',401);
  if(!originValid(req))return error('Invalid origin.',403);
  if(!publicVapidKey())return error('Push is not configured.',503);
  const b=await body(req),item=b?.subscription as {endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}}|undefined;
  if(!item||typeof item.endpoint!=='string'||typeof item.keys?.p256dh!=='string'||typeof item.keys?.auth!=='string')return error('Invalid subscription.',400);
  const sub={endpoint:item.endpoint,p256dh:item.keys.p256dh,auth:item.keys.auth};
  if(!validSubscription(sub))return error('Unsupported push provider or invalid keys.',400);
  try{
    const db=getDb();
    await db.execute(sql`INSERT INTO user_push_subscriptions(endpoint_hash,user_id,endpoint,p256dh,auth)
      VALUES(${endpointHash(sub.endpoint)},${session.userId}::uuid,${sub.endpoint},${sub.p256dh},${sub.auth})
      ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=EXCLUDED.user_id,
       endpoint=EXCLUDED.endpoint,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,last_seen_at=now()`);
    await db.execute(sql`INSERT INTO user_notification_preferences(user_id,enabled)
      VALUES(${session.userId}::uuid,true)
      ON CONFLICT(user_id) DO UPDATE SET enabled=true,updated_at=now()`);
    return Response.json({ok:true},{headers});
  }catch{return error('Push subscription could not be saved.',503);}
}
export async function DELETE(req:NextRequest){
  const session=await requireUser();
  if(!session)return error('Sign in required.',401);
  if(!originValid(req))return error('Invalid origin.',403);
  const b=await body(req);
  if(!b||typeof b.endpoint!=='string')return error('Endpoint required.',400);
  try{
    const db=getDb();
    await db.execute(sql`DELETE FROM user_push_subscriptions
      WHERE user_id=${session.userId}::uuid AND endpoint_hash=${endpointHash(b.endpoint)}`);
    await db.execute(sql`UPDATE user_notification_preferences SET enabled=false,updated_at=now()
      WHERE user_id=${session.userId}::uuid
      AND NOT EXISTS(SELECT 1 FROM user_push_subscriptions WHERE user_id=${session.userId}::uuid)`);
    return Response.json({ok:true},{headers});
  }catch{return error('Could not remove subscription.',503);}
}
