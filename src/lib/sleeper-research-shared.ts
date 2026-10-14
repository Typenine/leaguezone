export function parseSleeperLeagueInput(input:string):string|null{
 const raw=input.trim();
 if(/^[0-9]{7,25}$/.test(raw))return raw;
 try{
  const url=new URL(raw);
  if(!['sleeper.app','sleeper.com','www.sleeper.app','www.sleeper.com'].includes(url.hostname.toLowerCase()))return null;
  const match=url.pathname.match(/^\/leagues?\/(\d{7,25})(?:\/|$)/);
  return match?.[1]||null;
 }catch{return null;}
}
