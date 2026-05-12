/**********************
 * ISE Room Booking Dashboard - CLEAN HTMLSERVICE VERSION
 * Keep ONLY this file plus Index.html in a NEW Apps Script project.
 **********************/

const ROOM_SHEET_ID = "1iGdCS7X9J-l-sZ5dOs8_ZOs0j0nujEDIBi4qZhYmywk";
const ROOM_TAB_NAME = "RoomBookings";

const USER_SHEET_ID = "1YnNZe9AY5GFV_kGl6e_kB07OZenjJ5AIUxNFoO-d0O8";
const USER_TAB_NAME = "Users";

const ALLOWLIST_SHEET_ID = USER_SHEET_ID;
const ALLOWLIST_TAB_NAME = "AllowedUsers";

const TZ = "Asia/Bangkok";
const ROOMS = [
  "ISE Meeting Room 1 (1st Fl.)",
  "ISE Meeting Room 2 (2nd Fl.)",
  "ISE Meeting Room 3 (Interhub)"
];

const ALLOWLIST_HEADERS = ["email","emp_id","active"];
const ROOM_HEADERS = [
  "booking_id","room_name","book_date",
  "start_time","end_time","purpose","note","invite_emails",
  "requester_emp_id","requester_name","requester_email",
  "status","created_at","updated_at",
  "series_id","recurrence_type","occurrence_no",
  "display_source","display_device_id","display_device_name"
];
const USER_HEADERS = [
  "id","name","email","Password",
  "device_id","pending_device_id","created_at",
  "position","contact_address","contact_phone",
  "photo_base64","photo_mime","start_work_date"
];

const DISPLAY_SHEET_ID = "18w1DTXgoYcuXYrmtFMrGal-QqDra5lVSLe0_6tCic7g";
const DISPLAY_TAB_NAME = "RoomDisplayDevices";
const DISPLAY_HEADERS = [
  "device_id","room_name","device_name","device_token",
  "active","allow_booking","last_seen_at","created_at","updated_at"
];

const SESSION_TAB_NAME = "RoomSessions";
const SESSION_HEADERS = ["session_token","email","created_at","expires_at","last_seen_at","is_active"];
const RESET_TAB_NAME = "RoomPasswordResetCodes";
const RESET_HEADERS = ["email","reset_code","created_at","expires_at","used_at","request_source"];

const SESSION_DURATION_HOURS = 24 * 7;
const RESET_CODE_TTL_MINUTES = 15;
const SESSION_CACHE_SECONDS = SESSION_DURATION_HOURS * 3600;

// ========== BASIC ==========
function doGet() {
  initializeApp_();
  return HtmlService
    .createHtmlOutputFromFile("Index")
    .setTitle("ISE Room Booking Dashboard")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Optional for debugging with fetch / Postman
function doPost(e) {
  try {
    initializeApp_();
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const body = JSON.parse(raw);
    return ContentService
      .createTextOutput(JSON.stringify(apiRouter(body)))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function apiRouter(body) {
  initializeApp_();
  return dispatchAction_(body || {});
}

function dispatchAction_(body) {
  const action = String(body.action || "").trim();

  if (action === "ping") return { ok: true, msg: "pong" };
  if (action === "roomLogin") return handleRoomLoginData_(body);
  if (action === "roomGetSession") return handleRoomGetSessionData_(body);
  if (action === "roomLogout") return handleRoomLogoutData_(body);
  if (action === "roomRequestPasswordReset") return handleRoomRequestPasswordResetData_(body);
  if (action === "roomConfirmPasswordReset") return handleRoomConfirmPasswordResetData_(body);

  if (action === "fetchRoomMeta") return handleFetchRoomMetaData_(body);
  if (action === "fetchRoomBookings") return handleFetchRoomBookingsData_(body);
  if (action === "fetchRoomBookingsRange") return handleFetchRoomBookingsRangeData_(body);
  if (action === "fetchRoomDashboardSummary") return handleFetchRoomDashboardSummaryData_(body);

  if (action === "bookRoomDashboard" || action === "bookRoom") return handleBookRoomDashboardData_(body);
  if (action === "cancelRoomBookingDashboard" || action === "cancelRoomBooking") return handleCancelRoomBookingDashboardData_(body);
  if (action === "fetchRoomDisplayState") return handleFetchRoomDisplayStateData_(body);
  if (action === "bookRoomFromDisplay") return handleBookRoomFromDisplayData_(body);
  if (action === "fetchRoomDisplaySchedule") return handleFetchRoomDisplayScheduleData_(body);

  return { ok: false, error: "Unknown action" };
}

function initializeApp_() {
  getRoomSheet_();
  getAllowlistSheet_();
  getUserSheet_();
  getSessionSheet_();
  getResetSheet_();
  getDisplaySheet_();
}

function nowBangkok_() { return new Date(); }
function fmtDate_(d) { return Utilities.formatDate(d, TZ, "yyyy-MM-dd"); }
function fmtTime_(d) { return Utilities.formatDate(d, TZ, "HH:mm"); }
function fmtDateTime_(d) { return Utilities.formatDate(d, TZ, "yyyy-MM-dd HH:mm:ss"); }

// make  helper view for multiple view
function addDaysYMD_(ymd, days) {
  const d = parseYMD_(ymd);
  if (!d) return "";
  d.setDate(d.getDate() + Number(days || 0));
  return ymdFromDate_(d);
}

function firstDayOfMonthYMD_(ymd) {
  const d = parseYMD_(ymd || fmtDate_(nowBangkok_()));
  if (!d) return fmtDate_(nowBangkok_()).slice(0, 8) + "01";
  return Utilities.formatDate(new Date(d.getFullYear(), d.getMonth(), 1), TZ, "yyyy-MM-dd");
}

function lastDayOfMonthYMD_(ymd) {
  const d = parseYMD_(ymd || fmtDate_(nowBangkok_()));
  if (!d) return fmtDate_(nowBangkok_());
  return Utilities.formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0), TZ, "yyyy-MM-dd");
}

function eachDateInRange_(startYmd, endYmd) {
  const dates = [];
  let cursor = parseYMD_(startYmd);
  const end = parseYMD_(endYmd);
  if (!cursor || !end) return dates;

  while (cursor <= end) {
    dates.push(ymdFromDate_(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function toYMD_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  if (typeof v === "number" && isFinite(v)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const dNum = new Date(epoch.getTime() + Math.round(v * 24 * 60 * 60 * 1000));
    return Utilities.formatDate(dNum, TZ, "yyyy-MM-dd");
  }
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d)) return Utilities.formatDate(d, TZ, "yyyy-MM-dd");
  return "";
}

function toHHMM_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "HH:mm");
  if (typeof v === "number" && isFinite(v)) {
    const totalMinutes = Math.round((v % 1) * 24 * 60) % (24 * 60);
    const hh = ("0" + Math.floor(totalMinutes / 60)).slice(-2);
    const mm = ("0" + (totalMinutes % 60)).slice(-2);
    return hh + ":" + mm;
  }
  const s = String(v || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return ("0" + Number(m[1])).slice(-2) + ":" + m[2];
  const d = new Date(s);
  if (!isNaN(d)) return Utilities.formatDate(d, TZ, "HH:mm");
  return "";
}

function timeToMinutes_(hhmm) {
  const normalized = toHHMM_(hhmm);
  const m = String(normalized || "").match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isOverlap_(startA, endA, startB, endB) {
  const a1 = timeToMinutes_(startA);
  const a2 = timeToMinutes_(endA);
  const b1 = timeToMinutes_(startB);
  const b2 = timeToMinutes_(endB);
  if ([a1, a2, b1, b2].some(function(v) { return v == null; })) return false;
  return a1 < b2 && b1 < a2;
}

function randId_(len) {
  len = len || 20;
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function parseYMD_(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function ymdFromDate_(d) { return Utilities.formatDate(d, TZ, "yyyy-MM-dd"); }
function addDays_(d, days) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + days); return x; }
function addMonthsSafe_(d, months) {
  const day = d.getDate();
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setMonth(x.getMonth() + months);
  const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, lastDay));
  return x;
}
function generateOccurrenceDates_(startDate, recurrence) {
  if (!recurrence || !recurrence.freq || String(recurrence.freq).toUpperCase() === "NONE") return [startDate];
  const freq = String(recurrence.freq || "NONE").toUpperCase();
  const interval = Math.max(1, Number(recurrence.interval || 1));
  const endType = String(recurrence.end_type || "COUNT").toUpperCase();
  const count = Math.min(120, Math.max(1, Number(recurrence.count || 1)));
  const until = toYMD_(recurrence.until);

  let cursor = parseYMD_(startDate);
  if (!cursor) return [startDate];
  const dates = [startDate];

  while (dates.length < 120) {
    if (freq === "DAILY") cursor = addDays_(cursor, interval);
    else if (freq === "WEEKLY") cursor = addDays_(cursor, 7 * interval);
    else if (freq === "MONTHLY") cursor = addMonthsSafe_(cursor, interval);
    else break;

    const nextKey = ymdFromDate_(cursor);
    if (endType === "UNTIL" && until && nextKey > until) break;
    dates.push(nextKey);
    if (endType !== "UNTIL" && dates.length >= count) break;
  }
  return dates;
}

