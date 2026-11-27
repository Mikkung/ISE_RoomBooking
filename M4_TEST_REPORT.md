# M4 execution report - 2026-11-27

The owner supplied a successful prepareUat_ Google execution log at 12:00:42 on 2026-11-27 (Asia/Bangkok). Database initialization/audit and seven real runtime checks passed. UAT version 1 is deployed from b8adb0c. Actual endpoint/browser smoke results are recorded below. Email delivery and simultaneous authenticated executions remain unverified. No production data was accessed.

| Check | Result | Evidence / boundary |
|---|---|---|
| Clean starting branch and Draft PR #1 | PASS | feature/public-booking-approval; PR remains draft |
| clasp installed/authenticated | PASS | 3.4.1; authorized profile; remote UAT read/push succeeds |
| UAT target source and deployment inventory inspected | PASS | Empty myFunction source, manifest, @HEAD only before source upload |
| Allowlisted source push to UAT | PASS | Five files; original remote source saved under ignored .local/ |
| Mocked server tests | PASS | 18 passed, 0 failed in the final run |
| Chrome rendered-page tests | PASS | 21 passed, 0 failed: seven scenarios x desktop/mobile/tablet |
| Dependency audit | PASS | npm install audit: zero vulnerabilities after Babel patch |
| Original photos | PASS | Exact embedded JPEG strings compared against starting revision |
| Real Google database setup and ID audit | PASS | Owner editor execution completed; prepareUat_ audits all configured IDs before testing |
| Google runtime smoke suite | PASS | Owner-supplied Google execution log: 7 checks passed; no mocks in that run |
| Live external email/OTP delivery | BLOCKED | Requires a reachable authorized test mailbox; requested from owner |
| Actual simultaneous Google executions | BLOCKED | Local tests cover deterministic competing approvals, locks and partial-write recovery only |
| Versioned web app and all three URLs | PASS | Version 1 deployed after owner setup/audit; links in PORTAL_DEPLOYMENT.md |
| Live anonymous API/browser checks | PASS | 25 checks passed, 0 failed; 7 actual API checks and render/viewport checks for 3 routes x 3 sizes |
| Live HtmlService screenshots | PASS | Actual Google-hosted portal, guest and display activation pages captured in test-results/live/ |
| Production shared-database integration | BLOCKED | Check_In_App frontend readable; external backend/IDs unverified |

## Executed test coverage

The Node VM harness executes production .gs source with mocked Sheets, Cache, Properties, Mail, Utilities and ScriptLock. Cases cover isolated initialization, fail-closed database configuration, login/logout, internal booking, unauthorized APIs, OTP validation/expiry/replay/attempt caps/quota, guest session expiry and isolation, pending/approved/rejected states, internal-account exclusion, role grant/revoke including ineligible accounts, conflicts, repeat/opposing decisions, injected partial-write recovery, formula-safe writes, date/time validation, recurring dates/conflicts/series cancellation, and display quick booking/read authentication. Competing approvals are deterministic sequential calls under a mock lock, not true parallel executions.

Playwright compiles the actual page JSX and Tailwind CSS locally with installed React 18.3.1, rendering in installed headless Chrome. Google RPC is bridged to the same mocked server; real browser actions cover sign-in/external navigation, OTP and submission, Approval Center, Manage Approvers, approval and grant/revoke, and display activation. These tests do not validate external CDN availability, Google's iframe, mobile Safari, touch behavior, or real Google services. Added final scenarios cover duration/end-time calculation and authenticated dashboard layout.

Screenshots are stored locally in ignored test-results/: desktop/mobile/tablet guest, admin, display, and dashboard PNGs. The guest, admin and repaired mobile dashboard screenshots were visually inspected. They contain synthetic data only. No screenshot is presented as a deployed UAT page.

## Fixes

Restored missing closing HTML/script tags; restored display quick-booking success response; respected CacheService TTL maximum; generated session tokens from UUIDs; tightened calendar/time validation; corrected count-one recurrence and monthly date anchoring; removed duplicate date parser and nested hardcoded-email diagnostic; used text-safe booking writes; gated verification when external booking is disabled; made approval retries idempotent and partial approval recovery safe against rejection; enabled revocation of now-ineligible approvers; bounded rejection reason size; serialized password reset confirmation; added HtmlService viewport metadata; fixed inclusive-start/exclusive-end room occupancy and mobile dashboard overflow; preserved original room names and image bytes.

## Remaining limits

Passwords retain the existing legacy SHA-256/cleartext migration scheme; this is not a replacement identity provider. Cache entries can be evicted early, requiring re-verification. OTP's durable global daily quota still bounds email volume, while its per-address cooldown is cache-based. Synthetic invalid mailboxes cannot prove deliverability. Recurring multi-row writes are serialized but not a spreadsheet transaction; a service failure can leave a partial series. Authorization, Sheets type behavior, Mail quotas and simultaneous writes require real runtime acceptance. Cross-project serialization is unresolved. No production deployment or data migration was performed.

Earlier iterations exposed missing closing script tags and mobile dashboard overflow, both repaired and covered by the final passing run. Two initial browser selectors were corrected to match accessible names. The final result supersedes those failed development iterations.

## Owner-confirmed Google runtime execution

The supplied log reports PASS for internal login using Sheets/CacheService, unauthorized approval access denial, booking write, booking conflict, booking cancellation, Room Display state and logout. The run used the configured isolated UAT spreadsheets. Email delivery, external OTP and concurrent executions were explicitly NOT_TESTED. This evidence is attributed to the owner-run Google log, separate from the agent-executed mocked and live web tests.

## Agent-executed deployed UAT checks

`node tools/uat-live-smoke.cjs` completed 25 real-service checks with 25 PASS and 0 FAIL. Seven API checks cover ping, anonymous approval/approver-management/direct-booking/display denial, guest submission denial and busy-time-only availability. Nine deployed pages (portal, guest, display activation across desktop/mobile/tablet) passed rendering and viewport checks, using actual Google RPC, HtmlService and external CDN resources. Actual screenshots are in test-results/live/; desktop guest was visually inspected. This run did not use mocked services or injected application data.

The owner authorized a reachable test mailbox. A live portalSendCode request returned ok=true; inbox receipt and verification are pending the owner-provided code. Authenticated API and concurrent-approval checks are prepared in tools/uat-auth-smoke.cjs and require the generated synthetic password in ignored .local/uat-secrets.json plus a verified guest session in ignored .local/uat-guest.json. Passwords and tokens must never be posted to the PR or committed.
