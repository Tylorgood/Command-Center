# JARVIS Brain Phase 1 — Evidence, Identity, Truth

Phase 1 implements the foundational truth layer described by Jarvis Brain Update.

## Delivered
- Immutable connector evidence store with source record deduplication.
- Canonical entities separated from identifiers and aliases.
- Normalized email and E.164-style phone identifiers.
- Identity matching thresholds: AUTO_MERGE >= 0.95, LIKELY_MATCH >= 0.75, POSSIBLE_MATCH >= 0.40.
- Identity candidates and explicit user decisions.
- Truth classes: USER_CONFIRMED, SOURCE_VERIFIED, STRONG_INFERENCE, WEAK_INFERENCE, UNKNOWN, CONTRADICTED, STALE.
- Durable claims linked to supporting evidence.
- User correction supersession without deleting historical claims.
- Gmail, Yahoo, Drive evidence ingestion and generic SMS/message evidence API.
- Authenticated evidence, identity and truth APIs.
- Unit and PostgreSQL integration acceptance tests.

## Safety
Evidence is append-only through the application interface. Existing Library tables are extended, not destructively replaced. No connector credentials are exposed through the new APIs.
