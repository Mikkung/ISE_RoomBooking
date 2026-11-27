/* No production fallback: copy the existing IDs into Script Properties on an
 * explicitly configured production project before upgrading it. */
function validYMD_(value) {
  const s=String(value||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(s+"T00:00:00Z");
  return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function safeCell_(v){return typeof v==="string"&&/^[=+@-]/.test(v)?"'"+v:v;}
function spreadsheetId_(key) {
  const p=PropertiesService.getScriptProperties(), env=p.getProperty("APP_ENV");
  if(!["UAT","PRODUCTION"].includes(env))throw new Error("APP_ENV must be configured");
  const id=p.getProperty(key)||(key==="ALLOWLIST_SHEET_ID"?p.getProperty("USER_SHEET_ID"):"");
  if(!id)throw new Error("Missing Script Property: "+key);
  if(env==="UAT") {
    if(ScriptApp.getScriptId()!==p.getProperty("UAT_SCRIPT_ID"))throw new Error("UAT script identity mismatch");
    const registry=JSON.parse(p.getProperty("UAT_DATABASE_IDS")||"[]");
    if(!registry.includes(id))throw new Error("Spreadsheet is outside the UAT registry");
  }
  return id;
}
