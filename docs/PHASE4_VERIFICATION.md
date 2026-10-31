# Phase 4 verification matrix

- [x] Additive production schema created and RLS verified for heartbeat, Black Box, cursors, interventions, delegations.
- [x] Heartbeat code uses advisory lock to prevent overlap.
- [x] Source state fingerprinting and freshness metadata implemented.
- [x] Black Box records heartbeat/source/decision lifecycle with deployed Git commit.
- [x] Context reconciliation invokes existing Phase 2 cockpit reconciliation.
- [x] Decision preparation invokes existing Phase 3 authority-bounded engine.
- [x] Five conversational paths represented in interventions.
- [x] Existing Phase 3 prepared decisions backfilled into interventions without executing them.
- [x] Ten-minute autonomous runtime scheduled from production boot path.
- [x] Intervention queue syncs into existing cockpit decision state.
- [x] CI syntax and contract tests added.
- [ ] GitHub CI green on PR.
- [ ] Production deploy green.
- [ ] First production heartbeat COMPLETE.
- [ ] Black Box heartbeat lifecycle verified in production.
- [ ] Source cursor rows verified in production.
- [ ] Cockpit receives heartbeat decisions after runtime sync.

The unchecked items are deployment gates and must be verified before Phase 4 is declared complete.
