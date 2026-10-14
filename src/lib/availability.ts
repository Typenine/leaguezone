import {TEAM_CODES} from '@/lib/weekly-center';

export type Practice='DNP'|'Limited'|'Full'|'Other';
export type AvailabilityPlayer={
  sleeperId:string;gsisId:string|null;name:string;position:string;team:string;
  injuryStatus:string|null;practice:Practice|null;practiceText:string|null;
  injuryStart:string|null;rosterStatus:string|null;
};
export type AvailabilityPayload={
  source:'Sleeper';sourceUrl:string;retrievedAt:string;
  notice:string;players:AvailabilityPlayer[];totalReported:number;
};
type Raw=Record<string,unknown>;
const rosterPositions=new Set(['QB','RB','WR','TE','K','DEF']);
const clean=(v:unknown,limit=75):string|null=>
  typeof v==='string'&&v.trim()?v.trim().slice(0,limit):null;
export function practiceValue(v:unknown):Practice|null{
  const s=clean(v,100)?.toLowerCase();
  if(!s)return null;
  if(['dnp','did not practice','did_not_practice'].some(x=>s.includes(x)))return 'DNP';
  if(s.includes('limited'))return 'Limited';
  if(s.includes('full'))return 'Full';
  return 'Other';
}
export function normalizeSleeperPlayers(source:unknown):AvailabilityPlayer[]{
  if(!source||Array.isArray(source)||typeof source!=='object')throw Error('Invalid injury source');
  const items=Object.entries(source as Record<string,unknown>);
  if(items.length<100||items.length>45000)throw Error('Incomplete injury source');
  const normalized:AvailabilityPlayer[]=[];
  for(const [key,raw] of items){
    if(!raw||Array.isArray(raw)||typeof raw!=='object')continue;
    const p=raw as Raw;
    const name=clean(p.full_name,120)||
      [clean(p.first_name,55),clean(p.last_name,55)].filter(Boolean).join(' ');
    const pos=clean(p.position,12)?.toUpperCase()||'';
    const team=clean(p.team,6)?.toUpperCase()||'';
    if(!name||!rosterPositions.has(pos)||!TEAM_CODES.has(team))continue;
    const inj=clean(p.injury_status,50);
    const practiceText=clean(p.practice_participation,80);
    const roster=clean(p.status,60);
    // Never call roster "Active" evidence of health; retain reported injury,
    // practice and IR/PUP/NFI information only.
    const restricted=Boolean(roster&&/injured reserve|\bIR\b|\bPUP\b|reserve\/|non-football injury/i.test(roster));
    if(!inj&&!practiceText&&!restricted)continue;
    const start=clean(p.injury_start_date,35);
    normalized.push({
      sleeperId:clean(p.player_id,60)||key.slice(0,60),
      gsisId:clean(p.gsis_id,60),
      name,position:pos,team,
      injuryStatus:inj,practice:practiceValue(practiceText),practiceText,
      injuryStart:start&&/^20\d\d[-/]/.test(start)?start:null,
      rosterStatus:restricted?roster:null
    });
  }
  normalized.sort((a,b)=>a.team.localeCompare(b.team)||a.name.localeCompare(b.name));
  return normalized;
}
export function labelStatus(p:AvailabilityPlayer):string{
 return p.injuryStatus||p.rosterStatus||(
  p.practice==='DNP'?'Did not practice':p.practice==='Limited'?'Limited practice':
  p.practice==='Full'?'Full practice':p.practiceText||'Status reported');
}
export const keyPlayer=(p:AvailabilityPlayer)=>p.team+'|'+p.position+'|'+p.name.toLowerCase().replace(/[^a-z0-9]/g,'');
export function matchResearchPlayer(
  data:AvailabilityPlayer[],player:{id:string;n:string;team:string;pos:string}
):AvailabilityPlayer|null{
 const direct=data.filter(p=>p.gsisId===player.id);
 if(direct.length===1)return direct[0];
 if(direct.length>1)return null;
 // Provider ids differ. An *exact* unique name+team+position is the only
 // permitted fallback, and avoids joining players who share similar names.
 const candidates=data.filter(p=>p.gsisId===null&&p.team===player.team&&p.position===player.pos&&
    p.name.toLowerCase().replace(/[^a-z0-9]/g,'')===player.n.toLowerCase().replace(/[^a-z0-9]/g,''));
 return candidates.length===1?candidates[0]:null;
}
export type SeenEvent={key:string;previous:string;current:string;seenAt:number};
export type SeenState={fingerprints:Record<string,string>;events:SeenEvent[]};
export function diffAvailability(state:SeenState|undefined,players:AvailabilityPlayer[],now:number):SeenState{
 const old=state?.fingerprints||{},next:Record<string,string>={},events=(state?.events||[]).filter(e=>Number.isFinite(e.seenAt)&&now-e.seenAt<14*86400_000).slice(-120);
 for(const p of players){
  const key=keyPlayer(p),current=[p.injuryStatus||'',p.practiceText||'',p.rosterStatus||''].join(' | ');
  next[key]=current;
  if(old[key]!==undefined&&old[key]!==current){
    events.push({key,previous:old[key],current,seenAt:now});
  }
 }
 // Status no longer supplied is *not* proof a player is healthy.
 return {fingerprints:next,events:events.slice(-120)};
}
