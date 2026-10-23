// Pure league-context interpretation. No provider fetches, predictions,
// valuations, or databases. Treat all candidate lists as research leads.
export type FocusPosition = 'QB'|'RB'|'WR'|'TE';
export type RosterTeam = {rosterId:number; teamName:string; players:string[]};
export type RosterPlayer = {position:string|null};
export type Need = {pos:FocusPosition; mine:number; median:number; required:number;
  shortage:number; belowMedian:number; level:'urgent'|'thin'|'balanced'; explanation:string};
export type CandidateSignal = {id:string;pos:string;direction:'rising'|'falling';
  change:number;relativeChange?:number;scoringChange:number;teamChanged?:boolean;
  priority?:number;verdict?:'supported'|'context-dependent'|'low-volume'|'unverified'};
export type OwnedCandidate<T extends CandidateSignal=CandidateSignal> = {
  signal:T; owner:RosterTeam|null; match:'catalog'|'roster'|'unmatched';
};
export const POSITIONS:FocusPosition[]=['QB','RB','WR','TE'];

function median(values:number[]):number {
 const sorted=values.slice().sort((a,b)=>a-b),i=Math.floor(sorted.length/2);
 return sorted.length?(sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2):0;
}
export function rosterNeeds(
  teams:RosterTeam[],players:Record<string,RosterPlayer>,rosterId:number,
  starterSlots:string[]=[]
):Need[]{
 if (!teams.length||!teams.some(t=>t.rosterId===rosterId)) return [];
 const required=(pos:FocusPosition)=>(starterSlots||[]).filter(s=>s.toUpperCase()===pos).length;
 return POSITIONS.map(pos=>{
  const counts=teams.map(team=>team.players.filter(id=>players[id]?.position?.toUpperCase()===pos).length);
  const selected=teams.findIndex(team=>team.rosterId===rosterId);
  const mine=counts[selected],mid=median(counts),min=required(pos);
  const shortage=Math.max(0,min-mine),belowMedian=Math.max(0,Math.ceil(mid-mine));
  const level=shortage>0?'urgent':belowMedian>0?'thin':'balanced';
  const explanation=shortage>0?
    'Fewer '+pos+'s than required fixed starter slots; check eligible flex options separately.':
    belowMedian>0?'Fewer '+pos+'s rostered than the league median. Depth is not a measure of player quality.':
    'Rostered '+pos+' depth is at or above the league median. Player quality and health still matter.';
  return {pos,mine,median:mid,required:min,shortage,belowMedian,level,explanation} as Need;
 }).sort((a,b)=>b.shortage-a.shortage||b.belowMedian-a.belowMedian||POSITIONS.indexOf(a.pos)-POSITIONS.indexOf(b.pos));
}
export function decisionCandidates<T extends OwnedCandidate<CandidateSignal>>(
  rows:T[],needs:Need[],teamId:number,provider:string,category:'waiver'|'trade'|'my-roster'
):T[] {
 const priority=new Map<string,number>(needs.map((need)=>[need.pos,need.shortage*50+need.belowMedian*18]));
 return rows.filter(item=>{
  if(item.match==='unmatched')return false;
  if(category!=='my-roster'&&['low-volume','unverified'].includes(item.signal.verdict||''))return false;
  if(category==='waiver')return provider==='sleeper'&&item.match==='catalog'&&!item.owner&&item.signal.direction==='rising';
  if(category==='trade')return Boolean(item.owner&&item.owner.rosterId!==teamId&&item.signal.direction==='rising');
  return Boolean(item.owner&&item.owner.rosterId===teamId&&item.signal.direction==='falling');
 }).sort((a,b)=>{
  const grade=(item:T)=>
    (category==='my-roster'?0:(priority.get(item.signal.pos)||0))+
    (item.signal.priority!=null?item.signal.priority:
      Math.min(40,Math.abs(item.signal.change)*3)+
      Math.min(30,Math.max(0,item.signal.relativeChange||0))/2+
      (item.signal.direction==='rising'&&item.signal.scoringChange<2?12:0)-
      (item.signal.teamChanged?18:0));
  return grade(b)-grade(a)||a.signal.id.localeCompare(b.signal.id);
 });
}
