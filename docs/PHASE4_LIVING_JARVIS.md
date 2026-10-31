# Phase 4 — Living JARVIS

## Runtime contract
Every ten minutes JARVIS refreshes available source views, records freshness without inventing data, fingerprints source state, writes changes to the append-oriented Black Box, reconciles cockpit state into context/situations, and prepares bounded decisions for unresolved situations.

## Truth rules
- A heartbeat timestamp is not a source-data timestamp.
- Missing or disconnected sources remain UNKNOWN/SOURCE_NEEDED.
- Health/location/weather data are never marked fresh merely because a heartbeat ran.
- External or consequential actions remain subject to Phase 3 authority policy.
- Repeated approval does not self-grant authority; delegation requires an explicit grant.

## Decision queue
Heartbeat-created interventions are NEW and include five paths where appropriate: recommended action, edit/alternative, back burner, tomorrow, do nothing. They reference the canonical Phase 3 decision and situation rather than duplicating world state.

## Black Box
Records heartbeat start/completion/failure, source changes, reconciliation failures, and prepared decisions with code version and hashes. GitHub remains authoritative code history; Black Box is operational/cognitive history.

## Cockpit rule
A panel is functional only when it renders authoritative Brain/source state or explicitly reports UNKNOWN/STALE/SOURCE_NEEDED. Decorative seed state is not accepted as live truth.

## Acceptance
1. Heartbeat runs without a user prompt.
2. Duplicate overlapping cycles are locked out.
3. Source freshness is timestamped and failures isolated.
4. New source state is recorded in Black Box.
5. Affected context/situations are reconciled.
6. Prepared decisions retain Phase 3 approval boundaries.
7. Needs Your Decision can consume NEW interventions with multiple choices.
8. Code version is recorded with operational history.
9. Existing Phase 1–3 tests continue to pass.
10. Production deployment produces successful heartbeat and Black Box records.
