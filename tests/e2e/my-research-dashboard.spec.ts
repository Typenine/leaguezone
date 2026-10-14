import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test.describe('personal research dashboard',()=>{
 test('guest dashboard has meaningful empty states and links',async({page})=>{
  await page.goto('/my-research');
  await expect(page.getByTestId('my-research-dashboard')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Watchlist activity'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'My research feed'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'League-aware research'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Continue researching'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Find players'})).toHaveAttribute('href','/research/players');
 });
 test('guest layout persists after reload and can be restored',async({page})=>{
  await page.goto('/my-research');
  await page.getByRole('button',{name:'Customize'}).click();
  await page.locator('#lz-dashboard-settings input[type="checkbox"]').first().uncheck();
  await page.getByRole('button',{name:'Save dashboard settings'}).click();
  await expect(page.getByRole('heading',{name:'Watchlist activity'})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Watchlist activity'})).toHaveCount(0);
  await page.getByRole('button',{name:'Customize'}).click();
  await page.getByRole('button',{name:'Restore default layout'}).click();
  await page.getByRole('button',{name:'Save dashboard settings'}).click();
  await expect(page.getByRole('heading',{name:'Watchlist activity'})).toBeVisible();
 });
 test('mobile navigation and dashboard do not overflow',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('/my-research');
  await expect(page.getByTestId('my-research-dashboard')).toBeVisible();
  const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
  expect(sizes[0]).toBeLessThanOrEqual(sizes[1]+1);
 });
 test('anonymous requests cannot read or update account settings',async({request})=>{
  const get=await request.get('/api/dashboard-preferences');
  expect(get.status()).toBe(401);
  const post=await request.put('/api/dashboard-preferences',{data:{scoring:'ppr'}});
  expect([401,403]).toContain(post.status());
 });
});
