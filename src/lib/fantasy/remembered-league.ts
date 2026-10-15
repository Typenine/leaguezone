/** The remembered ID is a navigation preference, never authorization to private league data. */
export type LastSleeperLeague={leagueId:string;rosterId:number|null};
export type SavedSleeperTeam={leagueId:string;leagueName:string;rosterId:number;teamName:string;season:number};
const KEY='leaguezone:remembered-sleeper:v1';
const valid=(s:string)=>/^[0-9]{7,25}$/.test(s);
export function readRememberedLeague():LastSleeperLeague|null{
 if(typeof window==='undefined')return null;
 try{
  const v=JSON.parse(localStorage.getItem(KEY)||'null') as LastSleeperLeague|null;
  return v&&valid(v.leagueId)&&(v.rosterId===null||Number.isInteger(v.rosterId)&&v.rosterId>0)?v:null;
 }catch{return null}
}
export function rememberLeague(leagueId:string,rosterId:number|null){
 if(!valid(leagueId)||rosterId!==null&&(!Number.isInteger(rosterId)||rosterId<=0))return;
 try{localStorage.setItem(KEY,JSON.stringify({leagueId,rosterId}));window.dispatchEvent(new Event('leaguezone:remembered-league'));}catch{}
}
export function forgetRememberedLeague(leagueId:string){
 if(readRememberedLeague()?.leagueId!==leagueId)return;
 try{localStorage.removeItem(KEY);window.dispatchEvent(new Event('leaguezone:remembered-league'));}catch{}
}
export async function loadSavedSleeperTeams():Promise<{connected:SavedSleeperTeam[];signedIn:boolean}>{
 const response=await fetch('/api/research/sleeper/connections',{credentials:'same-origin',cache:'no-store'});
 if(response.status===401)return {connected:[],signedIn:false};
 const data=await response.json().catch(()=>({})) as {error?:string;connections?:SavedSleeperTeam[]};
 if(!response.ok)throw Error(data.error||'Unable to load connected Sleeper teams.');
 return {connected:(Array.isArray(data.connections)?data.connections:[]).filter(c=>valid(c.leagueId)&&Number.isInteger(c.rosterId)&&c.rosterId>0),signedIn:true};
}
export function preferredSleeperTeam(connected:SavedSleeperTeam[]):SavedSleeperTeam|null{
 const stored=readRememberedLeague();
 return connected.find(c=>c.leagueId===stored?.leagueId)||connected[0]||null;
}
export async function preferSleeperTeam(leagueId:string){
 const response=await fetch('/api/research/sleeper/connections',{method:'PATCH',credentials:'same-origin',
  headers:{'content-type':'application/json'},body:JSON.stringify({leagueId})});
 if(!response.ok)throw Error('Unable to sync preferred Sleeper league.');
}