function normalizeEmail_(email) { return String(email || "").trim().toLowerCase(); }
function prettifyNameFromEmail_(email) {
  const local = normalizeEmail_(email).split("@")[0] || "";
  return local.split(".").filter(Boolean).map(function(part) {
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}
function sha256Hex_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(function(b) { return ("0" + (b & 0xFF).toString(16)).slice(-2); }).join("");
}
function isHash64_(s) {
  const t = String(s || "").trim();
  return /^[0-9a-f]{64}$/i.test(t);
}

// ========== SHEETS ==========
function ensureHeadersAndMap_(sh, requiredHeaders) {
  if (sh.getLastRow() === 0) sh.appendRow(requiredHeaders);

  const lastCol = Math.max(sh.getLastColumn(), requiredHeaders.length);
  const headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v) {
    return String(v || "").trim();
  });

  const isBlank = headerRow.every(function(v) { return v === ""; });
  if (isBlank) {
    sh.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    const map = {};
    requiredHeaders.forEach(function(h, i) { map[h] = i + 1; });
    return map;
  }

  const map = {};
  headerRow.forEach(function(h, i) { if (h) map[h] = i + 1; });

  let appended = false;
  requiredHeaders.forEach(function(h) {
    if (!map[h]) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
      appended = true;
    }
  });

  if (appended) {
    const newHeaderRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(v) {
      return String(v || "").trim();
    });
    const newMap = {};
    newHeaderRow.forEach(function(h, i) { if (h) newMap[h] = i + 1; });
    return newMap;
  }

  return map;
}

function getOrCreateSheet_(spreadsheetId, tabName) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  return ss.getSheetByName(tabName) || ss.insertSheet(tabName);
}

function getRoomSheet_() {
  const sh = getOrCreateSheet_(ROOM_SHEET_ID, ROOM_TAB_NAME);
  const map = ensureHeadersAndMap_(sh, ROOM_HEADERS);
  try {
    if (sh.getMaxRows() >= 2) {
      sh.getRange(2, map["book_date"], Math.max(1, sh.getMaxRows() - 1), 3).setNumberFormat("@");
    }
  } catch (err) {}
  return { sh: sh, map: map };
}

function appendRoomBookingRecord_(record) {
  const obj = getRoomSheet_();
  const sh = obj.sh;
  const map = obj.map;

  const row = new Array(sh.getLastColumn()).fill("");

  Object.keys(record).forEach(function(key) {
    if (map[key]) {
      row[map[key] - 1] = record[key];
    }
  });

  sh.appendRow(row);
}

function getUserSheet_() {
  const sh = getOrCreateSheet_(USER_SHEET_ID, USER_TAB_NAME);
  const map = ensureHeadersAndMap_(sh, USER_HEADERS);
  return { sh: sh, map: map };
}

function getDisplaySheet_() {
  const sh = getOrCreateSheet_(DISPLAY_SHEET_ID, DISPLAY_TAB_NAME);
  const map = ensureHeadersAndMap_(sh, DISPLAY_HEADERS);
  return { sh: sh, map: map };
}

function getAllowlistSheet_() {
  const sh = getOrCreateSheet_(ALLOWLIST_SHEET_ID, ALLOWLIST_TAB_NAME);
  const map = ensureHeadersAndMap_(sh, ALLOWLIST_HEADERS);
  return { sh: sh, map: map };
}

function getSessionSheet_() {
  const sh = getOrCreateSheet_(USER_SHEET_ID, SESSION_TAB_NAME);
  const map = ensureHeadersAndMap_(sh, SESSION_HEADERS);
  return { sh: sh, map: map };
}

