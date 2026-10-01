import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('canonical LeagueZone navigation', () => {
  it('emits league-scoped dashboard and commissioner links from account surfaces', () => {
    const app = source('src/app/app/page.tsx');
    const grid = source('src/components/dashboard/MyLeaguesGrid.tsx');
    const switcher = source('src/components/GlobalLeagueSwitcher.tsx');
    const navbar = source('src/components/layout/UnifiedNavbar.tsx');

    expect(app).toContain("leagueUrl(league.leagueSlug, 'dashboard')");
    expect(grid).toContain("leagueUrl(league.leagueSlug, 'dashboard')");
    expect(grid).toContain("leagueUrl(league.leagueSlug, 'admin')");
    expect(switcher).toContain('/dashboard');
    expect(navbar).toContain('/dashboard');

    expect(app).not.toContain("selectedLeagueHref(league.leagueId, '/home')");
    expect(grid).not.toContain("dashboardHref(league.leagueId, '/home')");
    expect(grid).not.toContain("dashboardHref(league.leagueId, '/settings')");
  });

  it('keeps /home only as a compatibility redirect', () => {
    const home = source('src/app/home/page.tsx');
    const middleware = source('src/middleware.ts');

    expect(home).toContain("redirect('/app')");
    expect(middleware).toContain("if (pathname === '/home') return '/dashboard'");
    expect(middleware).toContain("'/home'");
    expect(middleware).toContain("'/standings/:path*'");
    expect(middleware).toContain("'/rules/:path*'");
    expect(middleware).toContain("'/suggestions/:path*'");
  });

  it('does not keep the retired parallel navbar implementation', () => {
    expect(existsSync(new URL('../../src/components/layout/navbar.tsx', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../../src/lib/constants/navigation.ts', import.meta.url))).toBe(false);
  });
});
