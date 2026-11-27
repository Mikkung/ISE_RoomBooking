/* Real authenticated UAT acceptance; secrets and tokens stay under .local/. */
const fs=require('node:fs');
const {request,chromium}=require('@playwright/test');
async function main(){
 const target=JSON.parse(fs.readFileSync('.local/uat-deployment.json','utf8'));
 if(target.scriptId!=='1uf9A-IBz9OqJ6mux5dnkVyIPeXIKECvEZ5U1S6gwZSXu1pfsOsn61CAD')throw Error('UAT identity mismatch');
 const {password}=JSON.parse(fs.readFileSync('.local/uat-secrets.json','utf8'));
 if(!password)throw Error('Missing private UAT password');
 const guest=JSON.parse(fs.readFileSync('.local/uat-guest.json','utf8'));
 if(!guest.guest_token)throw Error('Missing verified UAT guest session');
 const http=await request.newContext({timeout:120000});
 const api=async b=>{const response=await http.post(target.url,{headers:{'Content-Type':'text/plain'},data:JSON.stringify(b)});return response.json();};
 const report={version:target.version,googleServices:'REAL',checks:[]};
 function check(name,condition){const result={name,status:condition?'PASS':'FAIL'};report.checks.push(result);console.log(JSON.stringify(result));fs.writeFileSync('test-results/live/auth-report.json',JSON.stringify(report,null,2));if(!condition)throw Error('UAT check failed: '+name);}
 const sessions={};
 try{
  for(const role of ['admin','approver','internal']){
   const login=await api({action:'roomLogin',email:role+'@ise-uat.example.invalid',password});check(role+' live login',login.ok&&!!login.session_token);sessions[role]=login.session_token;
  }
  const act=(role,action,extra={})=>api({action,session_token:sessions[role],...extra});
  check('Regular internal approval access denied',(await act('internal','portalRequests')).ok===false);
  check('Admin grants approver',(await act('admin','portalSetApprover',{email:'internal@ise-uat.example.invalid',active:true})).ok===true);
  check('Granted user can view Approval Center',(await act('internal','portalRequests')).ok===true);
  check('Admin revokes approver',(await act('admin','portalSetApprover',{email:'internal@ise-uat.example.invalid',active:false})).ok===true);
  check('Revoked user denied',(await act('internal','portalRequests')).ok===false);
  const date=new Date(Date.UTC(2100,0,1)+Math.floor(Math.random()*36500)*86400000).toISOString().slice(0,10);
  const details={room_name:'ISE Meeting Room 2 (2nd Fl.)',book_date:date,start_time:'08:00',end_time:'09:00',purpose:'Synthetic live UAT acceptance'};
  const recurring=await act('internal','bookRoom',{...details,recurrence:{freq:'WEEKLY',count:2}});
  check('Live recurring internal booking',recurring.ok&&recurring.created_count===2);
  check('Live internal conflict denied',(await act('internal','bookRoom',details)).ok===false);
  check('Live recurring series cancellation',(await act('internal','cancelRoomBooking',{booking_id:recurring.booking_ids[0],cancel_scope:'SERIES'})).cancelled_count===2);
  const submit=extra=>api({action:'portalSubmit',guest_token:guest.guest_token,...details,room_name:'ISE Meeting Room 3 (Interhub)',name:'UAT External Test',organization:'Synthetic UAT',...extra});
  const a=await submit({start_time:'09:00',end_time:'10:00'}),b=await submit({start_time:'09:30',end_time:'10:30'});
  check('Two overlapping requests remain pending',a.ok&&b.ok);
  const mine=await api({action:'portalMyRequests',guest_token:guest.guest_token});
  check('Live My Requests includes pending states',mine.ok&&[a.request_id,b.request_id].every(id=>mine.requests.some(r=>r.request_id===id&&r.status==='PENDING')));
  const decisions=await Promise.all([a,b].map(r=>act('approver','portalDecide',{request_id:r.request_id,decision:'APPROVED'})));
  check('Simultaneous overlapping approvals yield one winner',decisions.filter(r=>r.ok).length===1&&decisions.some(r=>r.ok===false&&/available/.test(r.error||'')));
  const winner=decisions[0].ok?a:b,loser=decisions[0].ok?b:a;
  check('Approval notification accepted by MailApp',decisions.find(r=>r.ok).notified===true);
  check('Live approval retry is idempotent',(await act('approver','portalDecide',{request_id:winner.request_id,decision:'APPROVED'})).already_decided===true);
  const rejected=await act('approver','portalDecide',{request_id:loser.request_id,decision:'REJECTED',reason:'Synthetic concurrent approval conflict test'});
  check('Live rejection and notification',rejected.ok&&rejected.notified===true);
  const final=await api({action:'portalMyRequests',guest_token:guest.guest_token});
  check('Live approved and rejected states persist',final.ok&&final.requests.some(r=>r.request_id===winner.request_id&&r.status==='APPROVED')&&final.requests.some(r=>r.request_id===loser.request_id&&r.status==='REJECTED'));
  const bookings=await act('internal','fetchRoomBookings',{book_date:date});
  check('One active booking after simultaneous approvals',bookings.ok&&bookings.bookings.filter(r=>r.room_name==='ISE Meeting Room 3 (Interhub)').length===1);
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
   for(const [size,width,height] of [['desktop',1440,1000],['mobile',390,844],['tablet',820,1180]]){
    const context=await browser.newContext({viewport:{width,height}});
    await context.addInitScript(token=>{try{localStorage.setItem('room_dash_session_token',token);}catch{}},sessions.admin);
    const page=await context.newPage();await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:120000});
    let app;
    for(let i=0;i<120;i++){for(const frame of page.frames())if(await frame.getByRole('button',{name:'Approval Center',exact:true}).count().catch(()=>0)){app=frame;break;}if(app)break;await new Promise(r=>setTimeout(r,500));}
    if(!app)throw Error('Authenticated deployed page did not render');
    await app.getByRole('button',{name:'Approval Center',exact:true}).waitFor({state:'visible',timeout:15000});
    await page.screenshot({path:`test-results/live/${size}-authenticated-dashboard.png`,fullPage:true});
    await app.getByRole('button',{name:'Approval Center',exact:true}).click();await app.getByRole('heading',{name:'Manage Approvers',exact:true}).waitFor({state:'visible',timeout:120000});
    await page.screenshot({path:`test-results/live/${size}-approval-center.png`,fullPage:true});
    check(size+' live authenticated approval center',await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();
   }
  }finally{await browser.close();}
 }finally{
  for(const token of Object.values(sessions))await api({action:'roomLogout',session_token:token}).catch(()=>{});
  await http.dispose();
 }
 console.log(JSON.stringify({passed:report.checks.filter(c=>c.status==='PASS').length,failed:report.checks.filter(c=>c.status==='FAIL').length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
