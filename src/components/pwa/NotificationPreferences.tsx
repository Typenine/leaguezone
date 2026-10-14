'use client';
import {useEffect,useState} from 'react';
type PushResponse={publicKey:string|null;registered?:string[]};
function decode(key:string):ArrayBuffer{
 const pad='='.repeat((4-key.length%4)%4);
 const raw=atob((key+pad).replace(/-/g,'+').replace(/_/g,'/'));
 const buffer=new ArrayBuffer(raw.length);
 new Uint8Array(buffer).set(Uint8Array.from(raw,c=>c.charCodeAt(0)));
 return buffer;
}
export default function NotificationPreferences(){
 const [supported,setSupported]=useState(false);
 const [configured,setConfigured]=useState(false);
 const [active,setActive]=useState(false);
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('Checking notification support…');
 const [publicKey,setPublicKey]=useState('');
 useEffect(()=>{
  let alive=true;
  const available=typeof window!=='undefined'&&window.isSecureContext&&
   'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window;
  setSupported(available);
  if(!available){setStatus('This browser cannot receive web push notifications. On iPhone, install LeagueZone to your Home Screen first.');return}
  Promise.all([
   fetch('/api/push',{cache:'no-store'}).then(r=>r.json() as Promise<PushResponse>),
   // ready never settles when no worker is registered; getRegistration does.
   navigator.serviceWorker.getRegistration('/').then(r=>r?r.pushManager.getSubscription():null)
  ]).then(([info,sub])=>{
   if(!alive)return;
   setConfigured(Boolean(info.publicKey));
   setPublicKey(info.publicKey||'');
   setActive(Boolean(sub&&info.registered?.includes(sub.endpoint)));
   setStatus(info.publicKey?'Notification delivery is available for this deployment.':'Push delivery needs server configuration before it can be enabled.');
  }).catch(()=>{if(alive)setStatus('Unable to check current notification settings.')});
  return()=>{alive=false};
 },[]);
 async function enable(){
  setBusy(true);setStatus('');
  try{
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw Error('Notification permission was not granted.');
   const sw=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
   const existing=await sw.pushManager.getSubscription();
   const subscription=existing||await sw.pushManager.subscribe({userVisibleOnly:true,
    applicationServerKey:decode(publicKey)});
   const response=await fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json'},
    credentials:'same-origin',body:JSON.stringify({subscription:subscription.toJSON(),researchUpdates:true})});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'Failed to save notification settings');
   setActive(true);setStatus('Weekly research notifications are enabled on this device.');
  }catch(error){setStatus(error instanceof Error?error.message:'Could not enable notifications.')}
  finally{setBusy(false)}
 }
 async function disable(){
  setBusy(true);
  try{
   const sw=await navigator.serviceWorker.ready;
   const sub=await sw.pushManager.getSubscription();
   if(sub){
    const response=await fetch('/api/push',{method:'DELETE',headers:{'Content-Type':'application/json'},
     credentials:'same-origin',body:JSON.stringify({endpoint:sub.endpoint})});
    if(!response.ok)throw Error('Unable to save your preference.');
    await sub.unsubscribe();
   }
   setActive(false);setStatus('Notifications disabled for this device.');
  }catch(error){setStatus(error instanceof Error?error.message:'Unable to disable notifications.')}
  finally{setBusy(false)}
 }
 return <div className="mt-7 max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
  <h2 className="text-lg font-bold">Research publication alerts</h2>
  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Receive a push when LeagueZone publishes a new validated fantasy research week. The browser does not need to be open. Player-specific and league-event alerts are not enabled yet.</p>
  <p role="status" className="mt-4 text-sm text-[var(--muted)]">{status}</p>
  {supported&&configured&&<button type="button" disabled={busy} onClick={()=>void (active?disable():enable())}
   className="mt-5 rounded-lg bg-[var(--brand-gold)] px-5 py-3 text-sm font-bold text-[var(--brand-ink)] disabled:opacity-50">
   {busy?'Updating…':active?'Disable notifications':'Enable research notifications'}
  </button>}
  <p className="mt-5 text-xs text-[var(--muted)]">Delivery requires permission, the installed app or a compatible browser, and VAPID configuration on the server. No notification permission is requested automatically.</p>
 </div>;
}