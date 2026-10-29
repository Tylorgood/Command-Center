# JARVIS Push 6 — Step 7 Gate Ledger

Status values: `INSPECTED`, `BUILDING`, `DEPLOYED`, `HUMAN_VERIFY`, `VERIFIED`, `BLOCKED`.

Completion means live end-to-end behavior is verified. Code or deployment alone does not count.

| Workstream | Acceptance criteria | Status | Evidence / next action |
|---|---|---|---|
| 6A Dashboard truth + freshness | No capped list is presented as a total. Every headline metric declares scope/source/freshness and stale sources cannot look live. | BUILDING | Gmail recent scan currently caps display rows at 12 and scan at 20. Separate actual unread query + scoped signal counts required. |
| 6B Yahoo Mail | App-password authentication succeeds; forced status is HEALTHY; inbox returns real current messages; failure code is actionable without leaking secrets. | BUILDING | IMAP connector exists; field test reports auth failure. Add safe failure diagnostics, then human re-auth checkpoint. |
| 6C Health auto-sync | Companion automatically reads Health Connect and uploads without manual Sync; cockpit shows captured/received freshness; stale data is labeled stale. | BUILDING | Manual-only sync confirmed. Add Health Connect background permission + WorkManager; Android periodic floor applies. |
| 6D SMS bridge | Samsung grants explicit SMS read permission; Companion uploads bounded recent inbox read-only; JARVIS shows source/freshness; no send authority exists. | BUILDING | Cockpit socket exists but no backend/client ingestion. Build read-only bridge; human permission/install required for final verification. |
| 6E Plaid / Fifth Third | Secure Link/token flow exists; no bank password stored; sandbox passes; Fifth Third live data only after explicit consent and no unapproved spend. | INSPECTED | No Plaid code exists. Plaid Trial can provide limited real-data testing for eligible new US/CA teams; credentials/account consent are human-only gate. |
| 6F Cockpit functionality | Quick Actions work or truthfully unavailable; Working panel reflects real jobs; Black Box is backed by append-only records; all 25 panels have failure/freshness states. | INSPECTED | Existing capture/jobs/feedback/events can back actions/recorder; audit remaining UI wiring after connector batch. |
| 6G Regression + Step 7 gate | Automated tests pass; Render live; mobile/PWA restart/recovery tested; connector failure/recovery states truthful; 25 instruments pass acceptance. | BLOCKED | Runs after 6A–6F. Physical phone and external-account verification are expected human gates. |

## Engineering constraints

- Never mark a connector healthy from configuration alone.
- Never fabricate telemetry or totals.
- Never store or request normal Yahoo/bank passwords.
- SMS is read-only during Push 6; no autonomous personal messaging.
- No paid Plaid/other resources without explicit approval.
- Preserve `jarvis-v3-live`; Push 6 targets `jarvis-v4-field-test` only.
- Retry ordinary implementation/test/deploy failures without human intervention.
