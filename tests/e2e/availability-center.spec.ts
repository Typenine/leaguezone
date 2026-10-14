import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const player={sleeperId:'101',gsisId:null,name:'Example Receiver',position:'WR',team:'GB',
 injuryStatus:'Questionable',practice:'Limited',practiceText:'Limited',injuryStart:'2026-10-12',rosterStatus:null};
test.beforeEach(async({page})=>{
 await page.route('**/api/availability',route=>route.fulfill({json:{
  source:'Sleeper',sourceUrl:'https://docs.sleeper.com/',retrievedAt:new Date().toISOString(),
  notice:'Metadata, not official report',totalReported:1,players:[player]
 }}));
});
test('availability status, source, filtering and link to weekly center',async({page})=>{
 await page.goto('/availability');
 await expect(page.getByRole('heading',{name:'Availability & Opportunity'})).toBeVisible();
 await expect(page.getByText('Example Receiver',{exact:true})).toBeVisible();
 await expect(page.getByText('Questionable',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'official NFL injury reports'})).toHaveAttribute('href','https://www.nfl.com/injuries/');
 await page.getByLabel('NFL team').selectOption('DET');
 await expect(page.getByText('Example Receiver',{exact:true})).toHaveCount(0);
 await page.getByLabel('NFL team').selectOption('GB');
 await expect(page.getByText('Example Receiver',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'NFL Weekly Center'}).click();
 await expect(page).toHaveURL(/\/weekly/);
});
test('shows contextual teammate research and honest history empty state',async({page})=>{
 await page.goto('/availability');
 await page.getByRole('button',{name:'Opportunity context'}).first().click();
 await expect(page.getByRole('heading',{name:/Example Receiver/})).toBeVisible();
 await expect(page.getByRole('link',{name:'Opportunity Radar'})).toBeVisible();
 await expect(page.getByText(/No changes observed since this browser began tracking/)).toBeVisible();
});
test('mobile stays within viewport at 320px',async({page})=>{
 await page.setViewportSize({width:320,height:700});
 await page.goto('/availability');
 await expect(page.getByText('Example Receiver',{exact:true})).toBeVisible();
 const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 expect(sizes[0]).toBeLessThanOrEqual(sizes[1]+1);
});
test('invalid team is rejected without hitting upstream',async({request})=>{
 const r=await request.get('/api/availability?team=INVALID');
 expect(r.status()).toBe(400);
});