function getResetSheet_() {
  const sh = getOrCreateSheet_(USER_SHEET_ID, RESET_TAB_NAME);
  const map = ensureHeadersAndMap_(sh, RESET_HEADERS);
  try {
    if (sh.getMaxRows() >= 2) {
      sh.getRange(2, map["email"], Math.max(1, sh.getMaxRows() - 1), 2).setNumberFormat("@");
    }
  } catch (err) {}
  return { sh: sh, map: map };
}

// ========== USERS ==========
function findUserByEmail_(emailLower) {
  const safeEmail = normalizeEmail_(emailLower);
  if (!safeEmail) return null;

  const obj = getUserSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (let i = 0; i < values.length; i++) {
    const rowEmail = normalizeEmail_(values[i][map["email"] - 1]);
    if (rowEmail === safeEmail) {
      return {
        id: String(values[i][map["id"] - 1] || "").trim(),
        name: String(values[i][map["name"] - 1] || "").trim(),
        email: safeEmail
      };
    }
  }
  return null;
}

function findAllowedUserByEmail_(emailLower) {
  const safeEmail = normalizeEmail_(emailLower);
  if (!safeEmail) return null;

  const obj = getAllowlistSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (let i = 0; i < values.length; i++) {
    const rowEmail = normalizeEmail_(values[i][map["email"] - 1]);
    const active = String(values[i][map["active"] - 1] || "").trim().toUpperCase();
    if (rowEmail === safeEmail && active !== "FALSE" && active !== "0" && active !== "NO") {
      return {
        email: rowEmail,
        emp_id: String(values[i][map["emp_id"] - 1] || "").trim()
      };
    }
  }
  return null;
}

function assertAllowedEmail_(emailLower) {
  const safeEmail = normalizeEmail_(emailLower);
  if (!safeEmail) return { ok: false, error_code: "MISSING_EMAIL", error: "Missing email" };

  const allowedRow = findAllowedUserByEmail_(safeEmail);
  if (!allowedRow) {
    return { ok: false, error_code: "EMAIL_NOT_ALLOWED", error: "Email is not allowed for room dashboard booking" };
  }

  const user = findUserByEmail_(safeEmail);
  return {
    ok: true,
    requester_email: safeEmail,
    requester_emp_id: (user && user.id) ? user.id : (allowedRow.emp_id || ""),
    requester_name: user && user.name ? user.name : prettifyNameFromEmail_(safeEmail)
  };
}

function findUserRowByEmail_(sh, map, emailLower) {
  const safeEmail = normalizeEmail_(emailLower);
  const lastRow = sh.getLastRow();
  if (lastRow < 2 || !safeEmail) return null;

  const values = sh.getRange(2, map["email"], lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (normalizeEmail_(values[i][0]) === safeEmail) return i + 2;
  }
  return null;
}

function getUserFromRow_(sh, map, row) {
  return {
    id: String(sh.getRange(row, map["id"]).getValue() || "").trim(),
    name: String(sh.getRange(row, map["name"]).getValue() || "").trim(),
    email: normalizeEmail_(sh.getRange(row, map["email"]).getValue())
  };
}

function verifyPasswordAndMaybeMigrate_(sh, map, row, plainPassword) {
  const colPw = map["Password"];
  const storedPw = String(sh.getRange(row, colPw).getValue() || "").trim();
  const incomingHash = sha256Hex_(plainPassword);

  if (isHash64_(storedPw)) {
    return storedPw.toLowerCase() === incomingHash.toLowerCase();
  }

  const ok = (storedPw === String(plainPassword || ""));
  if (ok) sh.getRange(row, colPw).setValue(incomingHash);
  return ok;
}

function getUserAuthContextByEmail_(emailLower) {
  const allowed = assertAllowedEmail_(emailLower);
  if (!allowed.ok) return { ok: false, error_code: "INVALID_CREDENTIALS", error: "Invalid email or password" };

  const obj = getUserSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const row = findUserRowByEmail_(sh, map, allowed.requester_email);
  if (!row) return { ok: false, error_code: "NO_USER", error: "Account not found" };

  return {
    ok: true,
    sh: sh,
    map: map,
    row: row,
    user: getUserFromRow_(sh, map, row),
    allowed: allowed
  };
}

// ========== SESSION ==========
function sessionCacheKey_(token) { return "room_session_" + token; }

function writeSessionCache_(token, payload) {
  const cache = CacheService.getScriptCache();
  cache.put(sessionCacheKey_(token), JSON.stringify(payload), SESSION_CACHE_SECONDS);
}

function clearSessionCache_(token) {
  CacheService.getScriptCache().remove(sessionCacheKey_(token));
}

function generateRoomSessionToken_() {
  return randId_(48) + randId_(16);
}

function createRoomSession_(emailLower) {
  const safeEmail = normalizeEmail_(emailLower);
  const obj = getSessionSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const now = nowBangkok_();
  const expires = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const token = generateRoomSessionToken_();
  const createdAt = fmtDateTime_(now);
  const expiresAt = fmtDateTime_(expires);

  sh.appendRow([token, safeEmail, createdAt, expiresAt, createdAt, "TRUE"]);
  writeSessionCache_(token, {
    email: safeEmail,
    expires_at: expiresAt,
    is_active: true
  });

  return { session_token: token, expires_at: expiresAt };
}

function getRoomSessionByToken_(sessionToken) {
  const token = String(sessionToken || "").trim();
  if (!token) return null;

  const now = nowBangkok_().getTime();
  const cache = CacheService.getScriptCache();
  const cached = cache.get(sessionCacheKey_(token));
  if (cached) {
    try {
      const data = JSON.parse(cached);
      const expiresDate = new Date(String(data.expires_at || "").replace(" ", "T"));
      if (data.is_active && !isNaN(expiresDate.getTime()) && expiresDate.getTime() >= now) {
        return {
          row: 0,
          sh: null,
          map: null,
          email: normalizeEmail_(data.email),
          expires_at: data.expires_at
        };
      }
    } catch (err) {}
  }

  const obj = getSessionSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    const rowToken = String(row[map["session_token"] - 1] || "").trim();
    const active = String(row[map["is_active"] - 1] || "").trim().toUpperCase();
    const expiresAt = String(row[map["expires_at"] - 1] || "").trim();

    if (rowToken !== token) continue;
    if (active === "FALSE" || active === "0" || active === "NO") return null;

    const expiresDate = new Date(expiresAt.replace(" ", "T"));
    if (isNaN(expiresDate.getTime()) || expiresDate.getTime() < now) {
      sh.getRange(i + 2, map["is_active"]).setValue("FALSE");
      sh.getRange(i + 2, map["last_seen_at"]).setValue(fmtDateTime_(nowBangkok_()));
      clearSessionCache_(token);
      return null;
    }

    sh.getRange(i + 2, map["last_seen_at"]).setValue(fmtDateTime_(nowBangkok_()));
    writeSessionCache_(token, {
      email: normalizeEmail_(row[map["email"] - 1]),
      expires_at: expiresAt,
      is_active: true
    });
    return {
      row: i + 2,
      sh: sh,
      map: map,
      email: normalizeEmail_(row[map["email"] - 1]),
      expires_at: expiresAt
    };
  }
  return null;
}

