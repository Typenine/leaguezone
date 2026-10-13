import {createCipheriv,createECDH,createPrivateKey,hkdfSync,randomBytes,sign} from 'node:crypto';
const b64=(v:Buffer)=>v.toString('base64url');
const bytes=(v:string)=>Buffer.from(v,'base64url');
export type Device={endpoint:string;p256dh:string;auth:string};
export function validateDevice(device:Device):boolean{
 try{
  const u=new URL(device.endpoint);
  if(u.protocol!=='https:'||u.username||u.password||u.port||device.endpoint.length>2048)return false;
  const h=u.hostname.toLowerCase();
  if(!(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com']
    .includes(h)||h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com')))return false;
  return bytes(device.p256dh).length===65&&bytes(device.p256dh)[0]===4&&bytes(device.auth).length===16;
 }catch{return false}
}
export function publicVapidKey():string|null{
 const pub=process.env.WEB_PUSH_VAPID_PUBLIC_KEY||'';
 const priv=process.env.WEB_PUSH_VAPID_PRIVATE_KEY||'';
 return bytes(pub).length===65&&bytes(priv).length===32?pub:null;
}
function vapidToken(endpoint:string):string{
 const pub=bytes(process.env.WEB_PUSH_VAPID_PUBLIC_KEY||'');
 const priv=process.env.WEB_PUSH_VAPID_PRIVATE_KEY||'';
 if(pub.length!==65||bytes(priv).length!==32)throw Error('VAPID keys are not configured');
 const jwtHeader=b64(Buffer.from(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const claim=b64(Buffer.from(JSON.stringify({aud:new URL(endpoint).origin,
  exp:Math.floor(Date.now()/1000)+3600,sub:'mailto:hello@leaguezonehq.com'})));
 const value=jwtHeader+'.'+claim;
 const key=createPrivateKey({key:{kty:'EC',crv:'P-256',
  x:b64(pub.subarray(1,33)),y:b64(pub.subarray(33)),d:priv},format:'jwk'});
 return value+'.'+b64(sign('sha256',Buffer.from(value),{key,dsaEncoding:'ieee-p1363'}));
}
export function encryptPush(device:Device,data:unknown):Buffer{
 const receiver=bytes(device.p256dh),auth=bytes(device.auth);
 const sender=createECDH('prime256v1');sender.generateKeys();
 const senderPublic=sender.getPublicKey();
 const shared=sender.computeSecret(receiver);
 const info=Buffer.concat([Buffer.from('WebPush: info\0'),receiver,senderPublic]);
 const ikm=Buffer.from(hkdfSync('sha256',shared,auth,info,32));
 const salt=randomBytes(16);
 const cek=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
 const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
 const plain=Buffer.concat([Buffer.from(JSON.stringify(data)),Buffer.from([2])]);
 if(plain.length>3900)throw Error('Push message too large');
 const cipher=createCipheriv('aes-128-gcm',cek,nonce);
 const body=Buffer.concat([cipher.update(plain),cipher.final(),cipher.getAuthTag()]);
 const size=Buffer.alloc(4);size.writeUInt32BE(4096);
 return Buffer.concat([salt,size,Buffer.from([senderPublic.length]),senderPublic,body]);
}
export async function sendPush(device:Device,data:unknown):Promise<number>{
 if(!validateDevice(device))return 400;
 const jwt=vapidToken(device.endpoint);
 const body=encryptPush(device,data);
 const response=await fetch(device.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
  headers:{'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream','TTL':'86400',
   'Authorization':'vapid t='+jwt+',k='+process.env.WEB_PUSH_VAPID_PUBLIC_KEY},
  body:new Uint8Array(body)});
 return response.status;
}
