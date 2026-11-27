/* Actual UAT network/browser checks. No Google services are mocked here. */
const fs=require('node:fs');
const {chromium,request}=require('@playwright/test');
const expected='1uf9A-IBz9OqJ6mux5dnkVyIPeXIKECvEZ5U1S6gwZSXu1pfsOsn61CAD';
async function main(){
 const target=JSON.parse(fs.readFileSync('.local/uat-deployment.json','utf8'));
 const clasp=JSON.parse(fs.readFileSync('.clasp.json','utf8'));
 if(target.scriptId!==expected||clasp.scriptId!==expected)throw Error('UAT identity mismatch');
 const url=new URL(target.url);
 if(url.origin!=='https://script.google.com'||url.pathname!==`/macros/s/${target.deploymentId}/exec`)throw Error('Unexpected UAT URL');
 fs.mkdirSync('test-results/live',{recursive:true});
 const report={target:target.url,version:target.version,googleServices:'REAL',checks:[]};
 const record=(name,pass,detail)=>{const result={name,status:pass?'PASS':'FAIL',...(detail?{detail}:{} )};report.checks.push(result);console.log(JSON.stringify(result));};
 const api=await request.newContext({timeout:120000});
 for(const [name,body,validate] of [
  ['Live ping',{action:'ping'},r=>r.ok===true&&r.msg==='pong'],
  ['Anonymous approval API denied',{action:'portalRequests'},r=>r.ok===false],
  ['Anonymous approver management denied',{action:'portalSetApprover',email:'internal@ise-uat.example.invalid',active:true},r=>r.ok===false],
  ['Anonymous direct booking denied',{action:'bookRoom'},r=>r.ok===false],
  ['Anonymous display access denied',{action:'fetchRoomDisplayState',device_token:'invalid'},r=>r.ok===false],
  ['External availability exposes busy times only',{action:'portalAvailability',book_date:'2099-01-12'},r=>r.ok===true&&r.bookings.every(b=>Object.keys(b).every(k=>['room_name','start_time','end_time'].includes(k)))],
  ['Anonymous request submission denied',{action:'portalSubmit'},r=>r.ok===false]
 ]){
  try{const response=await api.post(target.url,{headers:{'Content-Type':'text/plain'},data:JSON.stringify(body)});const result=await response.json();record(name,response.ok()&&validate(result));}
  catch(e){record(name,false,e.message.slice(0,180));}
 }
 await api.dispose();
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const [size,width,height] of [['desktop',1440,1000],['mobile',390,844],['tablet',820,1180]]){
   const context=await browser.newContext({viewport:{width,height}});
   for(const [mode,expectedText] of [['','ISE Internal User'],['guest','Send verification code'],['display','Enter the device token']]){
    const label=mode||'portal',page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
     await page.goto(target.url+(mode?'?mode='+mode:''),{waitUntil:'domcontentloaded',timeout:120000});
     let app;
     for(let attempt=0;attempt<120;attempt++){
      for(const frame of page.frames())if(await frame.getByText(expectedText,{exact:false}).count().catch(()=>0)){app=frame;break;}
      if(app)break;
      await new Promise(resolve=>setTimeout(resolve,500));
     }
     if(!app)throw Error('Deployed application did not render expected content');
     await app.getByText(expectedText,{exact:false}).first().waitFor({state:'visible',timeout:15000});
     const fits=await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
     await page.screenshot({path:`test-results/live/${size}-${label}.png`,fullPage:true});
     record(`${size} live ${label} renders`,errors.length===0,errors.length?errors.join('; ').slice(0,180):undefined);
     record(`${size} live ${label} fits viewport`,fits);
    }catch(e){record(`${size} live ${label} renders`,false,e.message.slice(0,180));await page.screenshot({path:`test-results/live/${size}-${label}-failed.png`,fullPage:true}).catch(()=>{});}
    await page.close();
   }
   await context.close();
  }
 }finally{await browser.close();}
 fs.writeFileSync('test-results/live/report.json',JSON.stringify(report,null,2));
 const failed=report.checks.filter(c=>c.status==='FAIL').length;
 console.log(JSON.stringify({passed:report.checks.length-failed,failed}));if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
