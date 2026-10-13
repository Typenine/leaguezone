import {
  SAVED_KEY, MAX_SAVED, normalizeSaved, readSaved, saveResearch,
  writeSaved, type SavedInput, type SavedItem,
} from '@/lib/saved-research';

export type SavedLibrary = { signedIn: boolean; items: SavedItem[]; unsyncedLocal?: number };

function browserError(message:string):Error{return new Error(message)}

async function accountRequest(method:'POST'|'DELETE',data:unknown):Promise<void>{
  const response=await fetch('/api/saved-research',{
    method, credentials:'same-origin', cache:'no-store',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify(data),
  });
  if(!response.ok){
    const payload=await response.json().catch(()=>({})) as {error?:string};
    throw browserError(payload.error||'Your account watchlist could not be updated.');
  }
}

/** Fetch the account library. Legacy bookmarks are imported once and then
 * removed from device-local storage to prevent re-importing deleted records. */
export async function loadSavedLibrary():Promise<SavedLibrary>{
  const response=await fetch('/api/saved-research',{cache:'no-store',credentials:'same-origin'});
  if(response.status===401)return {signedIn:false,items:readSaved()};
  if(!response.ok)throw browserError('Your saved research could not be loaded. Please retry.');
  const data=await response.json() as {items?:SavedItem[];userId?:string};
  if(!Array.isArray(data.items)||typeof data.userId!=='string')
    throw browserError('Invalid saved research response.');
  const guest=readSaved();
  if(guest.length){
    await accountRequest('POST',{import:guest.slice(0,MAX_SAVED)});
    // Verify every imported key is actually present before discarding local
    // bookmarks. A full account (100 items) can only absorb part of the import.
    const latest=await fetch('/api/saved-research',{cache:'no-store',credentials:'same-origin'});
    if(!latest.ok)throw browserError('Bookmarks imported, but the updated list could not be loaded.');
    const saved=await latest.json() as {items?:SavedItem[]};
    if(!Array.isArray(saved.items))throw browserError('Invalid updated watchlist.');
    const remoteKeys=new Set(saved.items.map(item=>item.key));
    const remaining=guest.filter(item=>!remoteKeys.has(item.key));
    if(remaining.length){
      if(!writeSaved(remaining))throw browserError('Could not preserve unsynced browser bookmarks.');
    }else{
      try{localStorage.removeItem(SAVED_KEY)}catch{/* Remote contents remain safe. */}
    }
    window.dispatchEvent(new Event('leaguezone:saved-changed'));
    return {signedIn:true,items:saved.items,unsyncedLocal:remaining.length};
  }
  return {signedIn:true,items:data.items};
}

export async function addSaved(input:SavedInput,signedIn:boolean):Promise<SavedItem>{
  const item=normalizeSaved(input);
  if(!item)throw browserError('This research page cannot be saved.');
  if(signedIn)await accountRequest('POST',{item});
  else if(!saveResearch(item))throw browserError('Browser storage is unavailable.');
  return item;
}

export async function removeSaved(key:string,signedIn:boolean):Promise<void>{
  if(signedIn)await accountRequest('DELETE',{key});
  else if(!writeSaved(readSaved().filter(item=>item.key!==key)))
    throw browserError('Browser storage is unavailable.');
}
