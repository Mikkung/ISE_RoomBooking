/* Verify a user-provided OTP against the real UAT endpoint; never log secrets. */
const fs=require('node:fs');
const {request}=require('@playwright/test');
async function main(){
 const target=JSON.parse(fs.readFileSync('.local/uat-deployment.json','utf8'));
 if(target.scriptId!=='1uf9A-IBz9OqJ6mux5dnkVyIPeXIKECvEZ5U1S6gwZSXu1pfsOsn61CAD')throw Error('UAT identity mismatch');
 const {email}=JSON.parse(fs.readFileSync('.local/uat-email.json','utf8'));
 const {code}=JSON.parse(fs.readFileSync('.local/uat-otp.json','utf8'));
 if(!/^\d{6}$/.test(code))throw Error('A six-digit UAT code is required');
 const http=await request.newContext({timeout:120000}),report={googleServices:'REAL',checks:[]};
 const call=async value=>{const r=await http.post(target.url,{headers:{'Content-Type':'text/plain'},data:JSON.stringify({action:'portalVerifyCode',email,code:value})});return r.json();};
 function record(name,pass){report.checks.push({name,status:pass?'PASS':'FAIL'});console.log(JSON.stringify(report.checks.at(-1)));fs.writeFileSync('test-results/live/email-report.json',JSON.stringify(report,null,2));if(!pass)throw Error('UAT email verification check failed');}
 try{
  record('Real incorrect OTP denied',(await call(code==='000000'?'999999':'000000')).ok===false);
  const result=await call(code);record('Delivered UAT OTP verifies',result.ok===true&&!!result.guest_token);
  fs.writeFileSync('.local/uat-guest.json',JSON.stringify({email,guest_token:result.guest_token}));
  record('Real OTP replay denied',(await call(code)).ok===false);
 }finally{await http.dispose();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
