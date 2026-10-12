export const SAVED_KEY='leaguezone:saved-research:v1';
export type SavedItem={key:string;type:'player'|'view';title:string;href:string;savedAt:number};
export function safeHref(href:string):string|null{
 try{
  const url=new URL(href,'https://leaguezone.local');
  if(url.origin!=='https://leaguezone.local'||!url.pathname.startsWith('/research')||href.length>800)return null;
  return url.pathname+url.search;
 }catch{return null}
}
export function readSaved():SavedItem[]{
 if(typeof window==='undefined')return [];
 try{
  const items:unknown=JSON.parse(localStorage.getItem(SAVED_KEY)||'[]');
  if(!Array.isArray(items))return [];
  return items.slice(0,100).filter((item):item is SavedItem=>{
   if(!item||typeof item!=='object')return false;
   const x=item as Partial<SavedItem>;
   return typeof x.key==='string' && x.key.length<900 &&
    (x.type==='player'||x.type==='view') &&
    typeof x.title==='string' && x.title.length<=150 &&
    typeof x.href==='string' && Boolean(safeHref(x.href)) &&
    typeof x.savedAt==='number' && Number.isFinite(x.savedAt);
  });
 }catch{return []}
}
export function writeSaved(items:SavedItem[]):boolean{
 try{localStorage.setItem(SAVED_KEY,JSON.stringify(items.slice(0,100)));
  window.dispatchEvent(new Event('leaguezone:saved-changed'));return true;
 }catch{return false}
}
export function saveResearch(item:Omit<SavedItem,'savedAt'>):boolean{
 const href=safeHref(item.href);
 if(!href||!item.title||item.title.length>150)return false;
 const next=readSaved().filter(x=>x.key!==item.key);
 return writeSaved([{...item,href,savedAt:Date.now()},...next]);
}
