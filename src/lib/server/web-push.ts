/* RFC 8291 Web Push payload encryption + VAPID JWT signing.
 * Native Node crypto, no external service, secrets or dependencies required
 * beyond the server-provided VAPID keypair. Never expose the private key.
 */
import {
  createECDH, createHmac, createCipheriv, createPrivateKey, createHash,
  randomBytes, sign
} from 'node:crypto';

export type StoredSubscription={endpoint:string;p256dh:string;auth:string};

function decode(value:string):Buffer {return Buffer.from(value,'base64url');}
function expand(prk:Buffer,info:Buffer,len:number):Buffer {
  let block:Buffer<ArrayBufferLike>=Buffer.alloc(0),result:Buffer<ArrayBufferLike>=Buffer.alloc(0),counter=1;
  while(result.length<len){
    block=createHmac('sha256',prk).update(Buffer.concat([block,info,Buffer.from([counter++])])).digest();
    result=Buffer.concat([result,block]);
  }
  return result.subarray(0,len);
}
function extract(salt:Buffer,key:Buffer):Buffer {return createHmac('sha256',salt).update(key).digest();}
function info(name:string):Buffer {return Buffer.from(name+'\0');}

export function publicVapidKey():string|null{
  const key=process.env.WEB_PUSH_VAPID_PUBLIC_KEY||'';
  const secret=process.env.WEB_PUSH_VAPID_PRIVATE_KEY||'';
  const subject=process.env.WEB_PUSH_VAPID_SUBJECT||'';
  if(!/^[a-zA-Z0-9_-]+$/.test(key)||decode(key).length!==65||
     !/^[a-zA-Z0-9_-]+$/.test(secret)||decode(secret).length!==32||
     !/^(mailto:.+@.+|https:\/\/.+)$/.test(subject))return null;
  return key;
}

export function validPushEndpoint(value:string):boolean{
  if(value.length>2048)return false;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash)return false;
    const host=url.hostname.toLowerCase();
    return host==='fcm.googleapis.com'||host==='fcm-xm.googleapis.com'||
      host==='updates.push.services.mozilla.com'||host==='push.services.mozilla.com'||
      host==='web.push.apple.com'||host.endsWith('.push.apple.com')||
      (host.endsWith('.notify.windows.com')&&host!=='notify.windows.com');
  }catch{return false;}
}

export function validSubscription(sub:StoredSubscription):boolean{
  return typeof sub.endpoint==='string'&&validPushEndpoint(sub.endpoint)&&
    typeof sub.p256dh==='string'&&/^[A-Za-z0-9_-]+$/.test(sub.p256dh)&&decode(sub.p256dh).length===65&&
    typeof sub.auth==='string'&&/^[A-Za-z0-9_-]+$/.test(sub.auth)&&decode(sub.auth).length===16;
}
export function endpointHash(endpoint:string):string{return createHash('sha256').update(endpoint).digest('hex');}

function keyForVapid(publicKey:Buffer,privateKey:Buffer){
  return createPrivateKey({key:{
    kty:'EC',crv:'P-256',x:publicKey.subarray(1,33).toString('base64url'),
    y:publicKey.subarray(33).toString('base64url'),d:privateKey.toString('base64url')
  },format:'jwk'});
}
function encryptedContent(data:Buffer,sub:StoredSubscription):Buffer {
  if(data.length>2600)throw Error('Notification payload too long.');
  const uaPublic=decode(sub.p256dh),auth=decode(sub.auth);
  const ecdh=createECDH('prime256v1');ecdh.generateKeys();
  const serverPublic=ecdh.getPublicKey();
  const shared=ecdh.computeSecret(uaPublic);
  const ikm=expand(extract(auth,shared),
    Buffer.concat([info('WebPush: info'),uaPublic,serverPublic]),32);
  const salt=randomBytes(16),prk=extract(salt,ikm);
  const cek=expand(prk,info('Content-Encoding: aes128gcm'),16);
  const nonce=expand(prk,info('Content-Encoding: nonce'),12);
  const cipher=createCipheriv('aes-128-gcm',cek,nonce);
  const encrypted=Buffer.concat([cipher.update(Buffer.concat([data,Buffer.from([2])])),cipher.final(),cipher.getAuthTag()]);
  const size=Buffer.alloc(4);size.writeUInt32BE(4096);
  return Buffer.concat([salt,size,Buffer.from([serverPublic.length]),serverPublic,encrypted]);
}
function authorization(endpoint:string){
  const publicValue=publicVapidKey();
  if(!publicValue)throw Error('VAPID unavailable.');
  const subject=process.env.WEB_PUSH_VAPID_SUBJECT!;
  const url=new URL(endpoint);
  const audience=url.origin;
  const header=Buffer.from(JSON.stringify({typ:'JWT',alg:'ES256'})).toString('base64url');
  const claims=Buffer.from(JSON.stringify({aud:audience,exp:Math.floor(Date.now()/1000)+3600,sub:subject})).toString('base64url');
  const token=header+'.'+claims;
  const signature=sign('sha256',Buffer.from(token),{
    key:keyForVapid(decode(publicValue),decode(process.env.WEB_PUSH_VAPID_PRIVATE_KEY!)),
    dsaEncoding:'ieee-p1363'
  }).toString('base64url');
  return 'vapid t='+token+'.'+signature+', k='+publicValue;
}

export async function sendWebPush(sub:StoredSubscription,payload:{
 title:string;body:string;url:string;tag?:string
}):Promise<{ok:boolean;gone:boolean;status:number}>{
  if(!publicVapidKey()||!validSubscription(sub))return {ok:false,gone:false,status:400};
  // Only same-site relative paths, never an arbitrary redirect or URL.
  const url=payload.url.startsWith('/')&&!payload.url.startsWith('//')?payload.url:'/?view=public';
  const data=Buffer.from(JSON.stringify({
    title:payload.title.slice(0,100),body:payload.body.slice(0,240),url,tag:payload.tag||'leaguezone'
  }));
  try{
    const response=await fetch(sub.endpoint,{
      method:'POST',signal:AbortSignal.timeout(10000),
      headers:{'Authorization':authorization(sub.endpoint),'TTL':'3600',
        'Urgency':'normal','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream'},
      body:new Uint8Array(encryptedContent(data,sub))
    });
    return {ok:response.status===201||response.status===202||response.status===200,
      gone:response.status===404||response.status===410,status:response.status};
  }catch{return {ok:false,gone:false,status:503};}
}
