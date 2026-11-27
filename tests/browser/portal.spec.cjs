const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),babel=require('@babel/core');
const {harness}=require('../harness.cjs');
let html;
test.beforeAll(async()=>{
 const source=fs.readFileSync('Index.html','utf8');
 const code=source.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1];
 const js=babel.transformSync(code,{presets:['@babel/preset-react']}).code;
 const css=(await require('postcss')([require('tailwindcss')({content:[{raw:source,extension:'html'}],corePlugins:{preflight:true}})]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined})).css;
 const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
 const dom=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
 html=source.replace(/<script[^>]+src=[^>]+><\/script>/g,'').replace('<script type="text/babel">'+code+'</script>','<script>'+js+'</script>').replace('</head>',`<style>${css}</style><script>${react}</script><script>${dom}</script></head>`);
});
async function open(page,mode='',role=''){
 const h=harness();h.seed();
 await page.exposeFunction('__api',b=>h.api(b));
 await page.addInitScript(({role,token,mode})=>{
  if(token)localStorage.setItem('room_dash_session_token',token);
  const runner={withSuccessHandler(fn){this.success=fn;return this;},withFailureHandler(fn){this.failure=fn;return this;},apiRouter(b){const yes=this.success,no=this.failure;window.__api(b).then(yes,no);}};
  window.google={script:{run:runner,url:{getLocation:fn=>fn({parameter:{mode}})}}};
 },{role,token:role?h.login(role).session_token:'',mode});
 await page.route('http://uat.test/**',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://uat.test/?mode='+mode);return h;
}
async function fits(page){const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&!e.closest('.overflow-x-auto')).slice(0,8).map(e=>({tag:e.tagName,classes:e.className,right:e.getBoundingClientRect().right}))}));expect(overflow.scroll,JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width+1);}
test('internal sign-in renders and external entry opens',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await expect(page.getByRole('button',{name:/External User.*Request a room/})).toBeVisible();await fits(page);await page.getByRole('button',{name:/External User.*Request a room/}).click();await expect(page.getByRole('button',{name:'Send verification code'})).toBeVisible();await fits(page);await page.screenshot({path:`test-results/${info.project.name}-guest.png`,fullPage:true});expect(errors).toEqual([]);
});
test('external verify and pending submission render through mocked server',async({page})=>{
 const h=await open(page,'guest');await page.getByLabel('Full name',{exact:true}).fill('Browser Guest');await page.getByLabel('Purpose',{exact:true}).fill('Browser UAT');await page.getByLabel('Email',{exact:true}).fill('browser@chula.ac.th');await page.getByRole('button',{name:'Send verification code'}).click();await expect(page.getByRole('button',{name:'Verify email',exact:true})).toBeVisible();const code=h.mail.at(-1).body.match(/\d{6}/)[0];await page.getByLabel('Verification code',{exact:true}).fill(code);await page.getByRole('button',{name:'Verify email',exact:true}).click();await expect(page.getByRole('button',{name:'Submit for approval'})).toBeVisible();await page.getByRole('button',{name:'Submit for approval'}).click();await expect(page.getByText(/Pending approval: REQ_/)).toBeVisible();await fits(page);
});
test('guest duration computes end time',async({page})=>{await open(page,'guest');await page.getByLabel(/^Duration \(hours\)/).selectOption('1.5');await expect(page.getByLabel('End time',{exact:true})).toHaveValue('10:30');});
test('authenticated dashboard fits viewport',async({page},info)=>{await open(page,'','internal');await expect(page.getByRole('button',{name:'Log out',exact:true})).toBeVisible();await fits(page);await page.screenshot({path:`test-results/${info.project.name}-dashboard.png`,fullPage:true});});
test('admin approval center and manage approvers render',async({page},info)=>{
 await open(page,'','admin');await page.getByRole('button',{name:/Approval Center/}).click();await expect(page.getByRole('heading',{name:'Approval Center'})).toBeVisible();await expect(page.getByRole('heading',{name:'Manage Approvers'})).toBeVisible();await fits(page);await page.screenshot({path:`test-results/${info.project.name}-admin.png`,fullPage:true});
});
test('admin approves a pending request and grants then revokes an approver',async({page})=>{
 const h=await open(page,'','admin'),guest_token=h.guest();
 const r=h.api({action:'portalSubmit',guest_token,room_name:'ISE Meeting Room 1 (1st Fl.)',book_date:'2099-01-12',start_time:'09:00',end_time:'10:00',purpose:'Browser approval',name:'Guest',organization:'Synthetic'});expect(r.ok).toBe(true);
 await page.getByRole('button',{name:'Approval Center',exact:true}).click();await page.getByRole('button',{name:'Approve',exact:true}).click();await expect(page.getByText('APPROVED',{exact:true})).toBeVisible();
 await page.locator('select').selectOption('internal@ise-uat.example.invalid');await page.getByRole('button',{name:'Grant approval access'}).click();
 const row=page.locator('div').filter({has:page.locator('span').filter({hasText:'internal@ise-uat.example.invalid'})}).filter({has:page.getByRole('button',{name:'Revoke',exact:true})}).last();
 await expect(row.getByRole('button',{name:'Revoke',exact:true})).toBeVisible();await row.getByRole('button',{name:'Revoke',exact:true}).click();await expect(page.locator('span').filter({hasText:'internal@ise-uat.example.invalid'})).toHaveCount(0);await fits(page);
});
test('room display activation renders',async({page},info)=>{
 await open(page,'display');await expect(page.getByRole('button',{name:/Activate|Connect|Save/i})).toBeVisible();await fits(page);await page.screenshot({path:`test-results/${info.project.name}-display.png`,fullPage:true});
});

test('internal email entered in guest portal redirects to sign in without OTP',async({page})=>{const h=await open(page,'guest');const email='internal@ise-uat.example.invalid';await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Send verification code'}).click();await expect(page.getByRole('heading',{name:'ISE Internal User'})).toBeVisible();await expect(page.getByRole('alert')).toContainText('redirected automatically');await expect(page.getByLabel('Email',{exact:true})).toHaveValue(email);expect(h.mail).toHaveLength(0);});
