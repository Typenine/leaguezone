import { expect, test } from '@playwright/test';

type DraftStatus = 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED';
type Pick = {
  overall: number;
  round: number;
  team: string;
  playerId: string;
  playerName: string;
  playerPos: string;
  playerNfl: string;
  madeAt: string;
};
type Pending = {
  id: string;
  overall: number;
  team: string;
  playerId: string;
  playerName: string;
  playerPos: string;
  playerNfl: string;
} | null;

const firstTeam = 'Belleview Badgers';
const secondTeam = 'Mt. Lebanon Cake Eaters';
const draftId = '22222222-2222-2222-2222-222222222222';
const availablePlayers = [
  { id: 'auto1', name: 'Auto Runner', pos: 'RB', nfl: 'GB', college: 'Test State' },
  { id: 'rookie1', name: 'Rookie Receiver', pos: 'WR', nfl: 'SEA', college: 'Example U' },
  { id: 'GB', name: 'GB Defense', pos: 'DEF', nfl: 'GB', college: null },
];

function mockSessionCookie() {
  const payload = Buffer.from(JSON.stringify({
    type: 'user',
    sub: '33333333-3333-3333-3333-333333333333',
    exp: Date.now() + 60 * 60 * 1000,
  })).toString('base64url');
  return `${payload}.e2e-signature-placeholder`;
}

