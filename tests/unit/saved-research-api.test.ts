import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/server/session',()=>({requireUser:vi.fn()}));
vi.mock('@/server/db/client',()=>({getDb:vi.fn()}));
import {requireUser} from '@/lib/server/session';
import {getDb} from '@/server/db/client';
import {GET,POST,DELETE} from '@/app/api/saved-research/route';

const execute=vi.fn();
const base='https://leaguezone.example/api/saved-research';
const req=(method:'GET'|'POST'|'DELETE',body?:unknown,opts:{origin?:string;cookie?:string}={})=>
  new NextRequest(base,{method,headers:{
    ...(method==='GET'?{}:{'Content-Type':'application/json','Origin':opts.origin||'https://leaguezone.example'}),
    ...(opts.cookie?{cookie:opts.cookie}:{})
  },...(body===undefined?{}:{body:JSON.stringify(body)})});

describe('account watchlists',()=>{
  beforeEach(()=>{
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue({userId:'d2053702-1887-4118-b420-713b318a8367'});
    execute.mockReset();
    vi.mocked(getDb).mockReturnValue({execute} as never);
  });
  it('never reads or writes for signed-out visitors',async()=>{
    vi.mocked(requireUser).mockResolvedValue(null);
    expect((await GET(req('GET'))).status).toBe(401);
    expect((await POST(req('POST',{item:{type:'view',title:'Stats',href:'/research/stats'}}))).status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });
  it('blocks cross-origin saves and QA impersonation',async()=>{
    expect((await POST(req('POST',{item:{type:'view',title:'Stats',href:'/research/stats'}},{origin:'https://other.example'}))).status).toBe(403);
    expect((await GET(req('GET',undefined,{cookie:'lz_qa_session=something'}))).status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });
  it('returns only the signed-in account rows with no shared cache',async()=>{
    execute.mockResolvedValue({rows:[{item_key:'player:00-0034857',item_type:'player',
      title:'Josh Allen',href:'/research/players/00-0034857',saved_at_ms:1790000000000}]});
    const response=await GET(req('GET'));
    const data=await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(data.items[0].key).toBe('player:00-0034857');
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('rejects unsafe views before touching Postgres',async()=>{
    const response=await POST(req('POST',{item:{type:'view',title:'Unsafe',href:'https://evil.example/x'}}));
    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
  it('upserts a valid player to the current user account',async()=>{
    execute.mockResolvedValue({rows:[{item_key:'player:00-0034857'}]});
    const response=await POST(req('POST',{item:{type:'player',title:'Josh Allen',href:'/research/players/00-0034857?season=2026'}}));
    expect(response.status).toBe(200);
    expect((await response.json()).item.key).toBe('player:00-0034857');
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('imports a batch once instead of one database call per player',async()=>{
    execute.mockResolvedValue({rows:[{item_key:'player:00-0034857'}]});
    const response=await POST(req('POST',{import:[{type:'player',title:'Josh Allen',
      href:'/research/players/00-0034857?season=2026',savedAt:1790000000000}]}));
    expect(response.status).toBe(200);
    expect((await response.json()).imported).toBe(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('removes a saved player through a user-scoped delete',async()=>{
    execute.mockResolvedValue({rows:[]});
    const response=await DELETE(req('DELETE',{key:'player:00-0034857'}));
    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
