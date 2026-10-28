# JARVIS Companion — FitCloud / Health Connect bridge

This directory is the isolated Android-side bridge for JARVIS V5. It does not replace FitCloud Pro and does not touch the V3 production branch.

## First acceptance path

1. Read approved wellness metrics from Android Health Connect when available.
2. Preserve source + recorded timestamp for every measurement.
3. Pair the companion with the authenticated JARVIS V5 field-test server.
4. Upload only explicitly approved metrics over HTTPS.
5. Show source/freshness in the JARVIS Health instrument.
6. If FitCloud Pro does not publish a needed metric to Health Connect, add direct FitCloud SDK support as a second adapter.

## Initial read-only metric allowlist

- steps
- heart_rate
- sleep
- active_calories
- distance
- exercise
- oxygen_saturation
- hrv
- weight

No medical-record data is copied into this project. No FitCloud, bank, email, or other account password belongs in source code or JARVIS logs.

## Integration strategy

Preferred: `FitCloud watch -> FitCloud Pro -> Health Connect -> JARVIS Companion -> JARVIS V5 API`

Fallback for missing watch metrics: `FitCloud watch -> official FitCloudPro Android SDK -> JARVIS Companion -> JARVIS V5 API`

The direct FitCloud adapter must remain behind an interface so the server receives the same normalized metric envelope regardless of source.

## Normalized metric envelope

```json
{
  "metric": "steps",
  "value": 6842,
  "unit": "count",
  "recordedAt": "2026-10-28T18:00:00.000Z",
  "source": "health_connect",
  "device": "wearable"
}
```

## Safety / privacy

- Read-only health permissions in V1.
- Minimum necessary metric permissions.
- HTTPS only outside local development.
- No credentials or raw authorization tokens in logs.
- Server pairing token stored in Android secure storage, not source.
- User can disconnect the companion without disrupting FitCloud Pro.
- JARVIS displays CONNECTED only after a verified sync, and displays data freshness.

## Next implementation checkpoint

Build the Android Health Connect reader + pairing screen, then add the V5 wearable ingestion/status endpoints. Once that path is testable, publish the companion APK through a JARVIS-owned authenticated install page and perform the physical step-count acceptance test on the user's Samsung phone/watch.