test.describe('draft lifecycle rehearsal', () => {
  test('trades a pick, queues/autopicks, approves, drafts a defense, animates media, completes and archives', async ({ page }) => {
    let status: DraftStatus = 'LIVE';
    let curOverall = 1;
    let remainingSec: number | null = 30;
    let pending: Pending = null;
    let picks: Pick[] = [];
    let queue: typeof availablePlayers = [];
    let tradeProposed = false;
    let tradeAccepted = false;
    let tradeApproved = false;
    let archived = false;
    const headshotRequests: string[] = [];
    let slots = [
      { overall: 1, round: 1, team: firstTeam },
      { overall: 2, round: 1, team: secondTeam },
    ];

    const currentTeam = () => status === 'COMPLETED' ? null : slots.find((slot) => slot.overall === curOverall)?.team || null;
    const currentDraft = () => ({
      id: draftId,
      year: 2027,
      rounds: 1,
      clockSeconds: 30,
      status,
      curOverall,
      onClockTeam: currentTeam(),
      deadlineTs: null,
      eventName: 'LeagueZone Rehearsal Draft',
      eventLogoUrl: null,
      eventColor1: '#a4c810',
      eventColor2: '#111111',
      recentPicks: [...picks],
      allPicks: [...picks],
      upcoming: slots.filter((slot) => slot.overall >= curOverall),
      allSlots: [...slots],
      roundEndPause: false,
      pendingTradeAnimation: null,
    });

    await page.context().addCookies([{
      name: 'evw_session',
      value: mockSessionCookie(),
      url: 'http://localhost:3000',
      httpOnly: true,
      sameSite: 'Lax',
    }]);

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false, isAdmin: true, claims: {} }),
      });
    });

    await page.route('**/api/draft/player-image**', async (route) => {
      const playerId = new URL(route.request().url()).searchParams.get('playerId') || '';
      headshotRequests.push(playerId);
      await route.fulfill({
        status: 200,
        contentType: 'image/gif',
        body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'),
      });
    });

    await page.route('**/api/draft/player-videos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          videos: [
            { playerId: 'auto1', playerName: 'Auto Runner', hasImage: true, hasVideo: false, videoUrl: null },
            { playerId: 'GB', playerName: 'GB Defense', hasImage: false, hasVideo: false, videoUrl: null },
          ],
        }),
      });
    });

    await page.route('**/api/draft/team-roster**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ players: [] }) });
    });

    const trades: Array<Record<string, unknown>> = [];
    await page.route('**/api/draft/trade**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'GET') {
        const action = url.searchParams.get('action');
        if (action === 'get_assets') {
          const team = url.searchParams.get('team');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              rosterPlayers: [],
              futurePicks: [],
              currentPicks: team === firstTeam ? [{ overall: 1, round: 1, team: firstTeam }] : [],
            }),
          });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ trades }) });
        return;
      }

      const body = request.postDataJSON() as Record<string, unknown>;
      const action = String(body.action || '');
      if (action === 'propose') {
        tradeProposed = true;
        const assets = Array.isArray(body.assets) ? body.assets : [];
        expect(assets).toEqual(expect.arrayContaining([
          expect.objectContaining({ assetType: 'current_pick', fromTeam: firstTeam, toTeam: secondTeam, pickOverall: 1 }),
        ]));
        trades.splice(0, trades.length, {
          id: 'trade-1',
          draftId,
          status: 'pending',
          proposedBy: firstTeam,
          teams: [firstTeam, secondTeam],
          acceptedBy: [firstTeam],
          proposedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          assets,
        });
      } else if (action === 'accept') {
        tradeAccepted = true;
        if (trades[0]) { trades[0].status = 'accepted'; trades[0].acceptedBy = [firstTeam, secondTeam]; }
      } else if (action === 'approve') {
        tradeApproved = true;
        if (trades[0]) trades[0].status = 'approved';
        slots = slots.map((slot) => slot.overall === 1 ? { ...slot, team: secondTeam } : slot);
      }
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
        if (url.searchParams.get('action') === 'player_info') {
          const playerId = url.searchParams.get('playerId');
          const player = availablePlayers.find((item) => item.id === playerId);
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ college: player?.college || null }) });
          return;
        }
        const includeAvailable = url.searchParams.get('include') === 'available';
        const body: Record<string, unknown> = {
          draft: currentDraft(),
          remainingSec,
          pendingPick: pending || undefined,
          revision: `${status}:${curOverall}:${pending?.id || ''}:${picks.length}`,
        };
        if (includeAvailable) {
          body.available = availablePlayers.filter((player) => !picks.some((pick) => pick.playerId === player.id));
          body.usingCustom = true;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        return;
      }

      const body = request.postDataJSON() as Record<string, unknown>;
      const action = String(body.action || '');
      if (action === 'queue_get') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, queue }) });
        return;
      }
      if (action === 'queue_set') {
        queue = Array.isArray(body.players) ? body.players as typeof availablePlayers : [];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      if (action === 'available') {
        const q = String(body.q || '').toLowerCase();
        const pos = String(body.pos || '').toUpperCase();
        const available = availablePlayers.filter((player) =>
          !picks.some((pick) => pick.playerId === player.id)
          && (!q || player.name.toLowerCase().includes(q))
          && (!pos || player.pos === pos)
        );
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available }) });
        return;
      }
      if (action === 'players_info') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ useCustom: true, count: availablePlayers.length }) });
        return;
      }
      if (action === 'pick') {
        const playerId = String(body.playerId || '');
        const player = availablePlayers.find((item) => item.id === playerId);
        if (!player || picks.some((pick) => pick.playerId === playerId)) {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'player_already_picked' }) });
          return;
        }
        pending = {
          id: `pending-${curOverall}`,
          overall: curOverall,
          team: currentTeam() || firstTeam,
          playerId,
          playerName: player.name,
          playerPos: player.pos,
          playerNfl: player.nfl,
        };
        status = 'PAUSED';
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pending: true }) });
        return;
      }
      if (action === 'approve_pick') {
        if (!pending) {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'no_pending_pick' }) });
          return;
        }
        picks = [...picks, {
          overall: pending.overall,
          round: 1,
          team: pending.team,
          playerId: pending.playerId,
          playerName: pending.playerName,
          playerPos: pending.playerPos,
          playerNfl: pending.playerNfl,
          madeAt: new Date().toISOString(),
        }];
        pending = null;
        curOverall += 1;
        if (curOverall > slots.length) {
          status = 'COMPLETED';
          remainingSec = null;
        } else {
          status = 'LIVE';
          remainingSec = 30;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      if (action === 'resume' || action === 'reset_clock') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.route('**/api/league-admin/drafts**', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            league: { id: 'league-e2e', slug: 'e2e-draft-league', name: 'Draft E2E League' },
            teams: [
              { rosterId: 1, teamName: firstTeam, ownerName: 'A' },
              { rosterId: 2, teamName: secondTeam, ownerName: 'B' },
            ],
            drafts: [{
              id: draftId,
              year: 2027,
              rounds: 1,
              clockSeconds: 30,
              status,
              archivedAt: archived ? new Date().toISOString() : null,
              createdAt: new Date().toISOString(),
              completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
              draftOrderType: 'custom',
              playerPool: { type: 'rookies_plus_defenses', syncedAt: new Date().toISOString(), draftableCount: 3, usesLiveSleeperPool: false },
            }],
          }),
        });
        return;
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      if (body.action === 'archive') archived = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/draft/room');
    await expect(page.getByText('LeagueZone Rehearsal Draft').or(page.getByText('2027 Draft'))).toBeVisible();

    await page.getByRole('button', { name: /Trade/ }).first().click();
    await page.getByRole('button', { name: 'Propose' }).click();
    const addTeam = page.locator('select').filter({ has: page.locator('option', { hasText: '+ Add team' }) });
    await addTeam.selectOption(secondTeam);
    await page.getByRole('button', { name: 'picks' }).first().click();
    await page.getByRole('button', { name: /Rd 1 Pk 1/ }).click();
    await page.getByRole('button', { name: 'Send Trade Offer' }).click();
    await expect.poll(() => tradeProposed).toBe(true);

    await page.evaluate(async ({ draftId }) => {
      await fetch('/api/draft/trade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'accept', draftId, tradeId: 'trade-1', team: 'Mt. Lebanon Cake Eaters' }) });
      await fetch('/api/draft/trade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', draftId, tradeId: 'trade-1' }) });
    }, { draftId });
    await expect.poll(() => tradeAccepted && tradeApproved && slots[0].team === secondTeam).toBe(true);

    await page.reload();
    await expect(page.getByText(secondTeam).first()).toBeVisible();

    const autoRunner = page.getByText('Auto Runner', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"flex items-start")][1]');
    await autoRunner.getByRole('button', { name: 'Queue' }).click();
    await expect.poll(() => queue.some((player) => player.id === 'auto1')).toBe(true);
    await page.locator('button').filter({ hasText: /^Queue$/ }).first().click();
    const autoPickLabel = page.getByText('Instant auto-pick');
    await autoPickLabel.locator('xpath=..').locator('div').click();
    await expect(page.getByText(/Instant — top queued player submitted/i)).toBeVisible();

    remainingSec = 0;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => pending?.playerId || null, { timeout: 8_000 }).toBe('auto1');
    await expect(page.getByText(/Pick Submitted — Awaiting Admin Approval/i)).toBeVisible();

    await page.evaluate(async () => {
      await fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve_pick' }) });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => picks.length).toBe(1);
    await expect(page.locator('.gsap-player-card')).toHaveCount(1, { timeout: 8_000 });
    await expect.poll(() => headshotRequests.includes('auto1'), { timeout: 8_000 }).toBe(true);

    await page.reload();
    const defenseRow = page.getByText('GB Defense', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"flex items-start")][1]');
    await defenseRow.getByRole('button', { name: 'Pick' }).click();
    await expect(page.getByText('Confirm Selection')).toBeVisible();
    await page.getByRole('button', { name: 'Yes, Draft Him' }).click();
    await expect.poll(() => pending?.playerId || null).toBe('GB');

    await page.evaluate(async () => {
      await fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve_pick' }) });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => status).toBe('COMPLETED');
    await expect.poll(() => picks.some((pick) => pick.playerId === 'GB' && pick.playerPos === 'DEF')).toBe(true);
    await expect(page.locator('.gsap-player-card')).toHaveCount(1, { timeout: 8_000 });
    expect(headshotRequests).not.toContain('GB');

    await page.goto('/__e2e/draft-setup');
    await expect(page.getByText('2027 Draft')).toBeVisible();
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect.poll(() => archived).toBe(true);
  });
});
