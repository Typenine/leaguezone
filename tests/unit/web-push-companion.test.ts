import { afterEach, describe, expect, it, vi } from 'vitest';
import { createECDH, createHmac, createDecipheriv, generateKeyPairSync, randomBytes } from 'node:crypto';
import { endpointHash, publicVapidKey, sendWebPush, validPushEndpoint, validSubscription } from '@/lib/server/web-push';

const previous={
  WEB_PUSH_VAPID_PUBLIC_KEY:process.env.WEB_PUSH_VAPID_PUBLIC_KEY,
  WEB_PUSH_VAPID_PRIVATE_KEY:process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
  WEB_PUSH_VAPID_SUBJECT:process.env.WEB_PUSH_VAPID_SUBJECT
};
afterEach(()=>{
  vi.unstubAllGlobals();
  for(const [k,v] of Object.entries(previous)){
    if(v===undefined)delete process.env[k];
    else process.env[k]=v;
  }
});
function extract(salt:Buffer,value:Buffer){return createHmac('sha256',salt).update(value).digest();}
function expand(prk:Buffer,info:Buffer,len:number):Buffer{
  let result:Buffer<ArrayBufferLike>=Buffer.alloc(0),block:Buffer<ArrayBufferLike>=Buffer.alloc(0),n=1;
  while(result.length<len){
    block=createHmac('sha256',prk).update(Buffer.concat([block,info,Buffer.from([n++])])).digest();
    result=Buffer.concat([result,block]);
  }
  return result.subarray(0,len);
}
describe('Web Push security and RFC8291 payload',()=>{
  it('rejects untrusted endpoints and malformed keys',()=>{
    expect(validPushEndpoint('http://localhost:3000/test')).toBe(false);
    expect(validPushEndpoint('https://example.com/notify')).toBe(false);
    expect(validPushEndpoint('https://fcm.googleapis.com/fcm/send/test')).toBe(true);
    expect(validSubscription({endpoint:'https://fcm.googleapis.com/a',p256dh:'abc',auth:'abc'})).toBe(false);
    expect(endpointHash('a')).not.toBe(endpointHash('b'));
  });
  it('encrypts a payload a subscribed browser can decrypt',async()=>{
    const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
    const jwk=publicKey.export({format:'jwk'}),secret=privateKey.export({format:'jwk'});
    const vapid=Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x!,'base64url'),Buffer.from(jwk.y!,'base64url')]).toString('base64url');
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY=vapid;
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY=secret.d!;
    process.env.WEB_PUSH_VAPID_SUBJECT='mailto:ops@example.com';
    expect(publicVapidKey()).toBe(vapid);
    const subscriber=createECDH('prime256v1');subscriber.generateKeys();
    const clientKey=subscriber.getPublicKey(),auth=randomBytes(16);
    let sent:Buffer|undefined;
    vi.stubGlobal('fetch',vi.fn(async (_url:string,args:RequestInit)=>{
      const body=args.body;
      sent=Buffer.from(body as Uint8Array);
      expect(args.headers).toMatchObject({'Content-Encoding':'aes128gcm','TTL':'3600'});
      return {status:201};
    }));
    const response=await sendWebPush({
      endpoint:'https://fcm.googleapis.com/fcm/send/test',
      p256dh:clientKey.toString('base64url'),auth:auth.toString('base64url')
    },{title:'LeagueZone',body:'Test role change',url:'/research/radar'});
    expect(response.ok).toBe(true);
    const wire=sent!;
    const salt=wire.subarray(0,16),length=wire.readUInt32BE(16);
    expect(length).toBe(4096);
    const publicSize=wire[20],serverKey=wire.subarray(21,21+publicSize);
    const shared=subscriber.computeSecret(serverKey);
    const ikm=expand(extract(auth,shared),Buffer.concat([Buffer.from('WebPush: info\0'),clientKey,serverKey]),32);
    const prk=extract(salt,ikm);
    const aes=expand(prk,Buffer.from('Content-Encoding: aes128gcm\0'),16);
    const nonce=expand(prk,Buffer.from('Content-Encoding: nonce\0'),12);
    const encrypted=wire.subarray(21+publicSize);
    const decipher=createDecipheriv('aes-128-gcm',aes,nonce);
    decipher.setAuthTag(encrypted.subarray(encrypted.length-16));
    const plain=Buffer.concat([decipher.update(encrypted.subarray(0,-16)),decipher.final()]);
    expect(plain.at(-1)).toBe(2);
    const json=JSON.parse(plain.subarray(0,-1).toString());
    expect(json.body).toBe('Test role change');
    expect(json.url).toBe('/research/radar');
  });
});
