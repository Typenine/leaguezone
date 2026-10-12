import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
type Player = { id:string; name:string; year:number };
type View = { name:string; url:string };

function clean(data:unknown) {
  if (!data || typeof data!=='object' || Array.isArray(data)) return null;
  const p=data as Record<string,unknown>;
  if (!Array.isArray(p.players)||!Array.isArray(p.views)||p.players.length>80||p.views.length>20) return null;
  const players:Player[]=[],views:View[]=[],ids=new Set<string>(),urls=new Set<string>();
  for(const val of p.players){
    if(!val||typeof val!=='object')return null;
    const x=val as Record<string,unknown>;
    if(typeof x.id!=='string'||!/^[\w-]{1,70}$/.test(x.id)||typeof x.name!=='string'||
      !x.name.trim()||x.name.length>100||!Number.isInteger(x.year)||Number(x.year)<2000||Number(x.year)>2100)return null;
    if(!ids.has(x.id)){ids.add(x.id);players.push({id:x.id,name:x.name.trim(),year:Number(x.year)});}
  }
  for(const val of p.views){
    if(!val||typeof val!=='object')return null;
    const x=val as Record<string,unknown>;
    if(typeof x.name!=='string'||!x.name.trim()||x.name.length>100||typeof x.url!=='string'||
      x.url.length>500||!/^\/research(?:\/|\?|$)/.test(x.url)||x.url.startsWith('//')||/[\r\n]/.test(x.url))return null;
    if(!urls.has(x.url)){urls.add(x.url);views.push({name:x.name.trim(),url:x.url});}
  }
  const updatedAt=Number(p.updatedAt);
  if(!Number.isSafeInteger(updatedAt)||updatedAt<0||updatedAt>Date.now()+86400000)return null;
  return {players,views,updatedAt};
}

export async function GET(){
  const session=await requireUser();
  if(!session)return Response.json({error:'Sign in required.'},{status:401,headers});
  try{
    const db=getDb();
    const result=await db.execute(sql`SELECT data FROM user_research_library WHERE user_id=${session.userId}::uuid LIMIT 1`);
    const row=(result as {rows?:Array<{data:unknown}>}).rows?.[0];
    return Response.json(clean(row?.data)||{players:[],views:[],updatedAt:0},{headers});
  }catch{return Response.json({error:'Saved research temporarily unavailable.'},{status:503,headers});}
}

export async function PUT(req:NextRequest){
  const session=await requireUser();
  if(!session)return Response.json({error:'Sign in required.'},{status:401,headers});
  const origin=req.headers.get('origin');
  if(origin&&origin!==req.nextUrl.origin)return Response.json({error:'Invalid origin.'},{status:403,headers});
  if(!req.headers.get('content-type')?.startsWith('application/json'))
    return Response.json({error:'JSON required.'},{status:415,headers});
  const raw=await req.text();
  if(raw.length>30000)return Response.json({error:'Save limit exceeded.'},{status:413,headers});
  let data:unknown;
  try{data=JSON.parse(raw);}catch{return Response.json({error:'Invalid JSON.'},{status:400,headers});}
  const item=clean(data);
  if(!item)return Response.json({error:'Invalid saved research.'},{status:400,headers});
  try{
    const db=getDb();
    await db.execute(sql`
      INSERT INTO user_research_library(user_id,data)
      VALUES(${session.userId}::uuid,${JSON.stringify(item)}::jsonb)
      ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()
    `);
    return Response.json({ok:true},{headers});
  }catch{return Response.json({error:'Save unavailable, keep your device copy.'},{status:503,headers});}
}
