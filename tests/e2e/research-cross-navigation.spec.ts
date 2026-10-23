import {test,expect} from './research-test';
test.use({serviceWorkers:'block'});
test('connects the Next.js Weekly Center and static Radar pages',async({page})=>{
 await page.goto('/weekly');
 const nav=page.getByRole('navigation',{name:'Research'});
 await expect(nav.getByRole('link',{name:'Weekly Center'})).toHaveAttribute('aria-current','page');
 await nav.getByRole('link',{name:'Radar',exact:true}).click();
 await expect(page).toHaveURL(/\/research\/radar/);
 const staticNav=page.getByRole('navigation',{name:'Research destinations'});
 await expect(staticNav.getByRole('link',{name:'Radar',exact:true})).toHaveAttribute('aria-current','page');
 await staticNav.getByRole('link',{name:'Weekly Center'}).click();
 await expect(page).toHaveURL(/\/weekly/);
});
test('connects saved, my research and player hub without relying on back',async({page})=>{
 await page.goto('/saved');
 const nav=page.getByRole('navigation',{name:'Hub sections'});
 await expect(nav.getByRole('link',{name:'Watchlists'})).toHaveAttribute('aria-current','page');
 await nav.getByRole('link',{name:'My Research'}).click();
 await expect(page).toHaveURL(/\/my-research/);
 await page.goto('/research/players');
 await expect(page.getByRole('navigation',{name:'Research destinations'}).getByRole('link',{name:'Players'})).toHaveAttribute('aria-current','page');
});
test('research navigation scrolls within its own bar at 320px without overflowing the page',async({page})=>{
 await page.setViewportSize({width:320,height:720});
 await page.goto('/weekly');
 const nav=page.getByRole('navigation',{name:'Research',exact:true});
 await expect(nav).toBeVisible();
 await expect(nav.getByRole('link',{name:'Weekly Center'})).toBeVisible();
 const metrics=await page.evaluate(()=>{
  const el=document.querySelector('nav[aria-label="Research"]')!;
  return {page:document.documentElement.scrollWidth,screen:document.documentElement.clientWidth,
   navScroll:el.scrollWidth,navClient:el.clientWidth};
 });
 expect(metrics.page).toBeLessThanOrEqual(metrics.screen+1);
 expect(metrics.navScroll).toBeGreaterThanOrEqual(metrics.navClient);
});
