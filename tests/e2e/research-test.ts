/**
 * Archived public-research tests must remain reproducible as new weekly
 * Cloudflare/R2 snapshots are published. Without this deterministic fixture,
 * the test's independent oracle reads checked-in JSON while the browser
 * silently fetches fresher R2 data through /api/research-feed, creating false
 * failures on every weekly publish.
 *
 * Individual tests may override this route to exercise the remote catalog.
 * Production behavior and gateway integration remain covered separately.
 */
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/research/data-source.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ schema: 1, publicBase: '' }),
    }));
    await use(page);
  },
});

export { expect };