function deactivateRoomSession_(sessionToken) {
  const token = String(sessionToken || "").trim();
  if (!token) return false;
  clearSessionCache_(token);

  const obj = getSessionSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return false;

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    const rowToken = String(values[i][map["session_token"] - 1] || "").trim();
    if (rowToken === token) {
      sh.getRange(i + 2, map["is_active"]).setValue("FALSE");
      sh.getRange(i + 2, map["last_seen_at"]).setValue(fmtDateTime_(nowBangkok_()));
      return true;
    }
  }
  return false;
}

function deactivateAllSessionsForEmail_(emailLower) {
  const safeEmail = normalizeEmail_(emailLower);
  if (!safeEmail) return 0;

  const obj = getSessionSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const rowEmail = normalizeEmail_(values[i][map["email"] - 1]);
    const active = String(values[i][map["is_active"] - 1] || "").trim().toUpperCase();
    const token = String(values[i][map["session_token"] - 1] || "").trim();
    if (rowEmail === safeEmail && active !== "FALSE" && active !== "0" && active !== "NO") {
      sh.getRange(i + 2, map["is_active"]).setValue("FALSE");
      sh.getRange(i + 2, map["last_seen_at"]).setValue(fmtDateTime_(nowBangkok_()));
      clearSessionCache_(token);
      count += 1;
    }
  }
  return count;
}

function requireRoomSession_(body) {
  const found = getRoomSessionByToken_(body.session_token);
  if (!found) return { ok: false, error_code: "AUTH_REQUIRED", error: "Please log in again" };

  const ctx = getUserAuthContextByEmail_(found.email);
  if (!ctx.ok) return { ok: false, error_code: "AUTH_REQUIRED", error: "Please log in again" };

  return { ok: true, session: found, user: ctx.user, allowed: ctx.allowed };
}


function generateDisplayToken_() {
  return "DSP_" + randId_(40);
}

function findDisplayDeviceByToken_(deviceToken) {
  const token = String(deviceToken || "").trim();
  if (!token) return null;

  const obj = getDisplaySheet_();
  const sh = obj.sh;
  const map = obj.map;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (let i = 0; i < values.length; i++) {
    const rowToken = String(values[i][map["device_token"] - 1] || "").trim();
    const active = String(values[i][map["active"] - 1] || "").trim().toUpperCase();
    if (rowToken === token && active !== "FALSE" && active !== "0" && active !== "NO") {
      return {
        row: i + 2,
        sh: sh,
        map: map,
        device_id: String(values[i][map["device_id"] - 1] || "").trim(),
        room_name: String(values[i][map["room_name"] - 1] || "").trim(),
        device_name: String(values[i][map["device_name"] - 1] || "").trim(),
        allow_booking: String(values[i][map["allow_booking"] - 1] || "").trim().toUpperCase() !== "FALSE"
      };
    }
  }
  return null;
}

function touchDisplayDevice_(device) {
  if (!device || !device.sh || !device.map || !device.row) return;
  device.sh.getRange(device.row, device.map["last_seen_at"]).setValue(fmtDateTime_(nowBangkok_()));
  if (device.map["updated_at"]) {
    device.sh.getRange(device.row, device.map["updated_at"]).setValue(fmtDateTime_(nowBangkok_()));
  }
}

function requireDisplayDevice_(body) {
  const device = findDisplayDeviceByToken_(body.device_token);
  if (!device) return { ok: false, error_code: "DISPLAY_AUTH_REQUIRED", error: "Invalid display device token" };
  touchDisplayDevice_(device);
  return { ok: true, device: device };
}

// ========== PASSWORD RESET ==========
function generateResetCode_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeResetCode_(code) {
  return String(code || "").replace(/\D/g, "").slice(0, 6);
}

function storePasswordResetCode_(emailLower, code, requestSource) {
  const obj = getResetSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const now = nowBangkok_();
  const expires = new Date(now.getTime() + RESET_CODE_TTL_MINUTES * 60 * 1000);
  const safeEmail = normalizeEmail_(emailLower);
  const safeCode = normalizeResetCode_(code);

  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (let i = values.length - 1; i >= 0; i--) {
      const rowEmail = normalizeEmail_(values[i][map["email"] - 1]);
      const usedAt = String(values[i][map["used_at"] - 1] || "").trim();
      if (rowEmail === safeEmail && !usedAt) {
        sh.getRange(i + 2, map["used_at"]).setValue(fmtDateTime_(now));
      }
    }
  }

  sh.appendRow([
    safeEmail,
    safeCode,
    fmtDateTime_(now),
    fmtDateTime_(expires),
    "",
    String(requestSource || "").trim()
  ]);
}

function sendPasswordResetCodeEmail_(emailLower, code) {
  const safeEmail = normalizeEmail_(emailLower);
  if (!safeEmail) return;
  const subject = "ISE Room Booking - Password Reset Code";
  const body = [
    "Hello,",
    "",
    "Your password reset code for the ISE Room Booking Dashboard is:",
    "",
    "  " + code,
    "",
    "This code will expire in " + RESET_CODE_TTL_MINUTES + " minutes.",
    "If you did not request this, please ignore this email.",
    "",
    "Regards,",
    "ISE Room Booking System"
  ].join("\n");
  MailApp.sendEmail({
    to:safeEmail,
    subject: subject,
    body: body,
    name:"ISE Room Booking System",
    noReply:true
  });
}

