import {getAllPlayersCached} from '@/lib/utils/sleeper-api';
import type {FantasyRostersData,FantasyPlayer} from '@/lib/providers/types';
import {taxiContextFromSleeper} from '@/lib/fantasy/taxi-context';

const ID=/^[0-9]{7,25}$/;
const USER=/^[0-9]+$/;
export function validLeagueId(id:unknown):id is string{
 return typeof id==='string'&&ID.test(id);
}
export function validSleeperUserId(id:unknown):id is string{
 return typeof id==='string'&&USER.test(id);
}
export type SleeperLeague={league_id:string;name:string;season:string;roster_positions:string[];
 scoring_settings:Record<string,number>;settings?:Record<string,unknown>;sport:string};
export type SleeperRoster={roster_id:number;owner_id:string|null;co_owners?:string[];players:string[]|null;taxi?:string[]|null;reserve?:string[]|null};
export type SleeperUser={user_id:string;display_name:string;metadata?:{team_name?:string}};
export function matchesUser(roster:SleeperRoster,userId:string):boolean{
 return roster.owner_id===userId||Boolean(roster.co_owners?.includes(userId));
}
async function endpoint<T>(path:string):Promise<T>{
 const result=await fetch('https://api.sleeper.app/v1/'+path,{
  signal:AbortSignal.timeout(9000),next:{revalidate:120},headers:{Accept:'application/json'}});
 if(!result.ok)throw Error(result.status===404?'Sleeper league was not found.':'Sleeper is temporarily unavailable.');
 return result.json() as Promise<T>;
}
export async function fetchLeagueContext(id:string){
 if(!validLeagueId(id))throw Error('Invalid Sleeper league ID.');
 const [league,rosters,users]=await Promise.all([
  endpoint<SleeperLeague>('league/'+id),
  endpoint<SleeperRoster[]>('league/'+id+'/rosters'),
  endpoint<SleeperUser[]>('league/'+id+'/users')]);
 if(league?.league_id!==id||league.sport!=='nfl'||!Array.isArray(rosters)||!Array.isArray(users))
  throw Error('Sleeper returned incomplete NFL league information.');
 const valid=rosters.filter(r=>Number.isInteger(r.roster_id)&&r.roster_id>0&&
  (typeof r.owner_id==='string'||Array.isArray(r.co_owners)));
 return {league,rosters:valid,users};
}
export async function previewSleeperTeams(leagueId:string,sleeperUserId:string){
 if(!validSleeperUserId(sleeperUserId))throw Error('Enter a valid Sleeper account.');
 const data=await fetchLeagueContext(leagueId);
 const teams=data.rosters.filter(r=>matchesUser(r,sleeperUserId));
 const nameOf=(r:SleeperRoster)=>{
  const user=data.users.find(u=>u.user_id===r.owner_id);
  return user?.metadata?.team_name?.trim()||user?.display_name?.trim()||'Roster '+r.roster_id;
 };
 return {leagueId,leagueName:data.league.name,season:Number(data.league.season),
  teams:teams.map(r=>({rosterId:r.roster_id,teamName:nameOf(r)}))};
}
type ResearchConnection={sleeperLeagueId:string;sleeperUserId:string;rosterId:number};
export async function researchSleeperRosters(connection:ResearchConnection){
 const data=await fetchLeagueContext(connection.sleeperLeagueId);
 if(!data.rosters.some(r=>r.roster_id===connection.rosterId&&matchesUser(r,connection.sleeperUserId)))
  throw Error('This team is no longer associated with the selected Sleeper username. Reconnect to update it.');
 const all=await getAllPlayersCached();
 const normalized:FantasyRostersData['players']={};
 const nameOf=(r:SleeperRoster)=>{
  const user=data.users.find(u=>u.user_id===r.owner_id);
  return user?.metadata?.team_name?.trim()||user?.display_name?.trim()||'Roster '+r.roster_id;
 };
 const teams:FantasyRostersData['teams']=data.rosters.map(r=>{
  const playerIds=(r.players||[]).filter(id=>typeof id==='string');
  for(const id of playerIds){
   const p=all[id];
   if(!p)continue;
   const first=p.first_name||null,last=p.last_name||null;
   normalized[id]={
    provider:'sleeper',playerId:id,providerPlayerId:id,firstName:first,lastName:last,
    fullName:[first,last].filter(Boolean).join(' ')||id,position:p.position||null,nflTeam:p.team||null,
   } as FantasyPlayer;
  }
  const owner=data.users.find(u=>u.user_id===r.owner_id);
  return {providerTeamId:String(r.roster_id),rosterId:r.roster_id,teamName:nameOf(r),
    ownerId:r.owner_id||'',ownerName:owner?.display_name||null,logoUrl:null,
    wins:0,losses:0,ties:0,fpts:0,fptsAgainst:0,players:playerIds};
 });
 // The published NFL stats use GSIS identifiers, not Sleeper identifiers.
 // Supply a bounded identity index to the already-tested ownership matcher.
 const catalog=Object.entries(all).filter(([,p])=>
  p.gsis_id&&p.position&&['QB','RB','WR','TE'].includes(p.position)&&p.team&&p.first_name&&p.last_name)
  .map(([id,p])=>({id,gsisId:p.gsis_id||null,
    name:p.first_name+' '+p.last_name,position:p.position||'',team:p.team||''}));
 const slots=(data.league.roster_positions||[]).filter(x=>!['BN','IR','TAXI','RESERVE'].includes(x));
 const ppr=Number(data.league.scoring_settings?.rec);
 return {rosters:{provider:'sleeper' as const,season:data.league.season,players:normalized,teams},
  catalog,viewerRosterId:connection.rosterId,starterSlots:slots,
  taxiContext:taxiContextFromSleeper({season:data.league.season,
   roster:data.rosters.find(r=>r.roster_id===connection.rosterId),
   settings:data.league.settings,rosterPositions:data.league.roster_positions,playerDirectory:all}),
  leaguePpr:Number.isFinite(ppr)?ppr:null,leagueName:data.league.name,
  teamName:teams.find(t=>t.rosterId===connection.rosterId)?.teamName||'My team'};
}
