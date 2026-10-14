/** Shared research destinations. The static Research shell mirrors these links.
 * tests/unit/research-navigation.test.ts guards that cross-shell contract. */
export const RESEARCH_DESTINATIONS=[
 {href:'/research',label:'Overview',key:'overview'},
 {href:'/weekly',label:'Weekly Center',key:'weekly'},
 {href:'/research/players',label:'Players',key:'players'},
 {href:'/research/stats',label:'Stat Leaders',key:'stats'},
 {href:'/research/radar',label:'Radar',key:'radar'},
 {href:'/research/receipts',label:'Receipts',key:'receipts'},
 {href:'/research/development',label:'Development Lab',key:'development'},
 {href:'/my-research',label:'My Research',key:'mine'},
 {href:'/saved',label:'Saved',key:'saved'},
 {href:'/search',label:'Search',key:'search'},
] as const;

export function researchSectionKey(pathname:string):string|null{
 if(pathname==='/research')return 'overview';
 if(pathname==='/weekly'||pathname.startsWith('/weekly/'))return 'weekly';
 if(pathname==='/my-research'||pathname==='/app')return 'mine';
 if(pathname==='/saved')return 'saved';
 if(pathname==='/search')return 'search';
 if(pathname==='/research/stats')return 'stats';
 if(pathname==='/research/radar')return 'radar';
 if(pathname==='/research/receipts')return 'receipts';
 if(pathname==='/research/development')return 'development';
 if(pathname==='/research/players'||pathname.startsWith('/research/players/'))return 'players';
 return null;
}