function parseResetDateValue_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  const s = String(value || "").trim();
  if (!s) return null;

  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) return d1;

  const d2 = new Date(s.replace(" ", "T"));
  if (!isNaN(d2.getTime())) return d2;

  return null;
}

function parseResetDateValue_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  const s = String(value || "").trim();
  if (!s) return null;

  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) return d1;

  const d2 = new Date(s.replace(" ", "T"));
  if (!isNaN(d2.getTime())) return d2;

  return null;
}

function findValidResetCodeRow_(emailLower, code) {
  const safeEmail = normalizeEmail_(emailLower);
  const safeCode = normalizeResetCode_(code);
  if (!safeEmail || !safeCode) return null;

  const obj = getResetSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const nowMs = nowBangkok_().getTime();

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    const rowEmail = normalizeEmail_(row[map["email"] - 1]);
    const rowCode = normalizeResetCode_(row[map["reset_code"] - 1]);
    const usedAt = String(row[map["used_at"] - 1] || "").trim();
    const expiresRaw = row[map["expires_at"] - 1];

    if (rowEmail !== safeEmail) continue;
    if (rowCode !== safeCode) continue;
    if (usedAt) continue;

    const expiresDate = parseResetDateValue_(expiresRaw);
    if (!expiresDate) continue;
    if (expiresDate.getTime() < nowMs) continue;

    return { row: i + 2, sh: sh, map: map };
  }

  return null;
}

// ========== AUTH ACTIONS ==========
function handleRoomLoginData_(body) {
  const email = normalizeEmail_(body.email);
  const password = String(body.password || "");

  if (!email || !password) {
    return { ok: false, error_code: "MISSING_FIELDS", error: "Missing email or password" };
  }

  const ctx = getUserAuthContextByEmail_(email);
  if (!ctx.ok) return { ok: false, error_code: "INVALID_CREDENTIALS", error: "Invalid email or password" };

  const okPw = verifyPasswordAndMaybeMigrate_(ctx.sh, ctx.map, ctx.row, password);
  if (!okPw) return { ok: false, error_code: "INVALID_CREDENTIALS", error: "Invalid email or password" };

  const session = createRoomSession_(email);
  return {
    ok: true,
    session_token: session.session_token,
    expires_at: session.expires_at,
    user: ctx.user,
    rooms: ROOMS
  };
}

function handleRoomGetSessionData_(body) {
  const auth = requireRoomSession_(body);
  if (!auth.ok) return auth;
  return {
    ok: true,
    user: auth.user,
    expires_at: auth.session.expires_at,
    rooms: ROOMS
  };
}

function handleRoomLogoutData_(body) {
  deactivateRoomSession_(body.session_token);
  return { ok: true };
}

function handleRoomRequestPasswordResetData_(body) {
  const email = normalizeEmail_(body.email);
  const genericResponse = { ok: true, message: "If the email is eligible, a reset code has been sent." };
  if (!email) return genericResponse;

  const ctx = getUserAuthContextByEmail_(email);
  if (!ctx.ok) return genericResponse;

  const code = generateResetCode_();
  storePasswordResetCode_(email, code, "htmlservice");
  try {
    sendPasswordResetCodeEmail_(email, code);
  } catch (err) {
    return { ok: false, error_code: "MAIL_FAILED", error: "Unable to send reset email. Please authorize MailApp and try again." };
  }
  return genericResponse;
}

function handleRoomConfirmPasswordResetData_(body) {
  const email = normalizeEmail_(body.email);
  const code = normalizeResetCode_(body.code);
  const newPassword = String(body.new_password || "");

  if (!email || !code || !newPassword) {
    return { ok: false, error_code: "MISSING_FIELDS", error: "Missing email, code, or new password" };
  }
  if (newPassword.length < 6) {
    return { ok: false, error_code: "WEAK_PASSWORD", error: "Password must be at least 6 characters" };
  }

  const found = findValidResetCodeRow_(email, code);
  if (!found) {
    return { ok: false, error_code: "INVALID_RESET", error: "Invalid or expired reset code" };
  }

  const ctx = getUserAuthContextByEmail_(email);
  if (!ctx.ok) {
    return { ok: false, error_code: "NO_USER", error: "Account not found or not allowed" };
  }

  ctx.sh.getRange(ctx.row, ctx.map["Password"]).setValue(sha256Hex_(newPassword));
  found.sh.getRange(found.row, found.map["used_at"]).setValue(fmtDateTime_(nowBangkok_()));
  deactivateAllSessionsForEmail_(email);

  return { ok: true, message: "Password updated successfully" };
}

// ========== BOOKINGS ==========
function rowToBooking_(row, map) {
  return {
    booking_id: String(row[map["booking_id"] - 1] || "").trim(),
    room_name: String(row[map["room_name"] - 1] || "").trim(),
    book_date: toYMD_(row[map["book_date"] - 1]),
    start_time: toHHMM_(row[map["start_time"] - 1]),
    end_time: toHHMM_(row[map["end_time"] - 1]),
    purpose: String(row[map["purpose"] - 1] || "").trim(),
    note: String(row[map["note"] - 1] || "").trim(),
    requester_emp_id: String(row[map["requester_emp_id"] - 1] || "").trim(),
    requester_name: String(row[map["requester_name"] - 1] || "").trim(),
    requester_email: normalizeEmail_(row[map["requester_email"] - 1]),
    status: String(row[map["status"] - 1] || "").trim().toUpperCase(),
    created_at: String(row[map["created_at"] - 1] || "").trim(),
    updated_at: String(row[map["updated_at"] - 1] || "").trim(),
    series_id: map["series_id"] ? String(row[map["series_id"] - 1] || "").trim() : "",
    recurrence_type: map["recurrence_type"] ? String(row[map["recurrence_type"] - 1] || "").trim() : "",
    occurrence_no: map["occurrence_no"] ? String(row[map["occurrence_no"] - 1] || "").trim() : ""
  };
}

function bookingToPublic_(booking) {
  return {
    booking_id: booking.booking_id,
    room_name: booking.room_name,
    book_date: booking.book_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    purpose: booking.purpose,
    note: booking.note,
    requester_name: booking.requester_name || "Booked",
    status: booking.status,
    created_at: booking.created_at,
    updated_at: booking.updated_at,
    series_id: booking.series_id,
    recurrence_type: booking.recurrence_type,
    occurrence_no: booking.occurrence_no
  };
}

