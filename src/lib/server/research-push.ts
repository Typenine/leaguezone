export type ResearchCatalog={schema:number;files:Record<string,{throughWeek:number;updated?:string}>};
// A weekly refresh is announced only while it is new. Older or offseason
// catalogs never reach Postgres, so most daily cron runs cost no DB request.
export const ANNOUNCE_WINDOW_DAYS=3;
export function announcement(catalog:ResearchCatalog,now=new Date()){
 if(catalog.schema!==1||!catalog.files)throw Error('Invalid catalog');
 const year=Math.max(...Object.keys(catalog.files).map(Number).filter(Number.isInteger));
 const info=catalog.files[String(year)],week=info?.throughWeek;
 if(!Number.isInteger(week)||week<1||week>18||year<2020||year>now.getUTCFullYear()+1)return {skipped:'no_validated_week' as const};
 const updated=Date.parse(String(info.updated||'')+'T00:00:00Z');
 if(!Number.isFinite(updated)||now.getTime()-updated>ANNOUNCE_WINDOW_DAYS*86_400_000)return {skipped:'no_recent_refresh' as const,year,week};
 return {year,week,version:year+':'+week};
}
