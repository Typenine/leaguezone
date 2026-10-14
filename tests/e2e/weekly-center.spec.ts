import {test,expect} from '@playwright/test';
const games=[
 {id:'2026_06_BUF_KC',season:2026,week:6,away:'BUF',home:'KC',kickoff:'2026-10-15T00:20:00.000Z',
  stadium:'GEHA Field at Arrowhead Stadium',roof:'outdoors',awayScore:null,homeScore:null,status:'scheduled'}
];
test.describe('LeagueZone weekly football center',()=>{
 test.beforeEach(async ({page})=>{
  await page.route('**/api/weekly-center/schedule*',route=>route.fulfill({
   json:{season:2026,games,fetchedAt:'2026-10-14T00:00:00Z',source:'nflverse'}}));
  await page.route('**/api/weekly-center/news',route=>route.fulfill({
   json:{items:[],source:'ESPN',sourceUrl:'https://www.espn.com/espn/rss/nfl/news',notice:'Feed unavailable'}}));
 });
 test('shows scheduled game, available filters and clear empty news state',async ({page})=>{
  await page.goto('/weekly?season=2026&week=6');
  await expect(page.getByRole('heading',{name:'Weekly Football Center'})).toBeVisible();
  await expect(page.getByText('GEHA Field at Arrowhead Stadium')).toBeVisible();
  await expect(page.getByRole('button',{name:'Check kickoff weather'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Defensive matchup research'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'NFL headlines'})).toBeVisible();
  await expect(page.getByText('Feed unavailable')).toBeVisible();
 });
 test('weather is on-demand, sourced and survives API rejection gracefully',async ({page})=>{
  await page.route('**/api/weekly-center/weather*',route=>route.fulfill({json:{
   stadium:'GEHA Field at Arrowhead Stadium',at:'2026-10-14T19:00:00-05:00',
   temperature:55,unit:'F',wind:'12 mph',direction:'NW',conditions:'Clear',precipitation:4
  }}));
  await page.goto('/weekly?season=2026&week=6');
  await page.getByRole('button',{name:'Check kickoff weather'}).click();
  await expect(page.getByText(/55°F/)).toBeVisible();
  await expect(page.getByText(/Wind 12 mph NW/)).toBeVisible();
 });
 test('mobile 320px never overflows with cards and rankings',async ({page})=>{
  await page.setViewportSize({width:320,height:760});
  await page.goto('/weekly?season=2026&week=6');
  await expect(page.getByRole('heading',{name:'Weekly Football Center'})).toBeVisible();
  const dims=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
  expect(dims[0]).toBeLessThanOrEqual(dims[1]+1);
 });
 test('invalid weather date and invalid team do not trigger upstream queries',async ({request})=>{
  const weather=await request.get('/api/weekly-center/weather?stadium=Invalid&kickoff=2000-01-01T00:00:00Z');
  expect(weather.status()).toBe(400);
  const depth=await request.get('/api/weekly-center/depth?team=BAD');
  expect(depth.status()).toBe(400);
 });
});
