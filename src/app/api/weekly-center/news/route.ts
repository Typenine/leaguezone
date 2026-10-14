import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const FEED='https://www.espn.com/espn/rss/nfl/news';
function decodeXml(s:string):string{
 return s.replace(/^<!\[CDATA\[|\]\]>$/g,'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,c:string)=>{
  const n=c[0].toLowerCase()==='x'?parseInt(c.slice(1),16):Number(c);
  return n>31&&n<0x110000?String.fromCodePoint(n):'';
 }).replace(/&(amp|lt|gt|quot|apos);/g,(_,c:string)=>
  ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[c]||'');
}
function field(block:string,tag:string){const m=new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i').exec(block);
 return m?decodeXml(m[1].trim()):''}
export function parseEspnRss(xml:string){
 if(!/<rss\b/i.test(xml)||!/<channel\b/i.test(xml))throw Error('Invalid RSS feed');
 const rows=xml.match(/<item\b[\s\S]*?<\/item>/gi)||[];
 const items:{title:string;url:string;published:string|null}[]=[];
 for(const b of rows.slice(0,30)){
  const title=field(b,'title'),href=field(b,'link'),pub=field(b,'pubDate');
  let u:URL;
  try{u=new URL(href)}catch{continue}
  if(!title||title.length>280||u.protocol!=='https:'||
   !(u.hostname==='espn.com'||u.hostname.endsWith('.espn.com')))continue;
  items.push({title,url:u.href,published:Number.isFinite(Date.parse(pub))?new Date(pub).toISOString():null});
 }
 return items;
}
export async function GET(){
 const headers={'Cache-Control':'public, s-maxage=1800, stale-while-revalidate=1800'};
 try{
  const r=await fetch(FEED,{next:{revalidate:1800},signal:AbortSignal.timeout(9000),
   headers:{Accept:'application/rss+xml, application/xml;q=0.9','User-Agent':'LeagueZone-Reader/1.0'}});
  if(!r.ok)throw Error('Feed unavailable');
  const items=parseEspnRss(await r.text());
  if(!items.length)throw Error('Empty feed');
  return NextResponse.json({items,source:'ESPN',sourceUrl:FEED,notice:'Headlines provided by ESPN. Read the linked original article.'},{headers});
 }catch{
  return NextResponse.json({items:[],source:'ESPN',sourceUrl:FEED,
   notice:'The official ESPN feed is currently unavailable; no substitute headlines were generated.'},
   {headers:{'Cache-Control':'public, s-maxage=300'}});
 }
}
