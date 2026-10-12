import { test, expect } from '@playwright/test';

test.describe('Shared LeagueZone companion', () => {
  test('mobile navbar works across public home and research', async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await page.goto('/?view=public');
    await expect(page.getByRole('navigation',{name:'LeagueZone mobile app navigation'})).toBeVisible();
    await page.getByRole('navigation',{name:'LeagueZone mobile app navigation'})
      .getByRole('link',{name:'Research'}).click();
    await expect(page).toHaveURL(/\/research$/);
    await expect(page.getByRole('navigation',{name:'LeagueZone mobile app navigation'})).toBeVisible();
  });

  test('universal search finds players and tools from public research files', async ({page}) => {
    await page.goto('/research');
    await page.getByRole('button',{name:'Search all LeagueZone'}).click();
    await expect(page.getByRole('heading',{name:'Search LeagueZone'})).toBeVisible();
    const search=page.getByRole('searchbox',{name:'Search',exact:true});
    await search.fill('Josh Allen');
    await expect(page.getByRole('link',{name:/Josh Allen/}).first()).toBeVisible();
    await search.fill('Opportunity Radar');
    await expect(page.getByRole('link',{name:/Opportunity Radar/}).first()).toBeVisible();
  });

  test('research profile offers watchlist and verified league lookup', async ({page}) => {
    await page.goto('/research/players/00-0034857?season=2026');
    await expect(page.locator('[data-lzc-watch]').first()).toBeVisible();
    await page.locator('[data-lzc-watch]').first().click();
    await expect(page.locator('[data-lzc-watch]').first()).toHaveAttribute('aria-pressed','true');
    await page.locator('[data-lzc-saved]').first().click();
    await expect(page.getByRole('heading',{name:'Saved research',exact:true})).toBeVisible();
    await expect(page.getByRole('dialog',{name:'LeagueZone tools'}).getByText('Josh Allen',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Close dialog'}).click();
    await page.locator('[data-lzc-player-leagues]').click();
    await expect(page.getByRole('heading',{name:/Check Josh Allen in my leagues/})).toBeVisible();
    await expect(page.getByText(/Sign in to a LeagueZone account/)).toBeVisible();
  });

  test('anonymous library endpoints are private and cron needs authorization',async ({request})=>{
    const library=await request.get('/api/me/research-library');
    expect(library.status()).toBe(401);
    const push=await request.get('/api/me/notifications');
    expect(push.status()).toBe(401);
    const cron=await request.get('/api/cron/research-alerts');
    expect(cron.status()).toBe(401);
  });

  test('previously visited research can be read offline',async ({page})=>{
    await page.goto('/research/stats');
    const player=page.locator('button[data-profile="00-0034857"]:visible').first();
    await expect(player).toBeVisible();
    await page.waitForFunction(async()=>{
      if(!navigator.serviceWorker?.controller)return false;
      const shell=await caches.open('leaguezone-pwa-v3-static');
      const research=await caches.open('leaguezone-pwa-v3-research');
      return Boolean(await shell.match('/research/index.html')) &&
        Boolean(await research.match('/research/data/2026.json'));
    },null,{timeout:20000});
    await page.context().setOffline(true);
    try {
      // The already loaded static research app navigates player profiles
      // client-side. No additional network access should be necessary.
      await player.click();
      await expect(page).toHaveURL(/\/research\/players\/00-0034857\?season=2026/);
      await expect(page.locator('#page-title')).toHaveText('Josh Allen',{timeout:15000});
      await expect(page.locator('#profile-summary')).toBeVisible();
    } finally {
      await page.context().setOffline(false);
    }
  });

  test('offline worker contains bounded research caches and excludes APIs',async ({request})=>{
    const worker=await request.get('/sw.js');
    expect(worker.ok()).toBeTruthy();
    const text=await worker.text();
    expect(text).toContain("url.pathname.startsWith('/api/')");
    expect(text).toContain('LIMITS.research');
    expect(text).toContain("self.addEventListener('push'");
  });
});
