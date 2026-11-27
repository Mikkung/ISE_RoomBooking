const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
class Sheet {
  constructor(){this.rows=[];}
  getLastRow(){return this.rows.length;}
  getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}
  getMaxRows(){return Math.max(10,this.rows.length);}
  getRange(r,c,n=1,m=1){
    const sh=this;
    return {
      getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>sh.rows[r+i-1]?.[c+j-1]??'')),
      getDisplayValues(){return this.getValues().map(row=>row.map(v=>String(v)));},
      getValue(){return this.getValues()[0][0];},
      setValues(values){values.forEach((row,i)=>row.forEach((v,j)=>{sh.rows[r+i-1]??=[];sh.rows[r+i-1][c+j-1]=v;}));return this;},
      setValue(v){return this.setValues([[v]]);},setNumberFormat(){return this;}
    };
  }
  appendRow(r){this.rows.push([...r]);return this;}
  getDataRange(){return this.getRange(1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn()));}
}
function harness(){
  let clock=Date.now(),locked=false;const props={},cache=new Map(),books=new Map(),mail=[];
  const sid='1uf9A-IBz9OqJ6mux5dnkVyIPeXIKECvEZ5U1S6gwZSXu1pfsOsn61CAD';
  const properties={getProperty:k=>props[k]??null,setProperty(k,v){props[k]=String(v);},setProperties(v){Object.assign(props,v);}};
  const c={Date,Math,JSON,console:{...console,log(){}},PropertiesService:{getScriptProperties:()=>properties},ScriptApp:{getScriptId:()=>sid},
    CacheService:{getScriptCache:()=>({get:k=>{const v=cache.get(k);return v&&v.until>clock?v.value:null;},put(k,v,ttl){if(ttl>21600)throw Error('Cache TTL exceeds 21600');cache.set(k,{value:v,until:clock+ttl*1000});},remove:k=>cache.delete(k)})},
    LockService:{getScriptLock:()=>({waitLock(){if(locked)throw Error('Lock unavailable');locked=true;},releaseLock(){locked=false;}})},
    SpreadsheetApp:{flush(){},create(name){const id='synthetic-'+books.size,ss=makeBook(name,id);books.set(id,ss);return ss;},openById(id){if(!books.has(id))throw Error('Unexpected database access '+id);return books.get(id);}},
    MailApp:{sendEmail(email,subject,body){mail.push({email,subject,body});}},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest()).map(v=>v>127?v-256:v),
      formatDate(d,tz,fmt){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));return fmt.replace('yyyy',p.year).replace('MM',p.month).replace('dd',p.day).replace('HH',p.hour).replace('mm',p.minute).replace('ss',p.second);}}
  };
  function makeBook(name,id){const sheets=new Map();return {getId:()=>id,getName:()=>name,setSpreadsheetTimeZone(){},getSheetByName:n=>sheets.get(n),insertSheet(n){const sh=new Sheet();sheets.set(n,sh);return sh;},sheets};}
  vm.createContext(c);for(const file of ['Environment.gs','Code.gs','UatSetup.gs'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
  const run=code=>vm.runInContext(code,c);const api=b=>c.apiRouter(b);
  function seed(){c.initializeUat_();return props.UAT_TEST_PASSWORD;}
  function login(role='internal'){return api({action:'roomLogin',email:role+'@ise-uat.example.invalid',password:props.UAT_TEST_PASSWORD});}
  function guest(email='external@chula.ac.th'){api({action:'portalSendCode',email});const code=mail.at(-1).body.match(/\d{6}/)[0];return api({action:'portalVerifyCode',email,code}).guest_token;}
  return {c,run,api,props,cache,mail,books,seed,login,guest,advance(ms){clock+=ms;},get locked(){return locked;}};
}
module.exports={harness};
