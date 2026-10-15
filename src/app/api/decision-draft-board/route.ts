import {NextRequest,NextResponse} from 'next/server';
import {requireUser} from '@/lib/server/session';
import {getCurrentLeagueBySlug} from '@/lib/server/league-context';
import {getUserLeagues} from '@/lib/server/user-auth';
import {getDb} from '@/server/db/client';
import {sql} from 'drizzle-orm';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const headers={'Cache-Control':'private, no-store'};
 try{
  if(req.cookies.has('lz_qa_session'))return NextResponse.json({error:'Unavailable in QA mode'},{status:403,headers});
  const user=await requireUser();
  if(!user)return NextResponse.json({error:'Sign in'},{status:401,headers});
  const slug=req.nextUrl.searchParams.get('slug')||'';
  if(slug.length>100||!slug)return NextResponse.json({error:'Invalid league'},{status:400,headers});
  const league=await getCurrentLeagueBySlug(slug);
  if(!league)return NextResponse.json({error:'League not found'},{status:404,headers});
  const member=(await getUserLeagues(user.userId)).some(m=>m.leagueId===league.id);
  if(!member)return NextResponse.json({error:'Not a member of this league'},{status:403,headers});
  const year=Number(req.nextUrl.searchParams.get('classYear'));
  if(!Number.isInteger(year)||year<2027||year>2100)return NextResponse.json({error:'Invalid prospect year'},{status:400,headers});
  const result=await getDb().execute(sql`SELECT data FROM team_prospect_draftboard_state_v3
   WHERE league_id=${league.id}::uuid AND user_id=${user.userId}::uuid AND draft_class_year=${year} LIMIT 1`);
  const rows=(result as unknown as {rows?:{data:unknown}[]}).rows||[];
  return NextResponse.json({classYear:year,data:rows[0]?.data||null},{headers});
 }catch(e){
  console.warn('[decision-draft-board]',e instanceof Error?e.message:'unknown');
  return NextResponse.json({error:'Could not verify the saved board.'},{status:503,headers});
 }
}
