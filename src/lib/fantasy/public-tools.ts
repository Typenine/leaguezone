export const FANTASY_TOOLS=[
 {key:'start-bench',label:'Start / Bench Advisor',description:'Compare your current starters to a legal projected lineup and weigh close calls.',group:'Weekly decisions'},
 {key:'waivers',label:'Waiver & Pickup Finder',description:'See unrostered rising-opportunity players compared against your team needs.',group:'Weekly decisions'},
 {key:'trade',label:'Trade Impact Advisor',description:'Try player trades and see how both teams change in dynasty market value and depth.',group:'Team building'},
 {key:'roster',label:'Improve My Roster',description:'Identify starting-position shortages, depth concerns and roster priorities.',group:'Team building'},
 {key:'rankings',label:'Personalized Player Rankings',description:'Compare weekly projections and dynasty market values in the context of your league.',group:'Team building'},
 {key:'taxi',label:'Taxi Squad Advisor',description:'Review taxi development and conditional promotions using real roster settings.',group:'Dynasty & future'},
 {key:'draft',label:'Draft Advisor',description:'Explore rookie prospect fit based on the existing scouting board and your needs.',group:'Dynasty & future'},
 {key:'outlook',label:'Season Outlook',description:'Use verified remaining games and this week’s projections for a cautious planning pace.',group:'Dynasty & future'},
 {key:'receipts',label:'Prediction Receipts',description:'Review public predictions and measured outcomes without signing in.',group:'Proof & accuracy'},
] as const;
export type PublicToolKey=typeof FANTASY_TOOLS[number]['key'];
export const isPublicToolKey=(value:string):value is PublicToolKey=>
 FANTASY_TOOLS.some(t=>t.key===value);
export function publicToolUrl(tool:PublicToolKey,leagueId?:string,rosterId?:number|null){
 const query=new URLSearchParams();
 if(leagueId)query.set('leagueId',leagueId);
 if(rosterId!=null)query.set('rosterId',String(rosterId));
 return '/fantasy-tools/'+tool+(query.size?'?'+query.toString():'');
}
