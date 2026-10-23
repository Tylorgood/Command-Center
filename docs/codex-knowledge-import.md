# JARVIS Codex Local Knowledge Import Contract

JARVIS V4.2 accepts normalized local-computer knowledge at:

`POST /api/knowledge/import`

Authentication: existing JARVIS authenticated session.

Always dry-run first.

```json
{
  "sourceName": "codex-local-scan",
  "dryRun": true,
  "records": []
}
```

Maximum batch: 500 records and the server request body limit.

## Sensitivity

Allowed labels: `PUBLIC`, `NORMAL`, `PRIVATE`, `SENSITIVE`, `SECRET`.

- `PUBLIC` and `NORMAL`: eligible for automatic import after validation.
- `PRIVATE` and `SENSITIVE`: never auto-promoted; queued for JARVIS human review.
- `SECRET`: rejected. Do not send passwords, tokens, cookies, private keys, wallet secrets, verification codes, or credential content.

## Provenance

Every record should include a source block when possible:

```json
{
  "source": {
    "path": "C:\\Users\\...\\file.docx",
    "fileName": "file.docx",
    "fileHash": "sha256...",
    "modifiedAt": "2026-10-23T12:00:00Z"
  }
}
```

JARVIS stores local imports with `source_type=codex_local`. Local Google Drive content must remain labeled as local provenance; never claim the Google Drive API read file content when it only supplied metadata.

## Entity

```json
{
  "recordType": "entity",
  "sensitivity": "NORMAL",
  "confidence": 0.95,
  "entity": {
    "type": "software",
    "name": "Mastercam",
    "data": {"category": "CAM"}
  },
  "source": {}
}
```

## Fact

```json
{
  "recordType": "fact",
  "sensitivity": "NORMAL",
  "confidence": 0.96,
  "entity": {"type": "person", "name": "Tylor"},
  "factKey": "uses_software",
  "factValue": "Mastercam",
  "source": {}
}
```

## Relationship

```json
{
  "recordType": "relationship",
  "sensitivity": "NORMAL",
  "confidence": 0.9,
  "from": {"type": "document", "name": "Resume 2026"},
  "to": {"type": "project", "name": "Career"},
  "relationshipType": "related_to_project",
  "source": {}
}
```

## Document

```json
{
  "recordType": "document",
  "sensitivity": "NORMAL",
  "confidence": 0.95,
  "document": {
    "name": "Router Tooling Notes.docx",
    "contentStatus": "LOCAL_CONTENT_INDEXED"
  },
  "source": {}
}
```

## Event

```json
{
  "recordType": "event",
  "sensitivity": "NORMAL",
  "confidence": 0.85,
  "event": {
    "id": "optional-stable-id",
    "title": "Project milestone",
    "date": "2026-06-01"
  },
  "source": {}
}
```

## Required workflow

1. Inventory and normalize locally.
2. Exclude secrets locally before network transfer.
3. Send a dry-run batch with `dryRun:true`.
4. Inspect `accepted`, `rejected`, `queued`, and validation errors.
5. Correct malformed records locally.
6. Send the approved batch with `dryRun:false`.
7. Query `/api/brain/insights`, `/api/library/summary`, or `/api/knowledge/search` to verify the import.

Never send raw arbitrary disk dumps to this endpoint. Send normalized knowledge records only.
