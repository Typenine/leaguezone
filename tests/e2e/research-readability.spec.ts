import {test,expect, type Page} from '@playwright/test';

/** Returns the contrast ratio of the rendered foreground against its closest
 * opaque background (a conservative check for input surfaces and solid cards).
 * Transparent panel overlays are skipped; that is sufficient for our audited
 * solid-color form surfaces. */
async function contrast(page:Page,selector:string){
 return page.locator(selector).first().evaluate(el=>{
  const color=(value:string)=>{
   const parts=value.match(/[\d.]+/g)?.map(Number)||[];
   return {r:parts[0]||0,g:parts[1]||0,b:parts[2]||0,a:parts.length>3?parts[3]:1};
  };
  const lum=(v:{r:number;g:number;b:number})=>{
   const f=(x:number)=>{const y=x/255;return y<=0.04045?y/12.92:((y+0.055)/1.055)**2.4};
   return 0.2126*f(v.r)+0.7152*f(v.g)+0.0722*f(v.b);
  };
  const fg=color(getComputedStyle(el).color);
  let bg={r:255,g:255,b:255,a:1};
  for(let node:Element|null=el;node;node=node.parentElement){
   const next=color(getComputedStyle(node).backgroundColor);
   if(next.a>=0.99){bg=next;break;}
  }
  const a=lum(fg),b=lum(bg);
  return {ratio:+((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2),
   text:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor,
   resolvedBackground:`rgb(${bg.r}, ${bg.g}, ${bg.b})`};
 });
}
async function setTheme(page:Page,theme:'light'|'dark'){
 await page.addInitScript((choice)=>localStorage.setItem('theme',choice),theme);
}
const schedule={season:2026,source:'nflverse',games:[
 {id:'2026_06_BUF_KC',season:2026,week:6,away:'BUF',home:'KC',kickoff:'2026-10-15T00:20:00.000Z',
 stadium:'GEHA Field at Arrowhead Stadium',roof:'outdoors',awayScore:null,homeScore:null,status:'scheduled'}
]};
for(const theme of ['light','dark'] as const){
 test(`Weekly Center selectors remain readable in ${theme} theme`,async({page})=>{
  await setTheme(page,theme);
  await page.route('**/api/weekly-center/schedule*',route=>route.fulfill({json:schedule}));
  await page.route('**/api/weekly-center/news',route=>route.fulfill({json:{items:[],source:'ESPN',notice:'Unavailable',sourceUrl:'https://www.espn.com/nfl/'}}));
  await page.goto('/weekly?season=2026&week=6');
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  for(const selector of ['select:has(option[value="2026"])','select[aria-label="NFL week"]','select:has(option[value="WR"])',
    'select:has(option[value="half"])','select:has(option[value="BUF"])']){
   const control=page.locator(selector).first();
   await expect(control).toBeVisible();
   const colors=await contrast(page,selector);
   expect(colors.ratio,`${theme} ${selector}: ${JSON.stringify(colors)}`).toBeGreaterThanOrEqual(4.5);
  }
 });
 test(`My Research preferences remain readable in ${theme} theme`,async({page})=>{
  await setTheme(page,theme);
  await page.goto('/my-research');
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await page.getByRole('button',{name:'Customize'}).click();
  const selector='select[aria-label="Dashboard scoring format"]';
  await expect(page.locator(selector)).toBeVisible();
  const colors=await contrast(page,selector);
  expect(colors.ratio,`${theme} dashboard scoring: ${JSON.stringify(colors)}`).toBeGreaterThanOrEqual(4.5);
 });
 test(`Search and saved research controls retain contrast in ${theme} theme`,async({page})=>{
  await setTheme(page,theme);
  await page.goto('/search');
  await expect(page.locator('#lz-search')).toBeVisible();
  const c=await contrast(page,'#lz-search');
  expect(c.ratio,`${theme} search input: ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(4.5);
  await page.goto('/saved');
  await expect(page.getByRole('heading',{name:'Saved Research',exact:true})).toBeVisible();
  // A guest's empty saved-state browse link is the common on-light gold case.
  const link=page.getByRole('link',{name:'Browse players'});
  await expect(link).toBeVisible();
  const values=await contrast(page,'main a[href="/research/players"]');
  expect(values.ratio,`${theme} saved research link: ${JSON.stringify(values)}`).toBeGreaterThanOrEqual(4.5);
 });
}
test('public Research shell stays readable independently of the Next.js theme',async({page})=>{
 await page.goto('/research/players');
 await expect(page.getByRole('navigation',{name:'Research destinations'})).toBeVisible();
 const c=await contrast(page,'#position');
 expect(c.ratio,JSON.stringify(c)).toBeGreaterThanOrEqual(4.5);
});
