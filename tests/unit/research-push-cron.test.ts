import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/server/db/client',()=>({getDb:vi.fn()}));
vi.mock('@/lib/server/cron-auth',()=>({isCronAuthorized:vi.fn(()=>true)}));
vi.mock('@/lib/server/session',()=>({requireUser:vi.fn()}));
vi.mock('@/lib/server/web-push',async(importOriginal)=>({
  ...(await importOriginal<typeof import('@/lib/server/web-push')>()),
  publicVapidKey:vi.fn(()=>'public-key'),sendPush:vi.fn(),
}));
import {createECDH,randomBytes} from 'node:crypto';
import {PgDialect} from 'drizzle-orm/pg-core';
import type {SQL} from 'drizzle-orm';
import {getDb} from '@/server/db/client';
import {requireUser} from '@/lib/server/session';
import {sendPush} from '@/lib/server/web-push';
import {GET} from '@/app/api/cron/research-push/route';
import {announcement} from '@/lib/server/research-push';
import {POST} from '@/app/api/push/route';

const execute=vi.fn();
const dialect=new PgDialect();
const text=(call:unknown[])=>dialect.sqlToQuery(call[0] as SQL).sql.replace(/\s+/g,' ');
const params=(call:unknown[])=>dialect.sqlToQuery(call[0] as SQL).params;
const today=new Date().toISOString().slice(0,10);
const catalog=(updated:string,week=6)=>({schema:1,files:{'2025':{throughWeek:18,updated:'2026-01-08'},'2026':{throughWeek:week,updated}}});
const row=(id:string)=>({id,endpoint:'https://fcm.googleapis.com/fcm/send/'+id,p256dh:'k',auth_secret:'a'});
function serveCatalog(body:unknown){vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(body),{status:200})))}

describe('research push delivery',()=>{
  beforeEach(()=>{
    vi.mocked(sendPush).mockReset();
    execute.mockReset();
    vi.mocked(getDb).mockReturnValue({execute} as never);
  });
  it('never queries Postgres for an offseason or stale catalog',async()=>{
    serveCatalog(catalog('2026-01-08',18));
    const response=await GET(new Request('https://lz.example/api/cron/research-push'));
    expect(await response.json()).toMatchObject({ok:true,skipped:'no_recent_refresh'});
    expect(execute).not.toHaveBeenCalled();
    expect(announcement(catalog('2026-10-15') as never,new Date('2026-10-17T15:00:00Z'))).toMatchObject({version:'2026:6'});
    expect(announcement(catalog('2026-10-15') as never,new Date('2026-10-19T15:00:00Z'))).toMatchObject({skipped:'no_recent_refresh'});
  });
  it('claims devices atomically before sending and batches cleanup writes',async()=>{
    serveCatalog(catalog(today));
    execute.mockResolvedValueOnce({rows:[row('a'),row('b'),row('c')]}).mockResolvedValue({rows:[]});
    vi.mocked(sendPush).mockResolvedValueOnce(201).mockResolvedValueOnce(410).mockResolvedValueOnce(500);
    const body=await (await GET(new Request('https://lz.example/api/cron/research-push'))).json();
    expect(body).toMatchObject({ok:true,year:2026,week:6,delivered:1,removed:1,failed:1});
    const claim=text(execute.mock.calls[0]);
    expect(claim).toContain('FOR UPDATE SKIP LOCKED');
    expect(claim).toMatch(/UPDATE leaguezone_push_subscriptions s SET last_research_version=\$\d+ FROM picked/);
    expect(claim).toContain('IS DISTINCT FROM');
    // Exactly one claim, one batched delete, one batched release: no per-device writes.
    expect(execute).toHaveBeenCalledTimes(3);
    expect(text(execute.mock.calls[1])).toContain('DELETE FROM leaguezone_push_subscriptions WHERE id::text IN ($1)');
    expect(params(execute.mock.calls[1])).toEqual(['b']);
    expect(text(execute.mock.calls[2])).toContain('SET last_research_version=NULL');
    expect(params(execute.mock.calls[2])).toEqual(['c','2026:6']);
  });
  it('does not immediately retry failures while processing multiple batches',async()=>{
    serveCatalog(catalog(today));
    const firstBatch=Array.from({length:50},(_,i)=>row(i===0?'fail':'ok'+i));
    execute.mockResolvedValueOnce({rows:firstBatch})
      .mockResolvedValueOnce({rows:[row('later')]})
      .mockResolvedValue({rows:[]});
    vi.mocked(sendPush).mockImplementation(async device=>
      device.endpoint.endsWith('/fail')?500:201);
    const body=await (await GET(new Request('https://lz.example/api/cron/research-push'))).json();
    expect(body).toMatchObject({ok:true,delivered:50,failed:1,removed:0});
    expect(vi.mocked(sendPush).mock.calls.filter(([device])=>device.endpoint.endsWith('/fail'))).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(text(execute.mock.calls[0])).toContain('FOR UPDATE SKIP LOCKED');
    expect(text(execute.mock.calls[1])).toContain('FOR UPDATE SKIP LOCKED');
    expect(text(execute.mock.calls[2])).toContain('SET last_research_version=NULL');
    expect(params(execute.mock.calls[2])).toEqual(['fail','2026:6']);
  });

  it('sends nothing when every device already has this week',async()=>{
    serveCatalog(catalog(today));
    execute.mockResolvedValue({rows:[]});
    expect(await (await GET(new Request('https://lz.example/api/cron/research-push'))).json()).toMatchObject({delivered:0});
    expect(sendPush).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe('push subscription ownership',()=>{
  const ecdh=createECDH('prime256v1');ecdh.generateKeys();
  const receiverKey=ecdh.getPublicKey().toString('base64url');
  beforeEach(()=>{execute.mockReset();vi.mocked(getDb).mockReturnValue({execute} as never)});
  it('moves a shared device to the account now signed in instead of rejecting it',async()=>{
    vi.mocked(requireUser).mockResolvedValue({userId:'d2053702-1887-4118-b420-713b318a8367'} as never);
    execute.mockResolvedValueOnce({rows:[{n:0}]}).mockResolvedValueOnce({rows:[{id:'x'}]});
    const response=await POST(new NextRequest('https://lz.example/api/push',{method:'POST',
      headers:{'Content-Type':'application/json',Origin:'https://lz.example'},
      body:JSON.stringify({researchUpdates:true,subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/abc',
        keys:{p256dh:receiverKey,auth:randomBytes(16).toString('base64url')}}})}));
    expect(response.status).toBe(200);
    const upsert=text(execute.mock.calls[1]);
    expect(upsert).toContain('ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id');
    expect(upsert).not.toContain('WHERE leaguezone_push_subscriptions.user_id');
  });
  it('requires a signed-in same-origin request',async()=>{
    vi.mocked(requireUser).mockResolvedValue(null);
    const make=(origin:string)=>new NextRequest('https://lz.example/api/push',{method:'POST',
      headers:{'Content-Type':'application/json',Origin:origin},body:'{}'});
    expect((await POST(make('https://evil.example'))).status).toBe(403);
    expect((await POST(make('https://lz.example'))).status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });
});
