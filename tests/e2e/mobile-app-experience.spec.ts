import {test,expect} from '@playwright/test';

test('mobile bottom navigation connects the platform tools',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/search');
 const nav=page.getByRole('navigation',{name:'LeagueZone app navigation'});
 await expect(nav).toBeVisible();
 for(const label of ['Home','Research','Players','My Leagues','Profile'])
  await expect(nav.getByRole('link',{name:label})).toBeVisible();
 await nav.getByRole('link',{name:'Profile'}).click();
 await expect(page).toHaveURL(/\/profile$/);
 await expect(page.getByRole('link',{name:/Saved research/i})).toBeVisible();
});

test('search public backup players without enumerating hosted leagues',async({page})=>{
 await page.goto('/search');
 const input=page.getByRole('searchbox');
 await input.fill('Josh Allen');
 await expect(page.getByRole('link',{name:/Josh Allen/i}).first()).toBeVisible();
 await expect(page.getByText(/No matching leagues connected/i)).toBeVisible();
});

test('saved public research persists across navigation',async({page})=>{
 await page.goto('/research/players/00-0034857?season=2026');
 await expect(page.locator('#page-title')).toContainText('Josh Allen');
 await page.getByRole('button',{name:'Follow player'}).click();
 await expect(page.locator('#lz-saved-feedback')).toContainText('Saved on this device');
 await page.goto('/saved');
 await expect(page.getByRole('link',{name:'Josh Allen'})).toBeVisible();
 await page.getByRole('button',{name:'Remove Josh Allen'}).click();
 await expect(page.getByText('No saved research yet')).toBeVisible();
});

test('research shell exposes integrated player ownership lookup',async({page})=>{
 await page.goto('/research/players/00-0034857?season=2026');
 const action=page.getByRole('link',{name:'Check player in my leagues'});
 await expect(action).toHaveAttribute('href','/player-leagues/00-0034857');
 await action.click();
 await expect(page.getByRole('heading',{name:'Player ownership'})).toBeVisible();
 await expect(page.getByText(/Sign in to check your own league rosters/i)).toBeVisible();
});

test('push settings do not request permission without explicit action',async({page})=>{
 await page.goto('/notifications');
 await expect(page.getByRole('heading',{name:'Notification Settings'})).toBeVisible();
 await expect(page.getByText(/Push delivery needs server configuration/i)).toBeVisible();
 await expect(page.getByRole('button',{name:'Enable research notifications'})).toHaveCount(0);
});

test('bottom navigation renders on static Research routes as well as Next pages',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/research/radar');
 const nav=page.getByRole('navigation',{name:'LeagueZone app navigation'});
 await expect(nav).toBeVisible();
 await expect(nav.getByRole('link',{name:'Research'})).toHaveAttribute('aria-current','page');
 await nav.getByRole('link',{name:'Players'}).click();
 await expect(page).toHaveURL(/\/research\/players/);
 await expect(nav.getByRole('link',{name:'Players'})).toHaveAttribute('aria-current','page');
 await nav.getByRole('link',{name:'Profile'}).click();
 await expect(page).toHaveURL(/\/profile$/);
 await expect(page.getByRole('navigation',{name:'LeagueZone app navigation'})).toBeVisible();
});

test('account watchlist survives another browser session',async({page,browser})=>{
 const records=new Map<string, {key:string;type:string;title:string;href:string;savedAt:number}>();
 const respond=async(route:import('@playwright/test').Route)=>{
  const req=route.request(),method=req.method();
  if(method==='GET'){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    authenticated:true,userId:'test-account',items:[...records.values()]
   })});return;
  }
  const data=req.postDataJSON() as {item?:{type:string;title:string;href:string};key?:string;import?:unknown[]};
  if(method==='POST'&&data.import){
   await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"imported":0}'});return;
  }
  if(method==='POST'&&data.item){
   const item={...data.item,key:'player:00-0034857',savedAt:Date.now()};
   records.set(item.key,item);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,item})});return;
  }
  if(method==='DELETE'&&data.key){
   records.delete(data.key);
   await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});return;
  }
  await route.fulfill({status:400,contentType:'application/json',body:'{}'});
 };
 await page.route('**/api/saved-research',respond);
 await page.goto('/research/players/00-0034857?season=2026');
 await page.getByRole('button',{name:'Follow player'}).click();
 await expect(page.locator('#lz-saved-feedback')).toContainText('Saved to your LeagueZone account');
 const second=await browser.newContext({viewport:{width:390,height:844}});
 try{
  await second.route('**/api/saved-research',respond);
  const p=await second.newPage();
  await p.goto('/saved');
  await expect(p.getByRole('link',{name:'Josh Allen'})).toBeVisible();
  await p.getByRole('button',{name:'Remove Josh Allen'}).click();
  await expect(p.getByText('No saved research yet')).toBeVisible();
 }finally{await second.close()}
});
