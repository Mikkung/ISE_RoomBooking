# M4 UAT deployment and rollback

Status on 2026-11-27 (Asia/Bangkok): source uploaded to the user-designated UAT project. Web-app deployment is blocked on Google runtime authorization and database verification. M4 is not complete. Production and Check_In_App were not changed; main was not merged.

## Required owner action

Open the supplied UAT Apps Script project, select `UatSetup.gs`, select `prepareUat_`, and click Run. Complete Google's authorization consent. This private function is deliberately unavailable to browser RPC and the API router. It creates three **new** spreadsheets with synthetic accounts, sets Script Properties, audits all configured IDs, and runs a limited Google-service smoke test. It does not copy or open any of the old production databases. Send back the redacted execution log or error, never credentials.

The editor is https://script.google.com/home/projects/1uf9A-IBz9OqJ6mux5dnkVyIPeXIKECvEZ5U1S6gwZSXu1pfsOsn61CAD/edit . Clasp push works, but `clasp run initializeUat_` returned "Unable to run script function. Please make sure you have permission to run the script function." Installing/authenticating clasp alone does not establish remote execution permissions. See Google's [execution API requirements](https://developers.google.com/apps-script/api/how-tos/execute).

`prepareUat_` uses actual Sheets, CacheService and LockService only when run in Google. Its local harness test is mocked and is not proof of Google runtime success. Its report leaves email delivery, external OTP and simultaneous executions explicitly NOT_TESTED. Synthetic `.invalid` mailboxes cannot receive real mail; an authorized reachable test mailbox is still needed for delivery UAT.

## Environment isolation

- `.clasp.json` is local and ignored. It targets only the supplied UAT Script ID. `.claspignore` uploads exactly Code.gs, Environment.gs, UatSetup.gs, Index.html and appsscript.json.
- Before upload, the target source contained only an empty myFunction and its V8 manifest. Deployment inventory contained only @HEAD. Original remote source is backed up locally under ignored `.local/uat-remote/`.
- `APP_ENV` must be UAT or PRODUCTION. Missing configuration fails closed. UAT requires its Script ID to match `UAT_SCRIPT_ID` and every configured database to belong to `UAT_DATABASE_IDS`.
- The initializer creates new ROOM, USER and DISPLAY spreadsheets. ALLOWLIST shares the new USER database. Tabs and existing column names remain compatible. Database IDs, passwords and device tokens remain only in Script Properties or synthetic UAT sheets.
- `BOOKING_ADMIN_EMAILS`, `PUBLIC_BOOKING_ENABLED`, `ROOM_SHEET_ID`, `USER_SHEET_ID`, `ALLOWLIST_SHEET_ID`, and `DISPLAY_SHEET_ID` are Script Properties. ALLOWLIST defaults to USER for schema compatibility. UAT setup refuses to adopt existing unreviewed IDs.
- Production has no automatic legacy-ID fallback. Before any future approved production upgrade, its owner must transfer its existing IDs into Script Properties and set APP_ENV=PRODUCTION. This migration was intentionally not performed. Never point the local clasp configuration at production.
- Synthetic logins: admin@ise-uat.example.invalid, approver@ise-uat.example.invalid, internal@ise-uat.example.invalid. The generated password is stored privately as UAT_TEST_PASSWORD. External account identity is external@ise-uat.example.invalid and is established through OTP, not a Users row. Display device token is in the synthetic RoomDisplayDevices tab. Never put these secrets in commits, logs, screenshots or PR comments.

## Deploy after authorization and verification

1. Review the prepareUat_ execution report, then run `auditUat_` in the editor. Verify APP_ENV=UAT, the expected Script ID, and the new spreadsheet titles beginning `ISE RoomBooking UAT synthetic `. Confirm all four configured IDs are in the generated registry; do not substitute old IDs.
2. Run `npm ci`, `npm test`, and `npm run test:e2e` (requires installed Chrome). Inspect rendered screenshots in ignored test-results/. These use mocked Google services.
3. `clasp -P <absolute-path-to-local-.clasp.json> show-file-status` must list only the five files above. Push with `clasp -P <absolute-path-to-local-.clasp.json> push --force`. --force confirms manifest replacement; it does not authorize changing environments.
4. Record the current version/deployment inventory. Create a UAT version and deployment using `clasp create-version` and `clasp create-deployment`, or the editor's New deployment -> Web app. Use execute as deployer and anonymous access for the guest portal. Authorize required Sheets/Mail scopes. Do not deploy while the database audit is unverified.
5. Copy the **actual returned** Web App /exec URL. Portal is that URL; external portal appends `?mode=guest`; display appends `?mode=display`. Supply its synthetic token through the display activation UI rather than sharing a token-bearing URL. No usable URLs are claimed until deployment succeeds.
6. Execute live ping and unauthorized API tests, internal login/direct booking/conflict/cancellation, external OTP with an approved real test mailbox, submit/reject/approve, approver grant/revoke, recurring booking, and display quick booking. Test separate simultaneous executions; local serialized retry tests do not prove runtime concurrency. Verify the live HtmlService iframe on desktop/mobile/tablet, including external CDN loading and consent/access settings.

## Rollback

For a future versioned UAT deployment, record its deployment ID and prior version before updating. Use `clasp update-deployment <UAT_DEPLOYMENT_ID> --versionNumber <PREVIOUS_VERSION>` to restore the same URL (check installed CLI help for options). Set PUBLIC_BOOKING_ENABLED=false to stop new guest availability/OTP/submission/approval. Preserve UAT sheets for investigation; do not delete or overwrite booking records. No earlier numbered web deployment exists in this session, so initial rollback is to disable the newly created UAT deployment if necessary. The original empty source backup is local; restoring that source alone does not roll back a versioned deployment.

## Cross-system integration

Read-only source review of [Check_In_App](https://github.com/Mikkung/Check_In_App/tree/b2cb0dadd43eb9a907fc4b90b8de956f81d3243a) found a frontend configured for a different Apps Script /exec endpoint. It calls fetchRoomBookings and bookRoom; bookRoom sends email/device_id, whereas this portal requires its own session_token. Its [README](https://github.com/Mikkung/Check_In_App/blob/b2cb0dadd43eb9a907fc4b90b8de956f81d3243a/README.md) says spreadsheet IDs are controlled by an external Apps Script backend. Backend source and live database IDs were not available in that repository, and no production endpoint was called.

Whether production databases are shared remains unverified. If two projects write the same booking sheet, their ScriptLocks are independent and can both pass conflict checks before inserting overlapping rows. Approval's deterministic ID protects same-request retries within this backend, not cross-project booking transactions. A future approved integration must route all booking writes through a single authoritative backend or transactional store. Do not enable production guest booking until that is resolved. No booking policy configuration was introduced.
