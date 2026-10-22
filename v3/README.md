# JARVIS V3 — Life in Motion

JARVIS V3 is the living daily-life cockpit for Tylor's Personal Operating System.

## Product rule

The interface answers, in order:

1. What is happening now?
2. What genuinely needs Tylor?
3. What is JARVIS handling?
4. What hard-time commitments shape today?
5. Which life missions are active?
6. What meaningful state changed?

## Architecture

`state.json` is a sanitized presentation contract, not a raw data lake. The UI renders from that contract through `app.js`.

Connected services (Gmail, Calendar, Drive, Finances, GitHub, Render, ChatGPT) may inform JARVIS state, but raw private records must not be committed to this public repository.

### Safe to commit
- Mission names and high-level status when not sensitive
- Sanitized event summaries
- UI code
- Integration health labels
- Non-sensitive daily state

### Never commit here
- Email bodies or private correspondence
- Bank account numbers, balances, transaction IDs, raw transactions
- Tokens, API keys, cookies or credentials
- Private document contents
- Sensitive personal identifiers

## Motion language

Motion carries meaning:

- Ambient drift = system alive
- Directional signal = state/information moving
- Pulse = active processing or attention
- Gold = human/Tylor focus
- Cyan/violet = JARVIS/intelligence
- Green = healthy/connected/completed
- Amber/red = waiting or exception only

The motion system is inspired by patterns proven in FreeCNC, but V3 has its own visual identity.

## Development

Current branch: `jarvis-v3-live`

The previous `jarvis-v2` branch is preserved as historical reference.
