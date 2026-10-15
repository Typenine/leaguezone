import {test,expect} from '@playwright/test';

// Browser checks deliberately mock Sleeper and account APIs, so the navigation
// contract is exercised without relying on live Sleeper or seeded credentials.
const leagueId='1205237529570193408';
const rosterId=2;
const saved={leagueId,rosterId};
const preview={leagueId,leagueName:'Example Sleeper League',season:2026,
 teams:[{rosterId,teamName:'Example Team'},{rosterId:3,teamName:'Other Team'}]};
test('a guest with a remembered Sleeper league opens public decisions, not a login-only team page',async({page})=>{
 await page.addInitScript(({leagueId,rosterId})=>
  localStorage.setItem('leaguezone:remembered-sleeper:v1',JSON.stringify({leagueId,rosterId})),saved);
 await page.route('**/api/research/sleeper/connections',route=>route.fulfill({
  status:401,contentType:'application/json',body:'{"error":"Sign in"}'}));
 await page.route('**/api/public-fantasy/league?*',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify(preview)}));
 await page.goto('/');
 const card=page.getByRole('region',{name:'Current fantasy league'});
 await expect(card).toContainText('Last used Sleeper league');
 await expect(card.getByRole('link',{name:'My team decisions'}))
  .toHaveAttribute('href',/\/fantasy-tools\/roster\?leagueId=/);
 await card.getByRole('link',{name:'My team decisions'}).click();
 await expect(page).toHaveURL(/\/fantasy-tools\/roster\?leagueId=/);
 await expect(page.getByRole('heading',{name:'Improve My Roster'})).toBeVisible();
});

test('guest Sleeper league IDs and URLs show team selection without signing in',async({page})=>{
 await page.route('**/api/research/sleeper/connections',route=>route.fulfill({
  status:401,contentType:'application/json',body:'{"error":"Sign in"}'}));
 await page.route('**/api/public-fantasy/league?*',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify(preview)}));
 await page.goto('/fantasy-tools/waivers');
 await page.getByRole('textbox',{name:'Sleeper league ID'}).fill('https://sleeper.com/leagues/'+leagueId);
 await page.getByRole('button',{name:'Find teams'}).click();
 await expect(page.getByText('Example Sleeper League (2026)')).toBeVisible();
 await expect(page.getByRole('option',{name:'Example Team'})).toHaveCount(1);
});

test('an account-saved league appears on Home and the tools workspace',async({page})=>{
 await page.route('**/api/research/sleeper/connections',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify({
   connections:[{...preview.teams[0],...saved,leagueName:preview.leagueName,season:preview.season}]
  })}));
 await page.route('**/api/research/sleeper/context?*',route=>route.fulfill({
  status:503,contentType:'application/json',body:'{"error":"Test roster data unavailable"}'}));
 await page.goto('/');
 const card=page.getByRole('region',{name:'Current fantasy league'});
 await expect(card).toContainText('Example Sleeper League');
 await card.getByRole('link',{name:'Waiver Finder'}).click();
 await expect(page).toHaveURL(/\/fantasy-tools\/waivers\?leagueId=/);
 await expect(page.getByRole('option',{name:/Example Sleeper League/})).toHaveCount(1);
 await expect(page.getByText('Test roster data unavailable')).toBeVisible();
});
