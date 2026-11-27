/* Run from the editor only. Trailing underscores exclude these functions from
 * google.script.run. Never expose setup through apiRouter or doPost. */
function initializeUat_() {
  const expected="1uf9A-IBz9OqJ6mux5dnkVyIPeXIKECvEZ5U1S6gwZSXu1pfsOsn61CAD";
  if(ScriptApp.getScriptId()!==expected)throw new Error("UAT project only");
  return portalLock_(function(){
    const p=PropertiesService.getScriptProperties();
    if(p.getProperty("APP_ENV")&&p.getProperty("APP_ENV")!=="UAT")throw new Error("Environment already configured differently");
    if(!p.getProperty("UAT_DATABASE_IDS")) {
      if(["ROOM_SHEET_ID","USER_SHEET_ID","DISPLAY_SHEET_ID","ALLOWLIST_SHEET_ID"].some(k=>p.getProperty(k)))throw new Error("Existing database configuration requires review");
      const ids=[];
      ["ROOM","USER","DISPLAY"].forEach(kind=>{
        const ss=SpreadsheetApp.create("ISE RoomBooking UAT synthetic "+kind);
        ss.setSpreadsheetTimeZone(TZ);ids.push(ss.getId());
      });
      p.setProperties({APP_ENV:"UAT",UAT_SCRIPT_ID:expected,UAT_DATABASE_IDS:JSON.stringify(ids),ROOM_SHEET_ID:ids[0],USER_SHEET_ID:ids[1],ALLOWLIST_SHEET_ID:ids[1],DISPLAY_SHEET_ID:ids[2],PUBLIC_BOOKING_ENABLED:"false"});
    }
    // Validate every ID before opening any spreadsheet.
    ["ROOM","USER","ALLOWLIST","DISPLAY"].forEach(k=>spreadsheetId_(k+"_SHEET_ID"));
    auditUat_();
    initializeApp_();
    if(!p.getProperty("UAT_SEEDED")) {
      const password=portalToken_();
      ["admin","approver","internal"].forEach((role,i)=>{
        const email=role+"@ise-uat.example.invalid";
        portalWrite_(getUserSheet_().sh,0,{id:"UAT_"+(i+1),name:"UAT "+role,email:email,Password:sha256Hex_(password),created_at:fmtDateTime_(nowBangkok_())});
        portalWrite_(getAllowlistSheet_().sh,0,{email:email,emp_id:"UAT_"+(i+1),active:"TRUE"});
      });
      portalWrite_(portalSheet_("BookingApprovers",PORTAL_APPROVER_HEADERS),0,{email:"approver@ise-uat.example.invalid",active:"TRUE",updated_by:"UAT initializer",updated_at:fmtDateTime_(nowBangkok_())});
      portalWrite_(getDisplaySheet_().sh,0,{device_id:"UAT_DISPLAY",device_name:"Synthetic UAT display",room_name:ROOMS[0],device_token:portalToken_(),active:"TRUE",allow_booking:"TRUE"});
      p.setProperties({BOOKING_ADMIN_EMAILS:"admin@ise-uat.example.invalid",UAT_TEST_PASSWORD:password,UAT_EXTERNAL_EMAIL:"external@ise-uat.example.invalid",UAT_SEEDED:"true"});
    }
    p.setProperty("PUBLIC_BOOKING_ENABLED","true");
    return {ok:true,environment:"UAT",synthetic:true};
  });
}

/* One editor invocation initializes, audits and tests real Google services.
 * No OTP mail is sent to the synthetic .invalid accounts. */
function prepareUat_() {
  initializeUat_();
  auditUat_();
  const p=PropertiesService.getScriptProperties(), checks=[];
  function check(name,condition){checks.push({name:name,status:condition?"PASS":"FAIL"});if(!condition)throw new Error("UAT smoke failed: "+name);}
  const password=p.getProperty("UAT_TEST_PASSWORD");
  const internal=apiRouter({action:"roomLogin",email:"internal@ise-uat.example.invalid",password:password});
  check("Google Sheets and CacheService internal login",internal.ok&&!!internal.session_token);
  check("Unauthorized approval API denied",apiRouter({action:"portalRequests"}).ok===false);
  const date=addDaysYMD_(fmtDate_(nowBangkok_()),30), start="09:00", end="10:00";
  const booking=apiRouter({action:"bookRoom",session_token:internal.session_token,room_name:ROOMS[0],book_date:date,start_time:start,end_time:end,purpose:"UAT runtime smoke"});
  if(!booking.ok)throw new Error("Choose a clean synthetic UAT date for smoke test: "+booking.error);
  check("Real spreadsheet booking write",booking.ok);
  check("Real booking conflict",apiRouter({action:"bookRoom",session_token:internal.session_token,room_name:ROOMS[0],book_date:date,start_time:start,end_time:end,purpose:"UAT runtime conflict"}).ok===false);
  check("Real booking cancellation",apiRouter({action:"cancelRoomBooking",session_token:internal.session_token,booking_id:booking.booking_ids[0]}).ok);
  const device=getDisplaySheet_(),values=device.sh.getDataRange().getValues()[1];
  check("Room display runtime",apiRouter({action:"fetchRoomDisplayState",device_token:values[device.map.device_token-1]}).ok);
  check("Logout",apiRouter({action:"roomLogout",session_token:internal.session_token}).ok);
  const report={environment:"UAT",checks:checks,emailDelivery:"NOT_TESTED",externalOtp:"NOT_TESTED",concurrentExecutions:"NOT_TESTED"};
  p.setProperty("UAT_RUNTIME_REPORT",JSON.stringify(report));
  console.log(JSON.stringify(report));return report;
}

function auditUat_() {
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty("APP_ENV")!=="UAT")throw new Error("UAT only");
  ["ROOM","USER","ALLOWLIST","DISPLAY"].forEach(k=>{
    const ss=SpreadsheetApp.openById(spreadsheetId_(k+"_SHEET_ID"));
    if(!ss.getName().startsWith("ISE RoomBooking UAT synthetic "))throw new Error("Unexpected UAT spreadsheet title");
  });
  return {ok:true,environment:"UAT",isolated:true};
}
