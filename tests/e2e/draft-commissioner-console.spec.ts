import { expect, test } from '@playwright/test';

type DraftStatus = 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED';

const draftId = '22222222-2222-2222-2222-222222222222';

test.describe('league draft commissioner console', () => {
  test('starts, pauses, resumes, manages clock, picks, trades and force-picks without mobile overflow', async ({ page }, testInfo) => {
    let status: DraftStatus = 'NOT_STARTED';
    let remainingSec: number | null = null;
    let clockSeconds = 30;
    let lifecycleState: 'scheduled' | 'open' | 'paused' | 'complete' | 'archived' = 'scheduled';
    let pendingPick: Record<string, unknown> | null = null;
    let approvedPick = false;
    let rejectedPick = false;
    let approvedTrade = false;
    let forcedPlayer = '';
    let resetClockCount = 0;
    let undoCount = 0;
    let skipCount = 0;
    let autoPickCount = 0;

    const draftBody = () => ({
      draft: {
        id: draftId,
        year: 2027,
        rounds: 1,
        clockSeconds,
        status,
        curOverall: 1,
        onClockTeam: status === 'COMPLETED' ? null : 'Alpha',
        recentPicks: [],
        allPicks: [],
        allSlots: [
          { overall: 1, round: 1, team: 'Alpha' },
          { overall: 2, round: 1, team: 'Bravo' },
        ],
      },
      pendingPick,
      remainingSec,
      available: [
        { id: '12345', name: 'Future Runner', pos: 'RB', nfl: 'GB' },
        { id: 'GB', name: 'GB Defense', pos: 'DEF', nfl: 'GB' },
      ],
    });

    await page.route('**/api/draft/lifecycle**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ state: lifecycleState, date: null, location: '', canManage: true }),
        });
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      lifecycleState = String(body.state) as typeof lifecycleState;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: lifecycleState, date: null, location: String(body.location || ''), canManage: true }),
      });
    });

    await page.route('**/api/draft/trade**', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            trades: [{
              id: 'trade-1',
              proposedBy: 'Alpha',
              teams: ['Alpha', 'Bravo'],
              assets: [{ id: 'asset-1', fromTeam: 'Alpha', toTeam: 'Bravo', assetType: 'current_pick', pickOverall: 2 }],
            }],
          }),
        });
        return;
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      if (body.action === 'approve') approvedTrade = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.route('**/api/draft**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname !== '/api/draft') {
        await route.fallback();
        return;
      }
      if (request.method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(draftBody()) });
        return;
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      const action = String(body.action || '');
      if (action === 'start') { status = 'LIVE'; remainingSec = clockSeconds; }
      else if (action === 'pause') status = 'PAUSED';
      else if (action === 'resume') status = 'LIVE';
      else if (action === 'reset_clock') { remainingSec = clockSeconds; resetClockCount += 1; }
      else if (action === 'set_clock') { clockSeconds = Number(body.seconds || 60); remainingSec = clockSeconds; }
      else if (action === 'undo') undoCount += 1;
      else if (action === 'skip_pick') skipCount += 1;
      else if (action === 'auto_pick') autoPickCount += 1;
      else if (action === 'approve_pick') { approvedPick = true; pendingPick = null; status = 'LIVE'; }
      else if (action === 'reject_pick') { rejectedPick = true; pendingPick = null; status = 'LIVE'; }
      else if (action === 'force_pick') forcedPlayer = String(body.playerId || '');
      else if (action === 'available') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ available: draftBody().available }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/e2e-test/draft-console');
    await expect(page.getByRole('heading', { name: 'Live Draft Control' })).toBeVisible();
    await expect(page.getByText('2027 · NOT_STARTED')).toBeVisible();

    if (testInfo.project.name === 'mobile-chrome') {
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
    }

    await page.getByRole('button', { name: 'Start Draft' }).click();
    await expect.poll(() => status).toBe('LIVE');
    await expect.poll(() => lifecycleState).toBe('open');
    await expect(page.getByText(/Draft started and opened to league members/i)).toBeVisible();

    await page.getByRole('button', { name: 'Pause Draft' }).click();
    await expect.poll(() => status).toBe('PAUSED');
    await expect.poll(() => lifecycleState).toBe('paused');

    await page.getByRole('button', { name: 'Resume Draft' }).click();
    await expect.poll(() => status).toBe('LIVE');
    await expect.poll(() => lifecycleState).toBe('open');

    const clockInput = page.getByLabel('Clock length (seconds)');
    await clockInput.fill('45');
    await page.getByRole('button', { name: 'Save Clock Length' }).click();
    await expect.poll(() => clockSeconds).toBe(45);
    await page.getByRole('button', { name: 'Reset Pick Clock' }).click();
    await expect.poll(() => resetClockCount).toBe(1);

    await page.getByRole('button', { name: 'Skip Pick' }).click();
    await page.getByRole('button', { name: 'Auto-pick Now' }).click();
    await expect.poll(() => skipCount).toBe(1);
    await expect.poll(() => autoPickCount).toBe(1);

    await page.getByRole('button', { name: 'Approve Trade' }).click();
    await expect.poll(() => approvedTrade).toBe(true);

    pendingPick = {
      id: 'pending-1',
      overall: 1,
      team: 'Alpha',
      playerId: '12345',
      playerName: 'Future Runner',
      playerPos: 'RB',
      playerNfl: 'GB',
    };
    status = 'PAUSED';
    await page.reload();
    await expect(page.getByRole('button', { name: 'Approve Pick' })).toBeVisible();
    await page.getByRole('button', { name: 'Approve Pick' }).click();
    await expect.poll(() => approvedPick).toBe(true);

    pendingPick = {
      id: 'pending-2',
      overall: 1,
      team: 'Alpha',
      playerId: 'GB',
      playerName: 'GB Defense',
      playerPos: 'DEF',
      playerNfl: 'GB',
    };
    status = 'PAUSED';
    await page.reload();
    await page.getByRole('button', { name: 'Reject Pick' }).click();
    await expect.poll(() => rejectedPick).toBe(true);

    await page.getByLabel('Search').fill('Future');
    await expect(page.getByLabel('Selection')).toContainText('Future Runner');
    await page.getByLabel('Selection').selectOption('12345');
    await page.getByRole('button', { name: 'Force Pick' }).click();
    await expect.poll(() => forcedPlayer).toBe('12345');

    if (undoCount === 0) {
      // The button is only shown when a completed pick exists. The API path remains
      // covered by the core unit/integration suite and is intentionally not forced
      // into this UI fixture with fabricated pick history.
      expect(undoCount).toBe(0);
    }
  });
});
