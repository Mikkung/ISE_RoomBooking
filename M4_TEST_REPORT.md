# M4 UAT execution report — 2026-11-27

UAT version 1 is deployed from application commit b8adb0c. The owner initialized three new synthetic databases and passed their Script ID/Spreadsheet ID audit. Core runtime, email verification, approvals, permissions, recurring bookings and same-project concurrency have been exercised against Google. Production and Check_In_App were not changed; main was not merged.

| Executed group | Service boundary | Pass | Fail |
|---|---|---:|---:|
| Node server/integration suite | Mocked Google services | 18 | 0 |
| Chrome UI suite, seven scenarios at three sizes | Mocked Google RPC | 21 | 0 |
| Owner-run prepareUat_ smoke checks | Real Google services; owner-supplied execution log | 7 | 0 |
| Deployed anonymous API and three-route layout checks | Real Google API/HtmlService/CDNs | 25 | 0 |
| Delivered email OTP: wrong code, verification, replay | Real MailApp, owner inbox and endpoint | 3 | 0 |
| Authenticated internal API acceptance | Real Google services | 11 | 0 |
| External requests, decisions and concurrent approvals | Real Google services | 10 | 0 |
| Authenticated browser sign-in/Approval Center/logout | Real Google RPC; desktop/mobile/tablet sizes | 3 | 0 |

The table records final executed groups, not unique features. Real Google evidence comprises 52 agent-executed checks and 7 owner-run checks; local mocked evidence comprises 39 checks. The final authenticated browser run waited for request/approver data to finish loading, verified APPROVED and REJECTED states, checked all three layouts, and logged out successfully.

## Real runtime evidence

The owner supplied the prepareUat_ Google execution log ending at 12:00:42 Asia/Bangkok. It reports PASS for Sheets/CacheService login, unauthorized approval denial, booking write, conflict, cancellation, display state and logout. That function validates all configured UAT spreadsheet IDs and titles before its smoke tests.

`npm run test:live` made seven actual anonymous API checks and rendered the portal, guest portal and display activation page at widths 1440, 390 and 820. Each of nine pages passed rendering and viewport checks. No Google service or browser content was mocked in this run.

`npm run test:uat-email` verified a fresh code delivered to the owner's authorized mailbox. Incorrect code and consumed-code replay were denied. An earlier supplied code was rejected as invalid or expired and was not claimed as a successful verification.

`node tools/uat-auth-smoke.cjs internal` passed three role logins, regular-user approval denial, grant/access/revoke/denial, recurring booking creation, conflict rejection and series cancellation (11 API checks). The recurring test series was cancelled.

`node tools/uat-auth-smoke.cjs external` passed two role logins, overlapping pending requests, My Requests, simultaneous approval calls, notification handoff, retry idempotency, rejection, persisted states and a final booking count (10 checks). The two approval POSTs were issued concurrently with Promise.all. Exactly one request won, the other conflicted, and exactly one active booking persisted. The losing request was then rejected. MailApp accepted both decision emails; their inbox receipt is not separately confirmed. The approved synthetic booking remains in the isolated UAT database as acceptance evidence. One synthetic pending request left by the interrupted attempt was subsequently rejected during cleanup; no production or unrelated request was changed.

`node tools/uat-auth-smoke.cjs browser` uses the actual sign-in form and Google RPC. It visits Approval Center/Manage Approvers and logs out, capturing desktop/mobile/tablet layouts. A transient hostname-certificate mismatch interrupted an earlier API attempt; certificate validation remained enabled and a fresh-connection retry passed. An earlier session-preloading browser attempt was inconclusive and was replaced by normal form sign-in.

## Artifacts and private configuration

Actual deployed screenshots and redacted JSON reports are in ignored `test-results/live/`. Local mocked screenshots are in ignored `test-results/`. Selected actual guest, display and fully loaded mobile Approval Center screenshots were visually inspected. Authenticated screenshots may contain the authorized test email and remain local; they are not public PR attachments.

The runners read the UAT deployment from ignored `.local/uat-deployment.json`, the generated test password from ignored `.local/uat-secrets.json`, and the verified guest token from ignored `.local/uat-guest.json`. OTP input, credentials and tokens are never committed or logged by the runners. Test sessions are logged out and the temporary grant to the regular internal account is revoked during cleanup. Application source was unchanged by this acceptance run.

## Fixes delivered

Restored missing closing HTML/script tags and the display quick-booking success response; respected CacheService's TTL maximum; generated UUID session tokens; validated calendar dates/times; corrected count-one/monthly recurrence; removed a duplicate parser and nested hardcoded-email diagnostic; used text-safe writes; gated OTP verification when external booking is disabled; made approval retries/partial-write recovery safe; allowed revocation of ineligible approvers; bounded rejection reasons; serialized password-reset confirmation; added the HtmlService viewport; corrected occupancy boundaries and mobile dashboard overflow. Original room labels and embedded JPEG bytes were preserved.

## Remaining coverage and integration limits

| Item | Result | Boundary |
|---|---|---|
| Production Check_In_App shared-database audit | BLOCKED | Its frontend references a separate Apps Script backend; backend source and live IDs are not in that repository. No production endpoint/data was accessed. |
| Cross-project booking serialization | UNRESOLVED RISK | Independent projects do not share ScriptLock. If their production booking database is shared, all writes need one authoritative backend or equivalent transactions before production rollout. |
| Live Room Display quick booking | NOT RUN | Quick booking is covered by mocks; actual owner-run display-state checks and live activation-page checks passed. The private UAT device token was not supplied to the external runner. |
| Safari, physical devices and touch behavior | NOT RUN | Chrome viewport sizes were tested; this is not physical mobile/tablet or Safari coverage. |
| Actual service-failure recovery/quota exhaustion | NOT RUN | Partial approval write recovery, OTP limits and expiry are covered by mocks; real quota exhaustion and injected Google-service failure were not attempted. |

Legacy password migration remains SHA-256/cleartext-compatible rather than an identity-provider replacement. Cache eviction can require re-verification; per-address OTP cooldown remains cache-based with a durable global daily email cap. Recurring multi-row writes are serialized but not transactional under service failure. These limits do not justify a production deployment; no production rollout was requested or performed.

See PORTAL_DEPLOYMENT.md for all three actual URLs, deployment identity, environment separation and rollback instructions.
