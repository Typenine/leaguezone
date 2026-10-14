import {unstable_cache} from 'next/cache';
import {normalizeSleeperPlayers,type AvailabilityPayload} from '@/lib/availability';

const SOURCE='https://api.sleeper.app/v1/players/nfl';
/** Sleeper explicitly says to retrieve this directory at most once daily.
 * Cache centrally rather than fetching it per page, team or user. */
export const readAvailability=unstable_cache(async ():Promise<AvailabilityPayload>=>{
 const response=await fetch(SOURCE,{cache:'no-store',signal:AbortSignal.timeout(20000),
  headers:{Accept:'application/json','User-Agent':'LeagueZone-Availability/1.0 (https://www.leaguezonehq.com)'}});
 if(!response.ok)throw Error('Availability source unavailable');
 const raw=await response.text();
 if(raw.length>20_000_000)throw Error('Availability directory exceeded limit');
 const parsed=JSON.parse(raw) as unknown;
 const players=normalizeSleeperPlayers(parsed);
 if(players.length<10)throw Error('Availability feed lacks usable status entries');
 return {
  source:'Sleeper' as const,sourceUrl:'https://docs.sleeper.com/',
  retrievedAt:new Date().toISOString(),
  totalReported:players.length,
  notice:'Sleeper player metadata, not the official NFL practice report. Fields may lag or be missing; absence of a listing does not confirm health or game availability.',
  players
 };
},['leaguezone-availability-sleeper-v1'],{revalidate:86400});
