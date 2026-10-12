import {NextRequest,NextResponse} from 'next/server';
import {sql} from 'drizzle-orm';
import {getDb} from '@/server/db/client';
import {requireUser} from '@/lib/server/session';
import {publicVapidKey,validateDevice,type Device} from '@/lib/server/web-push';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store'};
export async function GET(){
 const publicKey=publicVapidKey();
 const user=await requireUser();
 if(!user)return NextResponse.json({publicKey,registered:[]},{headers:noStore});
 try{
  const result=await getDb().execute(sql`SELECT endpoint FROM leaguezone_push_subscriptions
   WHERE user_id=${user.userId}::uuid AND research_updates=true`);
  const registered=(result as unknown as {rows?:Array<{endpoint:string}>}).rows?.map(r=>r.endpoint)||[];
  return NextResponse.json({publicKey,registered},{headers:noStore});
 }catch{return NextResponse.json({publicKey,registered:[]},{headers:noStore})}
}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==new URL(req.url).origin)
  return NextResponse.json({error:'Invalid origin'},{status:403,headers:noStore});
 const user=await requireUser();
 if(!user)return NextResponse.json({error:'Sign in to enable notifications'},{status:401,headers:noStore});
 if(!publicVapidKey())return NextResponse.json({error:'Notifications are not configured on this deployment'},{status:503,headers:noStore});
 let body:{subscription?:{endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}};researchUpdates?:unknown};
 try{body=await req.json()}catch{return NextResponse.json({error:'Invalid payload'},{status:400,headers:noStore})}
 const candidate=body.subscription;
 const device:Device={endpoint:String(candidate?.endpoint||''),p256dh:String(candidate?.keys?.p256dh||''),auth:String(candidate?.keys?.auth||'')};
 if(!validateDevice(device)||typeof body.researchUpdates!=='boolean')
  return NextResponse.json({error:'Invalid push subscription'},{status:400,headers:noStore});
 try{
  const db=getDb();
  const count=await db.execute(sql`SELECT count(*)::int AS n FROM leaguezone_push_subscriptions WHERE user_id=${user.userId}::uuid`);
  const n=Number((count as unknown as {rows?:Array<{n:number}>}).rows?.[0]?.n||0);
  if(n>=5){
   const known=await db.execute(sql`SELECT id FROM leaguezone_push_subscriptions
      WHERE user_id=${user.userId}::uuid AND endpoint=${device.endpoint} LIMIT 1`);
   if(!(known as {rows?:unknown[]}).rows?.length)
    return NextResponse.json({error:'Maximum five notification devices per account'},{status:409,headers:noStore});
  }
  const result=await db.execute(sql`INSERT INTO leaguezone_push_subscriptions
   (user_id,endpoint,p256dh,auth_secret,research_updates)
   VALUES (${user.userId}::uuid,${device.endpoint},${device.p256dh},${device.auth},${body.researchUpdates})
   ON CONFLICT(endpoint) DO UPDATE SET
    p256dh=EXCLUDED.p256dh,auth_secret=EXCLUDED.auth_secret,
    research_updates=EXCLUDED.research_updates,updated_at=now()
   WHERE leaguezone_push_subscriptions.user_id=EXCLUDED.user_id RETURNING id`);
  if(!(result as {rows?:unknown[]}).rows?.length)
   return NextResponse.json({error:'This device is already registered to another account'},{status:409,headers:noStore});
  return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Notification settings unavailable'},{status:503,headers:noStore})}
}
export async function DELETE(req:NextRequest){
 if(req.headers.get('origin')!==new URL(req.url).origin)
  return NextResponse.json({error:'Invalid origin'},{status:403,headers:noStore});
 const user=await requireUser();
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401,headers:noStore});
 let body:{endpoint?:string};
 try{body=await req.json()}catch{return NextResponse.json({error:'Invalid payload'},{status:400,headers:noStore})}
 if(typeof body.endpoint!=='string'||body.endpoint.length>2048)
  return NextResponse.json({error:'Invalid endpoint'},{status:400,headers:noStore});
 try{
  await getDb().execute(sql`DELETE FROM leaguezone_push_subscriptions
   WHERE user_id=${user.userId}::uuid AND endpoint=${body.endpoint}`);
  return NextResponse.json({ok:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Notification settings unavailable'},{status:503,headers:noStore})}
}
