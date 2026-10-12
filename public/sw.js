/* LeagueZone PWA: bounded public-data caching only. Never cache authenticated
 * API responses, provider rosters, account pages or private league HTML.
 */
const VERSION='leaguezone-pwa-v3';
const STATIC=VERSION+'-static',RESEARCH=VERSION+'-research',ASSETS=VERSION+'-assets';
const OFFLINE='/offline',SHELL='/research/index.html';
const BOOT=[OFFLINE,'/manifest.webmanifest','/pwa/icon-192.png',SHELL,
 '/research/styles.css','/research/app.js','/research/metrics.js',
 '/research/opportunities.js','/research/tools.js','/research/pwa.js',
 '/companion/companion.js','/companion/companion.css','/research/data/seasons.json'];
const LIMITS={research:10,assets:75};
function isResearchData(path){
 return /^\/research\/data\/(?:20\d{2}|usage\/20\d{2}|redzone\/20\d{2}|seasons)\.json$/.test(path);
}
function isPublicAsset(path){
 return path.startsWith('/_next/static/')||
   /^\/(?:assets|pwa|companion)\//.test(path)||
   /^\/research\/(?:styles\.css|app\.js|metrics\.js|opportunities\.js|tools\.js|pwa\.js)$/.test(path);
}
async function prune(cache,maximum){
 const keys=await cache.keys();
 if(keys.length>maximum)await Promise.all(keys.slice(0,keys.length-maximum).map(k=>cache.delete(k)));
}
function allowedResponse(response){
 const control=response.headers.get('cache-control')||'';
 return response.ok&&response.type==='basic'&&!/private|no-store/i.test(control);
}
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
   const cache=await caches.open(STATIC);
   await cache.addAll(BOOT);
   // Cache the published local season only, never a fixed calendar-year path.
   try{
     const index=await (await cache.match('/research/data/seasons.json')).json();
     const year=Math.max(...(index.years||[]));
     if(Number.isInteger(year)&&year>=2000&&year<=2100){
       const response=await fetch('/research/data/'+year+'.json');
       if(allowedResponse(response))await (await caches.open(RESEARCH)).put('/research/data/'+year+'.json',response);
     }
   }catch{}
   await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
   const keys=await caches.keys();
   await Promise.all(keys.filter(k=>k.startsWith('leaguezone-pwa-')&&![STATIC,RESEARCH,ASSETS].includes(k)).map(k=>caches.delete(k)));
   await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(req.mode==='navigate'){
   event.respondWith(fetch(req).catch(async()=>{
     const cache=await caches.open(STATIC);
     if(url.pathname==='/research'||url.pathname.startsWith('/research/'))
       return await cache.match(SHELL)||await cache.match(OFFLINE)||Response.error();
     return await cache.match(OFFLINE)||Response.error();
   }));
   return;
 }
 const pathname=url.pathname;
 if(!isResearchData(pathname)&&!isPublicAsset(pathname))return;
 event.respondWith((async()=>{
   const cache=await caches.open(isResearchData(pathname)?RESEARCH:ASSETS);
   const found=await cache.match(req);
   const network=async()=>{
     const response=await fetch(req);
     const size=Number(response.headers.get('content-length'))||0;
     // Bound data to roughly 10 files of <= 3 MB; sensitive fetches not cached.
     if(allowedResponse(response)&&(!isResearchData(pathname)||size<=3_000_000)){
       await cache.put(req,response.clone());
       await prune(cache,isResearchData(pathname)?LIMITS.research:LIMITS.assets);
     }
     return response;
   };
   if(pathname.startsWith('/_next/static/'))return found||await network();
   try{return await network();}catch{return found||await (await caches.open(STATIC)).match(req)||Response.error();}
 })());
});
self.addEventListener('push',event=>{
 let data={};
 try{data=event.data?event.data.json():{};}catch{}
 const path=typeof data.url==='string'&&data.url.startsWith('/')&&!data.url.startsWith('//')?data.url:'/?view=public';
 const title=typeof data.title==='string'?data.title.slice(0,100):'LeagueZone';
 event.waitUntil(self.registration.showNotification(title,{
   body:typeof data.body==='string'?data.body.slice(0,240):'You have a new LeagueZone update.',
   icon:'/pwa/icon-192.png',badge:'/pwa/icon-192.png',
   tag:typeof data.tag==='string'?data.tag.slice(0,100):'leaguezone-update',
   data:{url:path}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const path=event.notification.data&&event.notification.data.url||'/?view=public';
 event.waitUntil((async()=>{
   const target=new URL(path,self.location.origin);
   if(target.origin!==self.location.origin)return;
   const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
   const existing=clients.find(c=>new URL(c.url).origin===self.location.origin&&new URL(c.url).pathname===target.pathname);
   if(existing){await existing.focus();if('navigate' in existing)await existing.navigate(target.href);}
   else await self.clients.openWindow(target.href);
 })());
});
