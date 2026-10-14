import { NextRequest, NextResponse } from 'next/server';
import {verifySession} from '@/lib/server/auth';
import {getUserLeagues} from '@/lib/server/user-auth';
import {getCurrentLeagueBySlug} from '@/lib/server/league-context';
import {getFantasyRostersResult} from '@/lib/server/fantasy-data';
import {buildProviderTeamLineupOptimizer} from '@/lib/fantasy/provider-projections';
import {guardPublicDataRequest} from '@/lib/server/public-api-guard';
import type {LineupOptimizerResponse} from '@/lib/fantasy/lineup-types';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const CACHE_MS=10*60*1000;
const cache=new Map<string,{time:number;value:LineupOptimizerResponse}>();

export async function GET(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const guard=await guardPublicDataRequest(request,{action:'personalized-lineup',requireBrowserGate:true,
   limit:{maxRequests:12,windowSeconds:5*60}});
 if(guard)return guard;
 const {slug}=await params;
 const league=await getCurrentLeagueBySlug(slug);
 if(!league)return NextResponse.json({error:'League not found.'},{status:404});
 const claims=verifySession(request.cookies.get('evw_session')?.value||'');
 if(!claims||claims.type!=='user'||typeof claims.sub!=='string')
   return NextResponse.json({error:'Sign in to view your lineup.'},{status:401});
 const membership=(await getUserLeagues(claims.sub)).find(item=>item.leagueId===league.id);
 if(!membership)return NextResponse.json({error:'Not a member of this league.'},{status:403});
 if(membership.rosterId==null)
   return NextResponse.json({error:'Claim a team roster to view personalized lineup guidance.'},{status:403});
 try {
  const rosters=await getFantasyRostersResult(league.id);
  const team=rosters.value.teams.find(t=>t.rosterId===membership.rosterId);
  if(!team)return NextResponse.json({error:'Your assigned team was not found in the current roster snapshot.'},{status:404});
  const key=league.id+':'+membership.rosterId+':'+rosters.value.season;
  const now=Date.now(),existing=cache.get(key);
  if(existing&&now-existing.time<CACHE_MS)
    return NextResponse.json(existing.value,{headers:{'Cache-Control':'private, no-store'}});
  const data=await buildProviderTeamLineupOptimizer(league.id,team.teamName);
  if(cache.size>100)cache.clear();
  cache.set(key,{time:now,value:data});
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  console.error('[personalized-lineup]',error instanceof Error?error.message:'Failure');
  return NextResponse.json({error:'Lineup projections are temporarily unavailable.'},{status:502});
 }
}