function getActiveRoomBookingsInRange_(startDate, endDate) {
  const obj = getRoomSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const rows = [];

  values.forEach(function(row) {
    const booking = rowToBooking_(row, map);
    if (booking.status !== "ACTIVE") return;
    if (booking.book_date < startDate || booking.book_date > endDate) return;
    rows.push(booking);
  });

  rows.sort(function(a, b) {
    return (a.book_date + "|" + a.room_name + "|" + a.start_time).localeCompare(b.book_date + "|" + b.room_name + "|" + b.start_time);
  });

  return rows;
}

function getActiveRoomBookingsByDate_(bookDate) {
  return getActiveRoomBookingsInRange_(bookDate, bookDate);
}

function findBookingRowById_(bookingId) {
  const obj = getRoomSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (let i = 0; i < values.length; i++) {
    const id = String(values[i][map["booking_id"] - 1] || "").trim();
    if (id === bookingId) return { row: i + 2, sh: sh, map: map };
  }
  return null;
}

function buildDashboardSummary_(bookDate, bookings) {
  bookings = bookings || [];
  const now = nowBangkok_();
  const currentDate = fmtDate_(now);
  const currentTime = fmtTime_(now);

  const totalBookings = bookings.length;
  const totalReservedMinutes = bookings.reduce(function(sum, b) {
    const start = timeToMinutes_(b.start_time);
    const end = timeToMinutes_(b.end_time);
    return sum + ((start != null && end != null && end > start) ? (end - start) : 0);
  }, 0);

  const byRoom = ROOMS.map(function(room) {
    const items = bookings.filter(function(b) { return b.room_name === room; });
    const minutes = items.reduce(function(sum, b) {
      const start = timeToMinutes_(b.start_time);
      const end = timeToMinutes_(b.end_time);
      return sum + ((start != null && end != null && end > start) ? (end - start) : 0);
    }, 0);
    return { room_name: room, booking_count: items.length, reserved_minutes: minutes };
  });

  const currentStatus = ROOMS.map(function(room) {
    const inUse = (bookDate === currentDate) && bookings.some(function(b) {
      return b.room_name === room && isOverlap_(b.start_time, b.end_time, currentTime, currentTime);
    });
    return { room_name: room, in_use: inUse };
  });

  return {
    total_bookings: totalBookings,
    total_reserved_minutes: totalReservedMinutes,
    free_rooms_now: currentStatus.filter(function(x) { return !x.in_use; }).length,
    by_room: byRoom,
    current_status: currentStatus
  };
}

function handleFetchRoomMetaData_(body) {
  const auth = requireRoomSession_(body);
  if (!auth.ok) return auth;
  return { ok: true, rooms: ROOMS, user: auth.user };
}

function handleFetchRoomBookingsData_(body) {
  const auth = requireRoomSession_(body);
  if (!auth.ok) return auth;

  const bookDate = toYMD_(body.book_date);
  if (!bookDate) return { ok: false, error_code: "MISSING_FIELDS", error: "Missing or invalid book_date" };

  const bookings = getActiveRoomBookingsByDate_(bookDate);
  return { ok: true, rooms: ROOMS, bookings: bookings.map(bookingToPublic_) };
}

function handleFetchRoomBookingsRangeData_(body) {
  const auth = requireRoomSession_(body);
  if (!auth.ok) return auth;

  const startDate = toYMD_(body.start_date);
  const endDate = toYMD_(body.end_date);
  if (!startDate || !endDate) return { ok: false, error_code: "MISSING_FIELDS", error: "Missing start_date or end_date" };

  const bookings = getActiveRoomBookingsInRange_(startDate, endDate);
  return {
    ok: true,
    rooms: ROOMS,
    start_date: startDate,
    end_date: endDate,
    bookings: bookings.map(bookingToPublic_)
  };
}

function handleFetchRoomDashboardSummaryData_(body) {
  const auth = requireRoomSession_(body);
  if (!auth.ok) return auth;

  const bookDate = toYMD_(body.book_date || fmtDate_(nowBangkok_()));
  if (!bookDate) return { ok: false, error_code: "MISSING_FIELDS", error: "Missing or invalid book_date" };

  const bookings = getActiveRoomBookingsByDate_(bookDate);
  return { ok: true, book_date: bookDate, summary: buildDashboardSummary_(bookDate, bookings) };
}

function handleBookRoomDashboardData_(body) {
  const auth = requireRoomSession_(body);
  if (!auth.ok) return auth;

  const roomName = String(body.room_name || "").trim();
  const bookDate = toYMD_(body.book_date);
  const startTime = toHHMM_(body.start_time);
  const endTime = toHHMM_(body.end_time);
  const purpose = String(body.purpose || "").trim();
  const note = String(body.note || "").trim();

  if (!roomName || !bookDate || !startTime || !endTime || !purpose) {
    return { ok: false, error_code: "MISSING_FIELDS", error: "Missing required fields" };
  }
  if (ROOMS.indexOf(roomName) === -1) return { ok: false, error_code: "INVALID_ROOM", error: "Invalid room" };
  if (timeToMinutes_(startTime) >= timeToMinutes_(endTime)) {
    return { ok: false, error_code: "INVALID_TIME", error: "End time must be after start time" };
  }

  const recurrence = body.recurrence || null;
  const dates = generateOccurrenceDates_(bookDate, recurrence);
  const allConflicts = [];
  const existingRange = getActiveRoomBookingsInRange_(dates[0], dates[dates.length - 1]);

  dates.forEach(function(d) {
    existingRange.forEach(function(existing) {
      if (existing.room_name === roomName && existing.book_date === d && isOverlap_(existing.start_time, existing.end_time, startTime, endTime)) {
        allConflicts.push({
          booking_id: existing.booking_id,
          date: d,
          room_name: existing.room_name,
          start_time: existing.start_time,
          end_time: existing.end_time,
          purpose: existing.purpose,
          requester_name: existing.requester_name
        });
      }
    });
  });

  if (allConflicts.length) {
    return { ok: false, error_code: "CONFLICT", error: "There are booking conflicts", conflicts: allConflicts };
  }

  const obj = getRoomSheet_();
  const sh = obj.sh;
  const map = obj.map;
  const now = fmtDateTime_(nowBangkok_());
  const createdRows = [];
  const seriesId = dates.length > 1 ? ("SER_" + randId_(10)) : "";

  dates.forEach(function(d, idx) {
    const bookingId = "RB_" + randId_(14);
    appendRoomBookingRecord_({
      booking_id: bookingId,
      room_name: roomName,
      book_date: d,
      start_time: startTime,
      end_time: endTime,
      purpose: purpose,
      note: note,
      invite_emails: "",
      requester_emp_id: auth.allowed.requester_emp_id,
      requester_name: auth.allowed.requester_name,
      requester_email: auth.allowed.requester_email,
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
      series_id: seriesId,
      recurrence_type: seriesId ? String((recurrence && recurrence.freq) || "").toUpperCase() : "",
      occurrence_no: seriesId ? String(idx + 1) : "",
      display_source: "user_dashboard",
      display_device_id: "",
      display_device_name: ""
    });
    createdRows.push(bookingId);
  });

  return {
    ok: true,
    created_count: createdRows.length,
    booking_ids: createdRows,
    series_id: seriesId
  };
}

