# Public booking and approval — staging checklist

This branch is not production-ready until acceptance tests pass. Keep the existing deployment unchanged. Use a separate Apps Script project and copies of all spreadsheets (including user and display data; use synthetic accounts), update sheet IDs in the test copy, and copy Code.gs and Index.html.

Script Properties:
- BOOKING_ADMIN_EMAILS: comma-separated existing active AllowedUsers with Users accounts.
- PUBLIC_BOOKING_ENABLED: true only in staging initially; absent/false disables external availability, OTP, submission and approval.

Deploy staging as a web app executing as the owner with the intended access setting. Authorize MailApp. Test from a signed-out browser. The normal URL includes External User entry; ?mode=guest opens guest directly; ?mode=display retains display route.

Acceptance tests (not yet run):
- Internal sign-in, password reset, daily/weekly/monthly view, recurring booking, cancellation, room display and quick booking.
- Exact three room labels and images; mobile Safari/Chrome, desktop, tablet; start/end/duration.
- Guest OTP incorrect, expired, replay, rate limit; anonymous users see only busy times; known internal emails cannot submit guest requests.
- Submit pending, verify My Requests isolation, reject with reason, approve once, approve conflict, email errors.
- Admin grant/revoke, regular user denied even by direct API, revoked approver denied.
- Verify request date/time columns round-trip, spreadsheet formula injection, concurrent approvals and retry after partial writes.
- Verify production Check_In_App backend and spreadsheet IDs. ScriptLock is scoped to one Apps Script project; it cannot prevent collisions with separate projects. Before enabling production guest booking, route all booking writes through one authoritative backend or implement equivalent shared transactional serialization.
- Review existing public Apps Script functions and repository spreadsheet identifiers; restrict spreadsheet permissions and move IDs to script properties in a separate migration.
- No booking-policy configuration or new business hour/duration limits in this phase.
- Guest cancellation is not implemented; OTP session is short-lived and requires re-verification after expiration.
- Daily OTP cap is an operational abuse-control default, not room policy. Review quota before rollout.

Do not deploy or merge until staging and cross-project integration are verified.
