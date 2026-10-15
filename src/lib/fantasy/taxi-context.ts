// Read-only taxi context for personalized advice. This is not an eligibility
// validator: transaction history and custom rulebooks remain authoritative.
export type TaxiContext={
 season:number;
 maxSlots:number|null;
 used:number;
 players:Array<{id:string;name:string;position:string;rookieYear:number|null;yearsExperience:number|null}>;
};
type TaxiRoster={taxi?:string[]|null};
type TaxiPlayerMeta={first_name?:string|null;last_name?:string|null;position?:string|null;
 rookie_year?:number|string|null;years_exp?:number|null};
export function taxiContextFromSleeper(args:{
 season:string|number;roster:TaxiRoster|null|undefined;
 settings?:Record<string,unknown>|null;rosterPositions?:string[];
 playerDirectory:Record<string,TaxiPlayerMeta>;
}):TaxiContext{
 const ids=Array.isArray(args.roster?.taxi)?[...new Set(args.roster.taxi.filter((id):id is string=>typeof id==='string'&&!!id))]:[];
 const configured=Number(args.settings?.taxi_slots);
 const fromPositions=(args.rosterPositions||[]).filter(x=>x==='TAXI').length;
 const maxSlots=Number.isInteger(configured)&&configured>0&&configured<=100?configured:
  fromPositions>0?fromPositions:null;
 const players=ids.map(id=>{
  const p=args.playerDirectory[id],r=Number(p?.rookie_year),exp=Number(p?.years_exp);
  return {id,name:[p?.first_name,p?.last_name].filter(Boolean).join(' ')||id,
   position:p?.position||'Unknown',
   rookieYear:Number.isInteger(r)&&r>=1990&&r<=2100?r:null,
   yearsExperience:p?.years_exp!=null&&Number.isInteger(exp)&&exp>=0?exp:null};
 });
 return {season:Number(args.season),maxSlots,used:ids.length,players};
}
