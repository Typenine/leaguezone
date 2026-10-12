'use client';
import { useEffect,useState } from 'react';
type Settings={configured:boolean;publicKey:string|null;enabled:boolean;roleChanges:boolean;subscribed:boolean};
function vapidBuffer(value:string):ArrayBuffer{
  const s=value.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(s.padEnd(Math.ceil(s.length/4)*4,'='));
  const arr=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)arr[i]=binary.charCodeAt(i);
  return arr.buffer;
}
async function subscription():Promise<PushSubscription|null>{
  if(!('serviceWorker' in navigator))return null;
  const reg=await navigator.serviceWorker.ready;
  return reg.pushManager?.getSubscription()||null;
}
export default function NotificationControls(){
  const [settings,setSettings]=useState<Settings|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [thisDevice,setThisDevice]=useState(false);
  useEffect(()=>{
    let active=true;
    fetch('/api/me/notifications',{credentials:'same-origin',cache:'no-store'})
      .then(async r=>{if(!r.ok)throw Error('Settings unavailable');return r.json() as Promise<Settings>;})
      .then(async value=>{if(!active)return;setSettings(value);
        try{const sub=await subscription();if(active)setThisDevice(!!sub);}catch{}
      }).catch(()=>{if(active)setMessage('Notification settings could not be loaded.');});
    return ()=>{active=false;};
  },[]);
  async function enable(){
    if(!settings?.publicKey||busy)return;
    setBusy(true);setMessage('');
    try{
      if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window))
        throw Error('This browser does not support web push notifications.');
      if(await Notification.requestPermission()!=='granted')throw Error('Notification permission was not granted.');
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBuffer(settings.publicKey)});
      const response=await fetch('/api/me/notifications',{method:'POST',credentials:'same-origin',
        headers:{'content-type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()})});
      if(!response.ok)throw Error((await response.json().catch(()=>({}))).error||'Subscription failed.');
      setThisDevice(true);setSettings({...settings,enabled:true,subscribed:true});
      setMessage('Subscribed. Alerts will follow published research refreshes for qualifying players in your account watchlist.');
    }catch(e){setMessage(e instanceof Error?e.message:'Unable to subscribe.');}
    finally{setBusy(false);}
  }
  async function disable(){
    if(!settings||busy)return;
    setBusy(true);setMessage('');
    try{
      const sub=await subscription();
      if(sub){
        const r=await fetch('/api/me/notifications',{method:'DELETE',credentials:'same-origin',
          headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});
        if(!r.ok)throw Error('Server could not remove your subscription.');
        await sub.unsubscribe();
      }
      setThisDevice(false);
      setSettings({...settings,enabled:false,subscribed:false});
      setMessage('Push disabled on this device.');
    }catch(e){setMessage(e instanceof Error?e.message:'Unable to unsubscribe.');}
    finally{setBusy(false);}
  }
  async function save(enabled:boolean){
    if(!settings||busy)return;
    setBusy(true);setMessage('');
    try{
      const r=await fetch('/api/me/notifications',{method:'PUT',credentials:'same-origin',
        headers:{'content-type':'application/json'},body:JSON.stringify({enabled:settings.enabled,roleChanges:enabled})});
      if(!r.ok)throw Error('Could not save your preference.');
      setSettings({...settings,roleChanges:enabled});setMessage('Preferences saved.');
    }catch(e){setMessage(e instanceof Error?e.message:'Save failed.');}
    finally{setBusy(false);}
  }
  async function test(){
    const sub=await subscription();
    if(!sub){setMessage('This device is not subscribed.');return;}
    setBusy(true);setMessage('');
    try{
      const r=await fetch('/api/me/notifications/test',{method:'POST',credentials:'same-origin',
        headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});
      if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||'Test push failed.');
      setMessage('Test sent to the push provider. Check your device notifications.');
    }catch(e){setMessage(e instanceof Error?e.message:'Test failed.');}
    finally{setBusy(false);}
  }
  return <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7" aria-label="Push notification controls">
    {!settings&&<p role="status">Loading notification settings…</p>}
    {settings&&<>
      <h2 className="text-lg font-bold">Browser push notifications</h2>
      {!settings.configured?
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Push notifications are not configured for this deployment. The site owner must add VAPID credentials. Your watchlist and saved research still work.</p>:
        <><p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {thisDevice?'Push is enabled on this device.':settings.subscribed?'Another device has a subscription. This device is not subscribed.':'This device has not subscribed yet.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {!thisDevice?<button type="button" onClick={()=>void enable()} disabled={busy}
            className="min-h-11 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">Enable push</button>:
            <button type="button" onClick={()=>void disable()} disabled={busy}
              className="min-h-11 rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-bold disabled:opacity-60">Disable this device</button>}
          {thisDevice&&<button type="button" onClick={()=>void test()} disabled={busy}
            className="min-h-11 rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-bold disabled:opacity-60">Send test push</button>}
        </div></>}
      <label className="mt-7 flex items-start gap-3 border-t border-[var(--border)] pt-5 text-sm">
        <input type="checkbox" checked={settings.roleChanges} disabled={busy} onChange={e=>void save(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[var(--accent)]"/>
        <span><strong className="block">Watchlist opportunity changes</strong>
          <span className="mt-1 block leading-6 text-[var(--muted)]">Notify me if a saved player's published research shows rising or falling usage. Requires account-synced watchlists and an active device subscription.</span></span>
      </label>
    </>}
    {message&&<p role="status" className="mt-5 rounded border border-[var(--border)] p-3 text-sm">{message}</p>}
    <p className="mt-5 text-xs leading-6 text-[var(--muted)]">On iPhone, web push requires installing LeagueZone to the home screen. Alerts depend on browser support, your permissions and published research updates. No breaking-news or injury alerts are included.</p>
  </section>;
}