function handleCancelRoomBookingDashboardData_(body) {
  const auth = requireRoomSession_(body);
  if (!auth.ok) return auth;

  const bookingId = String(body.booking_id || "").trim();
  const cancelScope = String(body.cancel_scope || "ONE").trim().toUpperCase();

  if (!bookingId) {
    return { ok: false, error_code: "MISSING_FIELDS", error: "Missing booking_id" };
  }

  const found = findBookingRowById_(bookingId);
  if (!found) {
    return { ok: false, error_code: "NOT_FOUND", error: "Booking not found" };
  }

  const booking = rowToBooking_(
    found.sh.getRange(found.row, 1, 1, found.sh.getLastColumn()).getValues()[0],
    found.map
  );

  const requesterEmail = normalizeEmail_(booking.requester_email);
  const actingEmail = normalizeEmail_(auth.user.email);
  const bookingStatus = String(booking.status || "").trim().toUpperCase();

  if (!actingEmail) {
    return { ok: false, error_code: "AUTH_EMAIL_MISSING", error: "Login email not found" };
  }

  if (!requesterEmail || requesterEmail !== actingEmail) {
    return {
      ok: false,
      error_code: "FORBIDDEN",
      error: "You can cancel only your own bookings"
    };
  }

  if (bookingStatus !== "ACTIVE") {
    return {
      ok: false,
      error_code: "NOT_ACTIVE",
      error: "This booking is not active"
    };
  }

  const now = fmtDateTime_(nowBangkok_());

  if (cancelScope === "SERIES" && booking.series_id) {
    const lastRow = found.sh.getLastRow();
    const values = found.sh.getRange(2, 1, lastRow - 1, found.sh.getLastColumn()).getValues();

    let count = 0;

    for (let i = 0; i < values.length; i++) {
      const b = rowToBooking_(values[i], found.map);
      const bRequesterEmail = normalizeEmail_(b.requester_email);
      const bStatus = String(b.status || "").trim().toUpperCase();

      if (
        b.series_id === booking.series_id &&
        bStatus === "ACTIVE" &&
        bRequesterEmail === actingEmail
      ) {
        found.sh.getRange(i + 2, found.map["status"]).setValue("CANCELLED");
        found.sh.getRange(i + 2, found.map["updated_at"]).setValue(now);
        count += 1;
      }
    }

    return { ok: true, cancelled_count: count, scope: "SERIES" };
  }

  found.sh.getRange(found.row, found.map["status"]).setValue("CANCELLED");
  found.sh.getRange(found.row, found.map["updated_at"]).setValue(now);

  return { ok: true, cancelled_count: 1, scope: "ONE" };
}

function handleFetchRoomDisplayStateData_(body) {
  const auth = requireDisplayDevice_(body);
  if (!auth.ok) return auth;

  const deviceRoomName = auth.device.room_name;
  const bookDate = fmtDate_(nowBangkok_());
  const currentTime = fmtTime_(nowBangkok_());

  const allBookings = getActiveRoomBookingsByDate_(bookDate)
    .sort(function(a, b) {
      return (a.room_name + "|" + a.start_time).localeCompare(b.room_name + "|" + b.start_time);
    });

  function buildRoomState_(roomName) {
    const roomBookings = allBookings
      .filter(function(b) { return b.room_name === roomName; })
      .sort(function(a, b) { return a.start_time.localeCompare(b.start_time); });

    const currentBooking = roomBookings.find(function(b) {
      return isOverlap_(b.start_time, b.end_time, currentTime, currentTime);
    }) || null;

    const nextBooking = roomBookings.find(function(b) {
      return timeToMinutes_(b.start_time) > timeToMinutes_(currentTime);
    }) || null;

    const reservedMinutes = roomBookings.reduce(function(sum, b) {
      const s = timeToMinutes_(b.start_time);
      const e = timeToMinutes_(b.end_time);
      return sum + ((s != null && e != null && e > s) ? (e - s) : 0);
    }, 0);

    return {
      room_name: roomName,
      in_use: !!currentBooking,
      current_booking: currentBooking ? bookingToPublic_(currentBooking) : null,
      next_booking: nextBooking ? bookingToPublic_(nextBooking) : null,
      bookings: roomBookings.map(bookingToPublic_),
      booking_count: roomBookings.length,
      reserved_minutes: reservedMinutes
    };
  }

  const currentRoomState = buildRoomState_(deviceRoomName);
  const roomOverview = ROOMS.map(function(room) {
    return buildRoomState_(room);
  });

  return {
    ok: true,
    room_name: deviceRoomName,
    device_name: auth.device.device_name,
    now_time: currentTime,
    now_date: bookDate,

    // current display room
    in_use: currentRoomState.in_use,
    current_booking: currentRoomState.current_booking,
    next_booking: currentRoomState.next_booking,
    bookings: currentRoomState.bookings,

    // all-room overview
    room_overview: roomOverview,
    all_bookings: allBookings.map(bookingToPublic_),

    allow_booking: auth.device.allow_booking
  };
}

