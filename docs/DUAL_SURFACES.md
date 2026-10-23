# CareSignal — two surfaces

## Caregiver (phone / mobile web)
- **Home** `/today` — status, Mom’s logs today, alerts, door
- Alerts, Family, You (setup)
- Bottom shelf navigation

## Care receiver (Fire tablet / Echo Show browser)
- **Check-in** `/recipient` — large cards:
  - I’m okay
  - Medicine (tap when taken)
  - Walk (10 / 20 / 30 min)
- Same household data — caregiver sees it under **Today from Mom**

## Care receiver · TV (living room)
- **DoorSense overlay** `/tv` — full-bleed “watching” surface
- Quiet: corner pill (“listening”)
- Ding: side panel with large remote-selectable choices (↑↓ · OK) or remote mic speech
- Camera / talk-back still on tablet/Mac `/doorsense` when needed

## Device notes
| Device | Role |
|--------|------|
| **Fire tablet** (not e-ink Kindle) | Best for recipient cards in browser / kiosk |
| **Fire TV / smart TV browser** | Open `/tv` full-screen — DoorSense while watching |
| **Echo / Echo Show** | “Alexa, open Care Signal” → `/api/alexa` skill; or Silk `/recipient` / `/tv` |
| **Phone** | Caregiver app viewport |
| **Speaker-only Echo** | Skill voice only — check-in + DoorSense phrases |

E-ink Kindles are not a good fit (no good browser/touch for this).

## Camera + voice (demo)

| Feature | Where | Notes |
|---------|--------|--------|
| Live camera | Home → Door, Check-in → Camera | Phone/tablet `getUserMedia` as Ring stand-in |
| Spoken confirmations | Check-in actions | Browser TTS |
| Voice commands | Check-in → Tap to speak | “I’m okay”, “I took my medicine”, “I went for a walk” |

**Secure context:** Camera and mic need **HTTPS** or **localhost**.  
- Mac: `http://localhost:3000` works.  
- Phone on Wi‑Fi IP (`http://192.168…`) often **blocks** camera/mic — use a tunnel:

```bash
# example
npx localtunnel --port 3000
# or ngrok http 3000
```

Open the **https** URL on the phone, allow camera + mic.

## Hackathon
Ring track primary stays caregiver + door pact.  
Recipient tablet UI proves dignity + daily care logging without needing a physical Show.  
Phone cam is a labeled Ring stand-in. Alexa is wired via Custom Skill + MCP (`docs/ALEXA.md`).
