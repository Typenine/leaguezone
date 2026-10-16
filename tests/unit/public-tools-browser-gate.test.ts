import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const browser = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36';
const request = (path: string, options?: { cookie?: string; agent?: string }) =>
  new NextRequest('https://www.leaguezonehq.com' + path, {
    headers: {
      'user-agent': options?.agent || browser,
      ...(options?.cookie ? { cookie: options.cookie } : {}),
    },
  });

describe('public fantasy tools browser session', () => {
  it.each(['/fantasy-tools', '/fantasy-tools/trade', '/fantasy-tools/rankings'])(
    'establishes the existing public league-data gate on %s', async (path) => {
      const response = await middleware(request(path));
      expect(response.status).toBe(200);
      expect(response.cookies.get('lz_public_browser')?.value).toBe('1');
      expect(response.cookies.get('lz_public_browser')?.path).toBe('/');
    },
  );

  it('unblocks the market API after tool entry without unblocking direct unverified requests', async () => {
    const withoutCookie = await middleware(request('/api/trade-analyzer/values'));
    expect(withoutCookie.status).toBe(403);
    const withCookie = await middleware(request('/api/trade-analyzer/values', { cookie: 'lz_public_browser=1' }));
    expect(withCookie.status).toBe(200);
  });

  it('does not issue an API-access cookie to automated page visitors', async () => {
    const response = await middleware(request('/fantasy-tools/trade', { agent: 'Googlebot/2.1' }));
    expect(response.cookies.get('lz_public_browser')).toBeUndefined();
    const market = await middleware(request('/api/trade-analyzer/values', {
      cookie: 'lz_public_browser=1',
      agent: 'Googlebot/2.1',
    }));
    expect(market.status).toBe(403);
  });
});