function handleFetchRoomDisplayScheduleData_(body) {
  const auth = requireDisplayDevice_(body);
  if (!auth.ok) return auth;

  const scope = String(body.scope || "DAY").trim().toUpperCase(); // DAY | MONTH
  const targetDate = toYMD_(body.date || fmtDate_(nowBangkok_()));
  const requestedRoomName = String(body.room_name || "").trim();

  const roomFilter = requestedRoomName && ROOMS.indexOf(requestedRoomName) >= 0
    ? requestedRoomName
    : "";

  if (!targetDate) {
    return {
      ok: false,
      error_code: "INVALID_DATE",
      error: "Invalid date"
    };
  }

  let startDate = targetDate;
  let endDate = targetDate;

  if (scope === "MONTH") {
    startDate = firstDayOfMonthYMD_(targetDate);
    endDate = lastDayOfMonthYMD_(targetDate);
  }

  const bookings = getActiveRoomBookingsInRange_(startDate, endDate)
    .filter(function(b) {
      return !roomFilter || b.room_name === roomFilter;
    })
    .sort(function(a, b) {
      return (a.book_date + "|" + a.room_name + "|" + a.start_time)
        .localeCompare(b.book_date + "|" + b.room_name + "|" + b.start_time);
    });

  function bookingMinutes_(b) {
    const s = timeToMinutes_(b.start_time);
    const e = timeToMinutes_(b.end_time);
    return (s != null && e != null && e > s) ? (e - s) : 0;
  }

  const rooms = roomFilter ? [roomFilter] : ROOMS;

  const dayRows = rooms.map(function(room) {
    const items = bookings.filter(function(b) {
      return b.book_date === targetDate && b.room_name === room;
    });

    const reservedMinutes = items.reduce(function(sum, b) {
      return sum + bookingMinutes_(b);
    }, 0);

    return {
      room_name: room,
      booking_count: items.length,
      reserved_minutes: reservedMinutes,
      bookings: items.map(bookingToPublic_)
    };
  });

  const monthDates = eachDateInRange_(startDate, endDate);
  const monthRows = monthDates.map(function(date) {
    const dateBookings = bookings.filter(function(b) {
      return b.book_date === date;
    });

    const byRoom = rooms.map(function(room) {
      const items = dateBookings.filter(function(b) {
        return b.room_name === room;
      });

      const reservedMinutes = items.reduce(function(sum, b) {
        return sum + bookingMinutes_(b);
      }, 0);

      return {
        room_name: room,
        booking_count: items.length,
        reserved_minutes: reservedMinutes,
        bookings: items.map(bookingToPublic_)
      };
    });

    return {
      date: date,
      booking_count: dateBookings.length,
      reserved_minutes: dateBookings.reduce(function(sum, b) {
        return sum + bookingMinutes_(b);
      }, 0),
      by_room: byRoom
    };
  });

  return {
    ok: true,
    scope: scope,
    device_name: auth.device.device_name,
    device_room_name: auth.device.room_name,
    selected_room_name: roomFilter,
    date: targetDate,
    start_date: startDate,
    end_date: endDate,
    rooms: rooms,
    day_rows: dayRows,
    month_rows: monthRows,
    bookings: bookings.map(bookingToPublic_)
  };
}

function handleBookRoomFromDisplayData_(body) {
  const auth = requireDisplayDevice_(body);
  if (!auth.ok) return auth;

  if (!auth.device.allow_booking) {
    return { ok: false, error_code: "DISPLAY_BOOKING_DISABLED", error: "Booking is disabled on this display" };
  }

  const requestedRoomName = String(body.room_name || "").trim();
  const roomName = requestedRoomName || auth.device.room_name;

  if (ROOMS.indexOf(roomName) === -1) {
    return {
      ok: false,
      error_code: "INVALID_ROOM",
      error: "Invalid room"
    };
  }
  const bookDate = toYMD_(body.book_date || fmtDate_(nowBangkok_()));
  const startTime = toHHMM_(body.start_time || fmtTime_(nowBangkok_()));
  const endTime = toHHMM_(body.end_time);
  const purpose = String(body.purpose || "Room Display Booking").trim();
  const note = String(body.note || "").trim();
  const requesterEmail = normalizeEmail_(body.requester_email || "");

  if (!requesterEmail) {
    return { ok: false, error_code: "MISSING_FIELDS", error: "Missing requester email" };
  }

  const allowed = assertAllowedEmail_(requesterEmail);
  if (!allowed.ok) {
    return { ok: false, error_code: "EMAIL_NOT_ALLOWED", error: "Requester email is not allowed" };
  }

  if (!bookDate || !startTime || !endTime) {
    return { ok: false, error_code: "MISSING_FIELDS", error: "Missing required fields" };
  }

  if (timeToMinutes_(startTime) >= timeToMinutes_(endTime)) {
    return { ok: false, error_code: "INVALID_TIME", error: "End time must be after start time" };
  }

  const existing = getActiveRoomBookingsByDate_(bookDate);
  const conflicts = existing.filter(function(b) {
    return b.room_name === roomName && isOverlap_(b.start_time, b.end_time, startTime, endTime);
  });

  if (conflicts.length) {
    return { ok: false, error_code: "CONFLICT", error: "There are booking conflicts", conflicts: conflicts.map(bookingToPublic_) };
  }

  const obj = getRoomSheet_();
  const sh = obj.sh;
  
  const now = fmtDateTime_(nowBangkok_());
  const bookingId = "RB_" + randId_(14);

  appendRoomBookingRecord_({
    booking_id: bookingId,
    room_name: roomName,
    book_date: bookDate,
    start_time: startTime,
    end_time: endTime,
    purpose: purpose,
    note: note,
    invite_emails: "",
    requester_emp_id: allowed.requester_emp_id,
    requester_name: allowed.requester_name,
    requester_email: allowed.requester_email,
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
    series_id: "",
    recurrence_type: "",
    occurrence_no: "",
    display_source: "room_display",
    display_device_id: auth.device.device_id,
    display_device_name: auth.device.device_name
  });


function debugForgotPasswordEligibility_() {
  const emailInput = "mikkungled@gmail.com";
  const email = normalizeEmail_(emailInput);

  const allowed = findAllowedUserByEmail_(email);

  const userObj = getUserSheet_();
  const userRow = findUserRowByEmail_(userObj.sh, userObj.map, email);

  Logger.log("input = " + emailInput);
  Logger.log("normalized_email = " + email);
  Logger.log("allowed_found = " + (!!allowed));
  Logger.log("allowed_data = " + JSON.stringify(allowed));
  Logger.log("user_row_found = " + (!!userRow));
  Logger.log("user_row = " + userRow);

  return {
    input: emailInput,
    normalized_email: email,
    allowed_found: !!allowed,
    allowed_data: allowed,
    user_row_found: !!userRow,
    user_row: userRow
  };
}


function debugForgotPasswordEligibility() {
  return debugForgotPasswordEligibility_()
}
}
