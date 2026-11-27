# M4 execution report - 2026-11-27

M4 remains blocked on Google runtime authorization, database initialization/audit and versioned web-app deployment. No production data was accessed.

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
| Real Google database setup and ID audit | BLOCKED | Google denies clasp remote function execution |
| Google runtime smoke suite | BLOCKED | prepareUat_ is uploaded; requires owner editor run/consent |
| Live external email/OTP delivery | BLOCKED | Requires authorized runtime and reachable authorized test mailbox |
| Actual simultaneous Google executions | BLOCKED | Local tests cover deterministic competing approvals, locks and partial-write recovery only |
| Versioned web app and all three URLs | BLOCKED | Intentionally withheld until configured database IDs are verified UAT |
| Live HtmlService screenshots | BLOCKED | Local screenshots render real UI with mocked Google services |
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
