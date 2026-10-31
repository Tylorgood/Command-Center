# Cockpit world source contracts

Every world is a lens over canonical Brain state, never an independent truth store.

| World | Authoritative inputs | Functional output |
|---|---|---|
| Needs Your Decision | prepared decisions + interventions | NEW/SEEN/DECIDED queue, prepared work, options |
| Communications | Gmail/Yahoo/SMS evidence + conversations | real threads, waiting state, commitments |
| Career | communications + people/orgs + situations + calendar + documents | opportunities, interviews, follow-ups, decisions |
| Calendar | connected calendar events + commitments | real hard-time events and related context |
| Projects | canonical project entities + Drive/GitHub/files + situations | objective, people, files, blockers, decisions |
| Money | connected financial source when available + clearly labeled email-derived evidence | balances only from financial source; signals otherwise |
| Health | authorized Health/wearable snapshots | genuine latest timestamp/readings; never heartbeat-fabricated freshness |
| Location | authorized location snapshot | timestamped last known/current only when supported |
| Weather | weather lookup tied to supported location | timestamped conditions/forecast |
| Vehicles | verified vehicle entities/evidence | known vehicles and related situations; SOURCE_NEEDED otherwise |
| Home | verified home/order/commitment evidence | current home situations; UNKNOWN otherwise |
| Creative | project/files/communications evidence | current creative projects and commitments |
| Orders | communication/order evidence | current orders and delivery situations |
| Security | security signals with sensitive content redacted | actionable security situations |
| Library | evidence/entities/documents | searchable provenance-backed knowledge |
| Systems | GitHub/Render/database/integration health | code/deploy/source health and freshness |

All remaining cockpit instruments must derive from these same canonical domains or explicitly display UNKNOWN, STALE, NOT_CONNECTED, or SOURCE_NEEDED. No decorative seed state is considered live truth.
