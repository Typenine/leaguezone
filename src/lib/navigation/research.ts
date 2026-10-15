/** The secondary research strip is intentionally focused. Other destinations
 * live under the primary Tools or Hub menus. Static Research mirrors this list. */
export const RESEARCH_DESTINATIONS=[
 {href:'/research',label:'Overview',key:'overview'},
 {href:'/research/decisions',label:'Fantasy Insights',key:'decisions'},
 {href:'/research/players',label:'Players',key:'players'},
 {href:'/research/stats',label:'Stat Leaders',key:'stats'},
 {href:'/research/radar',label:'Radar',key:'radar'},
 {href:'/weekly',label:'Weekly Center',key:'weekly'},
 {href:'/availability',label:'Availability',key:'availability'},
] as const;
export function researchSectionKey(pathname:string):string|null{
 if(pathname==='/research')return 'overview';
 if(pathname==='/research/decisions')return 'decisions';
 if(pathname==='/research/players'||pathname.startsWith('/research/players/'))return 'players';
 if(pathname==='/research/stats')return 'stats';
 if(pathname==='/research/radar')return 'radar';
 if(pathname==='/weekly'||pathname.startsWith('/weekly/'))return 'weekly';
 if(pathname==='/availability'||pathname.startsWith('/availability/'))return 'availability';
 return null;
}
