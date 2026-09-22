import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isAutomatedPublicClient } from '@/lib/security/crawler-shield';

describe('public league crawler shield', () => {
  it('identifies common crawlers and scripted clients', () => {
    expect(isAutomatedPublicClient('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true);
    expect(isAutomatedPublicClient('facebookexternalhit/1.1')).toBe(true);
    expect(isAutomatedPublicClient('redditbot/1.0')).toBe(true);
    expect(isAutomatedPublicClient('curl/8.7.1')).toBe(true);
    expect(isAutomatedPublicClient('python-requests/2.32.0')).toBe(true);
    expect(isAutomatedPublicClient('Mozilla/5.0 HeadlessChrome/126.0')).toBe(true);
    expect(isAutomatedPublicClient('')).toBe(true);
  });

  it('allows ordinary interactive browsers', () => {
    expect(isAutomatedPublicClient(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
    )).toBe(false);
    expect(isAutomatedPublicClient(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    )).toBe(false);
  });

  it('keeps the expensive public league surface inside middleware', () => {
    const middleware = readFileSync(new URL('../../src/middleware.ts', import.meta.url), 'utf8');
    expect(middleware).toContain("'/l/:path*'");
    expect(middleware).toContain("'/demo'");
    expect(middleware).toContain('crawlerShieldResponse(req)');
    expect(middleware).toContain('X-LeagueZone-Crawler-Shield');
    expect(middleware).toContain('publicBrowserGateResponse(req)');
    expect(middleware).toContain('lz_public_browser');
    expect(middleware).toContain('X-LeagueZone-Browser-Gate');
  });

  it('keeps anonymous marketing pages from inheriting demo-league database work', () => {
    const rootLayout = readFileSync(new URL('../../src/app/layout.tsx', import.meta.url), 'utf8');
    const teamLogos = readFileSync(new URL('../../src/contexts/TeamLogoContext.tsx', import.meta.url), 'utf8');
    expect(rootLayout).toContain('hasAuthenticatedSession && activeLeagueId');
    expect(teamLogos).toContain('needsTeamBranding');
    expect(teamLogos).toContain("pathname === '/'");
  });

  it('does not report a database outage as an invalid password', () => {
    const auth = readFileSync(new URL('../../src/lib/server/user-auth.ts', import.meta.url), 'utf8');
    const login = readFileSync(new URL('../../src/app/api/auth/login/route.ts', import.meta.url), 'utf8');
    expect(auth).toContain('getUserByEmailOrThrow');
    expect(login).toContain('AUTH_SERVICE_UNAVAILABLE');
    expect(login).toContain('status: 503');
  });

  it('publishes crawler rules that keep bots out of league and app routes', () => {
    const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8');
    expect(robots).toContain('Disallow: /l/');
    expect(robots).toContain('Disallow: /demo');
    expect(robots).toContain('Disallow: /api/');
  });
});
