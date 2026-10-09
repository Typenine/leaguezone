import { test, expect } from '@playwright/test';

test.describe('LeagueZone app install', () => {
  test('the manifest has valid app scope, launch destination, and icon assets', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.id).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/?view=public');
    expect(manifest.name).toContain('LeagueZone');

    for (const size of [192, 512]) {
      const icon = await request.get('/pwa/icon-' + size + '.png');
      expect(icon.ok()).toBeTruthy();
      expect(icon.headers()['content-type']).toContain('image/png');
      const bytes = await icon.body();
      expect(bytes.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16)).toBe(size);
      expect(bytes.readUInt32BE(20)).toBe(size);
      expect(manifest.icons).toEqual(expect.arrayContaining([
        expect.objectContaining({ src: '/pwa/icon-' + size + '.png', sizes: size + 'x' + size }),
      ]));
    }
  });

  test('homepage has a working install link and a browser fallback', async ({ page }) => {
    await page.goto('/?view=public');
    await page.getByRole('link', { name: /get the leaguezone app for your phone/i }).click();
    await expect(page).toHaveURL(/\/install$/);
    await expect(page.getByRole('heading', { name: 'Install LeagueZone' })).toBeVisible();
    await expect(page.getByText(/browser menu/i)).toBeVisible();
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  });

  test('installation uses the browser event only when actually offered', async ({ page }) => {
    await page.goto('/install');
    await expect(page.getByText(/browser menu/i)).toBeVisible();
    await page.evaluate(() => {
      const offered = new Event('beforeinstallprompt');
      Object.defineProperties(offered, {
        prompt: { value: () => Promise.resolve() },
        userChoice: { value: Promise.resolve({ outcome: 'accepted', platform: 'web' }) },
      });
      window.dispatchEvent(offered);
    });
    await page.getByRole('button', { name: 'Install LeagueZone' }).click();
    await expect(page.getByText('LeagueZone is running in its installed app window.')).toBeVisible();
  });

  test('public research is an installable entry point and has a link back', async ({ page }) => {
    await page.goto('/research');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    await expect(page.locator('script[src="/research/pwa.js"]')).toHaveCount(1);
    await page.getByRole('link', { name: 'Get the App' }).click();
    await expect(page).toHaveURL(/\/install$/);
  });

  test('mobile install instructions have no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/install');
    await expect(page.getByRole('heading', { name: 'Install LeagueZone' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
