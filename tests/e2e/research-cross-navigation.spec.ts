import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('connects the Next.js Weekly Center and static Radar pages',async({page})=>{
 await page.goto('/weekly');
 const nav=page.getByRole('navigation',{name:'Research tools'});
 await expect(nav.getByRole('link',{name:'Weekly Center'})).toHaveAttribute('aria-current','page');
 await nav.getByRole('link',{name:'Radar',exact:true}).click();
 await expect(page).toHaveURL(/\/research\/radar/);
 const staticNav=page.getByRole('navigation',{name:'Research tools'});
 await expect(staticNav.getByRole('link',{name:'Radar',exact:true})).toHaveAttribute('aria-current','page');
 await staticNav.getByRole('link',{name:'Weekly Center'}).click();
 await expect(page).toHaveURL(/\/weekly/);
});
test('connects saved, my research and player hub without relying on back',async({page})=>{
 await page.goto('/saved');
 const nav=page.getByRole('navigation',{name:'Research tools'});
 await expect(nav.getByRole('link',{name:'Saved',exact:true})).toHaveAttribute('aria-current','page');
 await nav.getByRole('link',{name:'My Research'}).click();
 await expect(page).toHaveURL(/\/my-research/);
 await page.getByRole('navigation',{name:'Research tools'}).getByRole('link',{name:'Players'}).click();
 await expect(page).toHaveURL(/\/research\/players/);
});
test('research navigation scrolls within its own bar at 320px without overflowing the page',async({page})=>{
 await page.setViewportSize({width:320,height:720});
 await page.goto('/weekly');
 const nav=page.getByRole('navigation',{name:'Research tools'});
 await expect(nav).toBeVisible();
 await expect(nav.getByRole('link',{name:'Weekly Center'})).toBeVisible();
 const metrics=await page.evaluate(()=>{
  const el=document.querySelector('nav[aria-label="Research tools"]')!;
  return {page:document.documentElement.scrollWidth,screen:document.documentElement.clientWidth,
   navScroll:el.scrollWidth,navClient:el.clientWidth};
 });
 expect(metrics.page).toBeLessThanOrEqual(metrics.screen+1);
 expect(metrics.navScroll).toBeGreaterThan(metrics.navClient);
});
