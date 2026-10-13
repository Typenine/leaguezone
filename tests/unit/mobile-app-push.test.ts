import {describe,it,expect} from 'vitest';
import {createDecipheriv,createECDH,hkdfSync,randomBytes} from 'node:crypto';
import {encryptPush,validateDevice} from '@/lib/server/web-push';
function subscription(){
 const receiver=createECDH('prime256v1');receiver.generateKeys();
 const auth=randomBytes(16);
 return {receiver,auth,device:{endpoint:'https://fcm.googleapis.com/fcm/send/example',
  p256dh:receiver.getPublicKey().toString('base64url'),auth:auth.toString('base64url')}};
}
describe('Web Push',()=>{
 it('rejects fake push service origins and invalid keys',()=>{
  const {device}=subscription();
  expect(validateDevice(device)).toBe(true);
  expect(validateDevice({...device,endpoint:'https://fcm.googleapis.com.evil.example/x'})).toBe(false);
  expect(validateDevice({...device,p256dh:'invalid'})).toBe(false);
 });
 it('encrypts a message that the subscriber can decrypt',()=>{
  const {receiver,auth,device}=subscription();
  const message={title:'LeagueZone',body:'Weekly research',url:'/research'};
  const buf=encryptPush(device,message);
  const salt=buf.subarray(0,16);
  expect(buf.readUInt32BE(16)).toBe(4096);
  const senderPub=buf.subarray(21,21+buf[20]);
  const shared=receiver.computeSecret(senderPub);
  const info=Buffer.concat([Buffer.from('WebPush: info\0'),receiver.getPublicKey(),senderPub]);
  const ikm=Buffer.from(hkdfSync('sha256',shared,auth,info,32));
  const cek=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
  const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
  const ct=buf.subarray(21+buf[20]),decrypt=createDecipheriv('aes-128-gcm',cek,nonce);
  decrypt.setAuthTag(ct.subarray(-16));
  const raw=Buffer.concat([decrypt.update(ct.subarray(0,-16)),decrypt.final()]);
  expect(raw[raw.length-1]).toBe(2);
  expect(JSON.parse(raw.subarray(0,-1).toString())).toEqual(message);
 });
});
