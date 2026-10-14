import { NextRequest, NextResponse } from 'next/server';
import {isAutomatedPublicClient} from '@/lib/security/crawler-shield';

// Only immutable published public football research and the current catalog.
// Same-origin access avoids browser CORS/network-policy failures that previously
// sent users silently back to the archived Week 4 bundle.
export const runtime = 'nodejs';
const BASE = 'https://leaguezone-research-data.patrickmmcnulty62.workers.dev';
const OBJECT = /^research\/v1\/objects\/20\d\d-[a-f0-9]{64}\.json$/;
const CATALOG = 'research/v1/catalog.json';

export async function GET(request: NextRequest, {params}: {params: Promise<{path:string[]}>}) {
  if(isAutomatedPublicClient(request.headers.get('user-agent')))
    return NextResponse.json({error:'Automated research proxy access is unavailable.'},{status:403});
  const {path} = await params;
  const key = Array.isArray(path) ? path.join('/') : '';
  if (key!==CATALOG && !OBJECT.test(key)) {
    return NextResponse.json({error:'Research object not found.'},{status:404});
  }
  try {
    const ttl = key===CATALOG ? 60 : 86400;
    const res = await fetch(BASE+'/'+key, {
      headers: {Accept:'application/json', 'User-Agent':'LeagueZoneResearch/1.0'},
      next: {revalidate:ttl},
      signal:AbortSignal.timeout(10000),
    });
    if (!res.ok) throw Error('Upstream research unavailable: '+res.status);
    const type = res.headers.get('content-type')||'';
    if (!type.toLowerCase().includes('application/json')) throw Error('Invalid upstream content type');
    const raw = await res.text();
    if (raw.length>3_000_000 || !raw.trimStart().startsWith('{')) throw Error('Invalid research payload');
    return new NextResponse(raw,{headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':key===CATALOG?'public, s-maxage=60, stale-while-revalidate=120':
        'public, s-maxage=86400, stale-while-revalidate=604800',
      'X-Research-Source':'r2'
    }});
  } catch(error) {
    console.warn('[research-feed]',key,error instanceof Error?error.message:'Upstream unavailable');
    return NextResponse.json({error:'Live research is temporarily unavailable.'},{status:503,
      headers:{'Cache-Control':'no-store'}});
  }
}
