import {NextRequest,NextResponse} from 'next/server';
import {sql} from 'drizzle-orm';
import {getDb} from '@/server/db/client';
import {requireUser} from '@/lib/server/session';
import {MAX_SAVED,normalizeSaved,type SavedItem} from '@/lib/saved-research';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'private, no-store'};

async function account(req:NextRequest){
  // QA/impersonation must never change or read the real user's bookmarks.
  if (req.cookies.has('lz_qa_session')) return null;
  return requireUser();
}

function failure(error:string,status:number){
  return NextResponse.json({error},{status,headers});
}

async function payload(req:NextRequest):Promise<unknown>{
  const text=await req.text();
  if(text.length>85_000)throw Error('too_large');
  return JSON.parse(text);
}

function itemsFromDb(value:unknown):SavedItem[]{
  const rows=(value as {rows?:Array<Record<string,unknown>>}).rows||[];
  return rows.map(row=>normalizeSaved({
    key:row.item_key,
    type:row.item_type,
    title:row.title,
    href:row.href,
    savedAt: Number(row.saved_at_ms),
  })).filter((item):item is SavedItem=>Boolean(item));
}

export async function GET(req:NextRequest){
  const user=await account(req);
  if(!user)return failure('Sign in to sync saved research.',401);
  try{
    const db=getDb();
    const rows=await db.execute(sql`
      SELECT item_key,item_type,title,href,
        (extract(epoch FROM saved_at)*1000)::bigint AS saved_at_ms
      FROM leaguezone_saved_research WHERE user_id=${user.userId}::uuid
      ORDER BY saved_at DESC, item_key ASC LIMIT ${MAX_SAVED}`);
    return NextResponse.json({authenticated:true,userId:user.userId,items:itemsFromDb(rows)},{headers});
  }catch{
    return failure('Saved research is temporarily unavailable.',503);
  }
}

export async function POST(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin)return failure('Invalid origin.',403);
  const user=await account(req);
  if(!user)return failure('Sign in to sync saved research.',401);
  let body:unknown;
  try{body=await payload(req)}catch{return failure('Invalid or oversized request.',400)}
  if(!body||typeof body!=='object')return failure('Invalid request.',400);
  const data=body as {item?:unknown;import?:unknown};
  const db=getDb();

  if(data.import!==undefined){
    if(!Array.isArray(data.import)||data.import.length>MAX_SAVED)return failure('Import must contain at most 100 items.',400);
    const unique=new Map<string,SavedItem>();
    for(const input of data.import){
      const item=normalizeSaved(input);
      if(!item)return failure('Invalid item in saved research import.',400);
      if(!unique.has(item.key))unique.set(item.key,item);
    }
    if(!unique.size)return NextResponse.json({ok:true,imported:0},{headers});
    const serialized=JSON.stringify([...unique.values()]);
    try{
      // One indexed insert, with a hard per-user cap. Existing account data
      // wins over legacy local copies. Import cannot override deletions in
      // another device unless explicitly reimported by its owner.
      const result=await db.execute(sql`
        INSERT INTO leaguezone_saved_research (user_id,item_key,item_type,title,href,saved_at)
        SELECT ${user.userId}::uuid,x.key,x.type,x.title,x.href,to_timestamp(x."savedAt"/1000.0)
        FROM jsonb_to_recordset(${serialized}::jsonb)
          AS x(key text,type text,title text,href text,"savedAt" bigint)
        WHERE NOT EXISTS (
          SELECT 1 FROM leaguezone_saved_research saved
          WHERE saved.user_id=${user.userId}::uuid AND saved.item_key=x.key
        )
        ORDER BY x."savedAt" DESC
        LIMIT GREATEST(0,${MAX_SAVED}-(SELECT count(*)::int FROM leaguezone_saved_research
          WHERE user_id=${user.userId}::uuid))
        ON CONFLICT (user_id,item_key) DO NOTHING
        RETURNING item_key`);
      const inserted=(result as unknown as {rows?:unknown[]}).rows?.length||0;
      return NextResponse.json({ok:true,imported:inserted},{headers});
    }catch{return failure('Could not import saved research.',503)}
  }

  const item=normalizeSaved(data.item);
  if(!item)return failure('Invalid saved research item.',400);
  try{
    const result=await db.execute(sql`
      INSERT INTO leaguezone_saved_research(user_id,item_key,item_type,title,href,saved_at)
      SELECT ${user.userId}::uuid,${item.key},${item.type},${item.title},${item.href},now()
      WHERE (SELECT count(*) FROM leaguezone_saved_research
        WHERE user_id=${user.userId}::uuid)<${MAX_SAVED}
        OR EXISTS(SELECT 1 FROM leaguezone_saved_research
          WHERE user_id=${user.userId}::uuid AND item_key=${item.key})
      ON CONFLICT(user_id,item_key) DO UPDATE SET
        title=EXCLUDED.title, href=EXCLUDED.href, saved_at=now()
      RETURNING item_key`);
    if(!(result as unknown as {rows?:unknown[]}).rows?.length)
      return failure('Watchlist limit reached (100 saved items).',409);
    return NextResponse.json({ok:true,item},{headers});
  }catch{return failure('Could not save research.',503)}
}

export async function DELETE(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin)return failure('Invalid origin.',403);
  const user=await account(req);
  if(!user)return failure('Sign in to manage saved research.',401);
  let body:unknown;
  try{body=await payload(req)}catch{return failure('Invalid request.',400)}
  const key=body&&typeof body==='object'?(body as {key?:unknown}).key:null;
  if(typeof key!=='string'||key.length>850||!(/^(player:|view:)/.test(key)))
    return failure('Invalid saved research key.',400);
  try{
    await getDb().execute(sql`
      DELETE FROM leaguezone_saved_research
      WHERE user_id=${user.userId}::uuid AND item_key=${key}`);
    return NextResponse.json({ok:true},{headers});
  }catch{return failure('Could not remove saved research.',503)}
}
