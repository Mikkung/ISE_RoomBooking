const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const room='ISE Meeting Room 1 (1st Fl.)';
const details={room_name:room,book_date:'2099-01-12',start_time:'09:00',end_time:'10:00',purpose:'Synthetic test',name:'Synthetic Guest',organization:'UAT'};
function setup(){const h=harness();h.seed();return h;}
function submit(h,extra={}){const guest_token=h.guest();return h.api({action:'portalSubmit',...details,guest_token,...extra});}
function act(h,role,action,extra={}){return h.api({action,session_token:h.login(role).session_token,...extra});}
test('fails closed before configuration and refuses unregistered UAT database',()=>{
 const h=harness();assert.throws(()=>h.api({action:'ping'}),/APP_ENV/);h.seed();h.props.ROOM_SHEET_ID='production';assert.throws(()=>h.api({action:'ping'}),/outside the UAT/);
});
test('synthetic initializer is idempotent and preserves schemas',()=>{const h=setup();h.c.initializeUat_();assert.equal(h.books.size,3);assert.equal(h.c.getUserSheet_().sh.getLastRow(),4);assert.equal(h.c.auditUat_().ok,true);});
test('one-action UAT runtime preparation driver executes against mocks',()=>{const h=harness();const report=h.c.prepareUat_();assert.equal(report.checks.length,7);assert.ok(report.checks.every(c=>c.status==='PASS'));assert.equal(report.externalOtp,'NOT_TESTED');});
test('internal login, direct booking, conflict, logout and unauthorized APIs',()=>{
 const h=setup(),session=h.login();assert.equal(session.ok,true);assert.ok(session.session_token);
 const b={action:'bookRoom',...details,session_token:session.session_token};assert.equal(h.api(b).ok,true);assert.equal(h.api(b).error_code,'CONFLICT');
 assert.equal(h.api({action:'fetchRoomBookings',book_date:details.book_date}).ok,false);
 h.api({action:'roomLogout',session_token:session.session_token});assert.equal(h.api(b).ok,false);
});
test('external OTP verification, submission, pending state and request isolation',()=>{
 const h=setup(),token=h.guest();const r=h.api({action:'portalSubmit',...details,guest_token:token});assert.equal(r.ok,true);
 const mine=h.api({action:'portalMyRequests',guest_token:token});assert.equal(mine.requests[0].status,'PENDING');assert.equal(mine.requests[0].book_date,details.book_date);
 assert.equal(h.api({action:'portalMyRequests',guest_token:h.guest('other@example.invalid')}).requests.length,0);
 assert.equal(h.api({action:'portalSubmit',...details,guest_token:token}).ok,false);
});
test('OTP wrong attempts, expiry, replay, resend rate limit and feature gate',()=>{
 const h=setup(),email='guest@example.invalid';assert.equal(h.api({action:'portalSendCode',email}).ok,true);
 const code=h.mail.at(-1).body.match(/\d{6}/)[0];assert.equal(h.api({action:'portalSendCode',email}).ok,false);
 for(let i=0;i<5;i++)assert.equal(h.api({action:'portalVerifyCode',email,code:'wrong'}).ok,false);
 assert.equal(h.api({action:'portalVerifyCode',email,code}).ok,false);
 h.advance(600001);assert.equal(h.api({action:'portalVerifyCode',email,code}).ok,false);
 const token=h.guest('replay@example.invalid');assert.ok(token);const correct=h.mail.at(-1).body.match(/\d{6}/)[0];assert.equal(h.api({action:'portalVerifyCode',email:'replay@example.invalid',code:correct}).ok,false);
 h.props.PUBLIC_BOOKING_ENABLED='false';assert.equal(h.api({action:'portalVerifyCode',email,code}).ok,false);assert.equal(h.api({action:'portalSubmit',guest_token:token,...details}).ok,false);
});
test('OTP daily quota and expired guest session',()=>{const h=setup();h.props.PORTAL_OTP_QUOTA=JSON.stringify({day:h.c.fmtDate_(new Date()),count:100});assert.equal(h.api({action:'portalSendCode',email:'x@example.invalid'}).ok,false);delete h.props.PORTAL_OTP_QUOTA;const t=h.guest();h.advance(3600001);assert.equal(h.api({action:'portalMyRequests',guest_token:t}).ok,false);});
test('known internal account cannot submit as guest',()=>{const h=setup();const t=h.guest('internal@ise-uat.example.invalid');assert.equal(h.api({action:'portalSubmit',...details,guest_token:t}).ok,false);});
test('approval center, approved booking, repeat decision and opposing decision',()=>{
 const h=setup(),r=submit(h);assert.equal(act(h,'approver','portalRequests').requests.length,1);
 const b={request_id:r.request_id,decision:'APPROVED'};assert.equal(act(h,'approver','portalDecide',b).ok,true);assert.equal(act(h,'approver','portalDecide',b).already_decided,true);
 assert.equal(act(h,'approver','portalDecide',{...b,decision:'REJECTED',reason:'No'}).ok,false);assert.equal(h.c.getActiveRoomBookingsByDate_(details.book_date).length,1);
});
test('rejection requires reason and creates no booking',()=>{const h=setup(),r=submit(h);const b={request_id:r.request_id,decision:'REJECTED'};assert.equal(act(h,'approver','portalDecide',b).ok,false);assert.equal(act(h,'approver','portalDecide',{...b,reason:'Synthetic rejection'}).ok,true);assert.equal(h.c.getActiveRoomBookingsByDate_(details.book_date).length,0);});
test('competing pending approvals serialize to one winning booking',()=>{const h=setup(),a=submit(h),b=submit(h,{guest_token:h.guest('second@example.invalid')});assert.equal(a.ok,true);assert.equal(b.ok,true);assert.equal(act(h,'approver','portalDecide',{request_id:a.request_id,decision:'APPROVED'}).ok,true);assert.equal(act(h,'approver','portalDecide',{request_id:b.request_id,decision:'APPROVED'}).ok,false);assert.equal(h.locked,false);});
test('partial approval retry recovers without duplicate and cannot reject created booking',()=>{
 const h=setup(),r=submit(h),write=h.c.portalWrite_;let fail=true;h.c.portalWrite_=(...args)=>{if(fail&&args[2].status==='APPROVED'){fail=false;throw Error('Injected write failure');}return write(...args);};
 assert.throws(()=>act(h,'approver','portalDecide',{request_id:r.request_id,decision:'APPROVED'}),/Injected/);
 assert.equal(h.locked,false);assert.equal(act(h,'approver','portalDecide',{request_id:r.request_id,decision:'REJECTED',reason:'No'}).ok,false);
 assert.equal(act(h,'approver','portalDecide',{request_id:r.request_id,decision:'APPROVED'}).ok,true);assert.equal(h.c.getActiveRoomBookingsByDate_(details.book_date).length,1);
});
test('admin grants and revokes; regular user denied; ineligible approver can be revoked',()=>{
 const h=setup();assert.equal(act(h,'internal','portalRequests').ok,false);assert.equal(act(h,'internal','portalSetApprover',{email:'internal@ise-uat.example.invalid',active:true}).ok,false);
 assert.equal(act(h,'admin','portalSetApprover',{email:'internal@ise-uat.example.invalid',active:true}).ok,true);assert.equal(act(h,'internal','portalRequests').ok,true);
 assert.equal(act(h,'admin','portalSetApprover',{email:'internal@ise-uat.example.invalid',active:false}).ok,true);assert.equal(act(h,'internal','portalRequests').ok,false);
 const sh=h.c.getAllowlistSheet_();sh.sh.getRange(3,sh.map.active).setValue('FALSE');assert.equal(act(h,'admin','portalSetApprover',{email:'approver@ise-uat.example.invalid',active:false}).ok,true);
});
test('strict date and time validation plus formula-safe booking writes',()=>{
 const h=setup();assert.equal(h.c.toYMD_('2026-02-30'),'');assert.equal(h.c.toHHMM_('25:30'),'');assert.equal(h.c.toHHMM_('12:99'),'');assert.equal(h.c.toHHMM_(0.5),'12:00');
 assert.equal(submit(h,{book_date:'2099-02-30'}).ok,false);assert.equal(submit(h,{start_time:'25:00'}).ok,false);
 assert.equal(act(h,'internal','bookRoom',{...details,purpose:'=IMPORTXML("bad")'}).ok,true);
 const sh=h.c.getRoomSheet_();assert.ok(sh.sh.rows[1][sh.map.purpose-1].startsWith("'="));
});
test('Bangkok date/time serialization and room occupancy boundaries',()=>{const h=setup();assert.equal(h.c.toYMD_(new Date('2026-11-26T18:00:00Z')),'2026-11-27');assert.equal(h.c.toHHMM_(new Date('2026-11-26T18:30:00Z')),'01:30');assert.equal(h.c.isInProgress_('09:00','10:00','09:00'),true);assert.equal(h.c.isInProgress_('09:00','10:00','10:00'),false);});
test('recurring count one, monthly anchor, conflict and series cancellation',()=>{
 const h=setup();assert.equal(h.c.generateOccurrenceDates_('2099-01-31',{freq:'MONTHLY',count:1}).length,1);
 assert.deepEqual(Array.from(h.c.generateOccurrenceDates_('2099-01-31',{freq:'MONTHLY',count:3})),['2099-01-31','2099-02-28','2099-03-31']);
 const s=h.login().session_token,b=h.api({action:'bookRoom',session_token:s,...details,recurrence:{freq:'WEEKLY',count:3}});assert.equal(b.created_count,3);
 assert.equal(h.api({action:'bookRoom',session_token:s,...details}).ok,false);assert.equal(h.api({action:'cancelRoomBooking',session_token:s,booking_id:b.booking_ids[0],cancel_scope:'SERIES'}).cancelled_count,3);
});
test('display quick booking returns success, reads schedule and rejects invalid device',()=>{
 const h=setup(),sh=h.c.getDisplaySheet_(),device_token=sh.sh.rows[1][sh.map.device_token-1];
 const b={action:'bookRoomFromDisplay',device_token,...details,requester_email:'internal@ise-uat.example.invalid'};const r=h.api(b);assert.equal(r.ok,true);assert.ok(r.booking_id);assert.equal(h.api(b).ok,false);
 assert.equal(h.api({action:'fetchRoomDisplayState',device_token}).ok,true);assert.equal(h.api({action:'fetchRoomDisplaySchedule',device_token,book_date:details.book_date}).ok,true);assert.equal(h.api({...b,device_token:'bad'}).ok,false);
});
test('all Google callable helpers remain private; photos unchanged',()=>{
 const fs=require('node:fs'),cp=require('node:child_process');const code=fs.readFileSync('Code.gs','utf8');const names=[...code.matchAll(/^function (\w+)\(/gm)].map(m=>m[1]);assert.deepEqual(names.filter(n=>!n.endsWith('_')).sort(),['apiRouter','doGet','doPost']);
 const html=fs.readFileSync('Index.html','utf8'),before=cp.execFileSync('git',['show','HEAD:Index.html'],{maxBuffer:3000000}).toString();assert.deepEqual(html.match(/data:image\/jpeg;base64,[^"]+/g),before.match(/data:image\/jpeg;base64,[^"]+/g));
});
