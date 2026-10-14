import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/lib/server/session';
import { getUserLeagues } from '@/lib/server/user-auth';
import { normalizeDashboardPreferences } from '@/lib/dashboard-preferences';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store'};
function respond(error:string,status:number){return NextResponse.json({error},{status,headers:privateHeaders});}
async function account(req:NextRequest){
  // QA impersonation must never expose or modify the real account's preferences.
  if(req.cookies.has('lz_qa_session'))return null;
  return requireUser();
}
export async function GET(req:NextRequest){
  const user=await account(req);
  if(!user)return respond('Sign in to load dashboard settings.',401);
  try{
    const res=await getDb().execute(sql`
      SELECT preferences FROM leaguezone_dashboard_preferences
      WHERE user_id=${user.userId}::uuid LIMIT 1
    `);
    const row=(res as unknown as {rows?:Array<{preferences:unknown}>}).rows?.[0];
    return NextResponse.json({userId:user.userId,preferences:normalizeDashboardPreferences(row?.preferences)},{headers:privateHeaders});
  }catch{return respond('Dashboard settings are temporarily unavailable.',503);}
}
export async function PUT(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin)return respond('Invalid origin.',403);
  const user=await account(req);
  if(!user)return respond('Sign in to save dashboard settings.',401);
  let body:unknown;
  try{
    const raw=await req.text();
    if(raw.length>4_000)return respond('Settings request is too large.',413);
    body=JSON.parse(raw);
  }catch{return respond('Invalid settings request.',400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return respond('Invalid settings request.',400);
  const prefs=normalizeDashboardPreferences(body);
  try{
    if(prefs.favoriteLeagueId){
      const leagues=await getUserLeagues(user.userId);
      if(!leagues.some(l=>l.leagueId===prefs.favoriteLeagueId))return respond('The selected league is not linked to your account.',403);
    }
    const value=JSON.stringify(prefs);
    await getDb().execute(sql`
      INSERT INTO leaguezone_dashboard_preferences(user_id,preferences,updated_at)
      VALUES (${user.userId}::uuid,${value}::jsonb,now())
      ON CONFLICT (user_id) DO UPDATE SET preferences=EXCLUDED.preferences,updated_at=now()
    `);
    return NextResponse.json({ok:true,preferences:prefs},{headers:privateHeaders});
  }catch{return respond('Could not save dashboard settings.',503);}
}
