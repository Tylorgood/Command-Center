# Black Box event vocabulary

Current Phase 4 runtime emits: HEARTBEAT_STARTED, SOURCE_CHANGED, CONTEXT_RECONCILE_FAILED, DECISION_PREPARED, DECISION_PREPARE_FAILED, HEARTBEAT_COMPLETED, HEARTBEAT_FAILED.

Existing Phase 1–3 evidence, reasoning, authority, outcome and learning tables remain authoritative detail stores. Black Box events reference their identifiers and code version rather than duplicating sensitive source content. This preserves provenance while limiting unnecessary duplication.
