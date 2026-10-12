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
 await page.getByRole('button',{name:'Save this research view'}).click();
 await expect(page.getByRole('status').filter({hasText:'Saved on this device'})).toBeVisible();
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
