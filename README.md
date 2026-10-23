# CareSignal

**Ring track** care system for the Amazon Developer Hackathon  
*(product name is CareSignal; this repository contains the web app and Vega TV
shell source.)*

**One-liner:** CareSignal turns Ring home events + care-receiver check-ins into an owned care action with escalation and an audit trail — **DoorSense** makes the doorbell accessible so the resident can respond or summon help without watching a camera all day.

## Why this maps the Ring track

| Devpost / Ring rule | How we meet it |
|---------------------|----------------|
| Repo must **call** Ring APIs / Playground | `/api/ring/*` → `api.amazonvision.com` with Playground token |
| Demo shows simulator **or** real device | Ring Developer Playground Sync + Instant doorbell |
| Caretaking + accessibility | Care pact escalation + DoorSense large-button / TTS |
| Kindle is not a track | Tablet = browser `/recipient` / `/doorsense` (not Kindle) |
| Fire TV / Vega TV | `/tv` in **Vega WebView** → VVD simulator or Stick (`tv-shell/`) |
| Alexa Custom Skill + MCP tools | Wired — `/alexa`, `/api/alexa`, `/api/mcp` |

Playground Package / Vehicle / Motion streams are valid simulators. Phone-cam is a **labeled stand-in**, never the Ring proof.

## Quick start

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the product website.
**Open app** leads to `/welcome`, with sign-in and a caregiver demo entry.
The website also links to DoorSense, the receiver, camera, voice, and audio tools.
Local settings and Ring Playground credentials belong in `web/.env.local`, which
is ignored by Git. See [`web/.env.example`](web/.env.example) for the safe
template.
For public deployments, configure the caregiver password and MCP bearer token
described in [`web/README.md`](web/README.md#public-deployment-security).

## Demo layout (3 devices)

| Device | Role | Open |
|--------|------|------|
| Phone via Cloudflare tunnel | Caregiver (shared household via `/api/household`) | `/today` |
| Mac / Cursor | Care receiver + door cam | `/doorsense` |
| Living-room TV (browser) | DoorSense overlay (remote + mic) | `/tv` |
| Echo / Alexa | DoorSense + check-in by voice | `/alexa` · skill → `/api/alexa` |
| Second browser | Doorbell speaker + mic | `/doorbell` |

## Judge path (30s + 3min)

**30s:** Ring ding → DoorSense “Tell my caregiver” → phone live assist → I’m on it.

**3min:**
1. Setup: Mom + on-duty caregiver + backup; escalation ~1 min  
2. **Ring Playground** Sync or Instant doorbell → event with **Source: Ring**  
3. **DoorSense:** spoken prompt → Tell my caregiver (Mac cam shares)  
4. **Caregiver:** alert + live A/V → **I’m on it** → playbook  
5. Second run: ignore → backup escalates → resolve with note  
6. Timeline shows Ring evidence — not invented visitor identity  

Optional: phone-cam green person (**labeled stand-in only**).

## Ring Playground (required)

1. [Ring Developer Playground](https://developer.amazon.com/ring/console/playground) → **Generate Token** (~30 min).  
2. In `web/.env.local`:
   ```bash
   RING_ACCESS_TOKEN=eyJ...
   NEXT_PUBLIC_PHONE_URL=https://your-tunnel.trycloudflare.com
   ```
3. Restart Next (`npm run dev`).  
4. **Today** → Ring Playground card → **Sync now**.  
5. Token expires ~30 min — refresh token, restart Next, re-Sync before recording video.

API routes (real Ring / Playground calls):

- `GET /api/ring/status` — devices  
- `POST /api/ring/sync` — history events  
- `POST /api/ring/push` — instant ding/motion (Ring-shaped)  
- `POST /api/ring/webhook` — webhook-shaped payloads  
- `POST /api/ring/stream` — WHEP live (token required)

## DoorSense

[http://localhost:3000/doorsense](http://localhost:3000/doorsense)

1. Instant doorbell (or Playground + Sync).  
2. Spoken announcement + large choices.  
3. **Tell my caregiver** / **I need help** → alert + live assist to phone.  
4. Doorbell tab (`/doorbell`) hears caregiver and sends visitor mic to Mom + caregiver.

Does **not** claim visitor identity or unlock the door.

### TV (living room)

**DoorSense TV** is the web UI at [`/tv`](http://localhost:3000/tv). For **Fire TV / Vega**, wrap that URL in a Vega WebView app and run it on the **Vega Virtual Device (simulator)** or a Stick — see [`tv-shell/README.md`](tv-shell/README.md). Silk browser still works as a fallback. While “watching,” DoorSense stays a quiet corner pill; on a ding, choices slide in for the remote (↑↓ · OK) or mic. Live camera share stays on tablet/Mac `/doorsense` when needed.

## Care loop (already built)

I’m okay · duty rota · quiet miss / night exit · playbooks · assign · escalate · resolve.

Plan & checklist: [`docs/CARESIGNAL_PLAN.md`](docs/CARESIGNAL_PLAN.md) · [`docs/CHECKLIST.md`](docs/CHECKLIST.md)

## Stack

Next.js 16 · TypeScript · Tailwind · localStorage household (demo) · in-memory door-live WebRTC signaling.

## Hackathon notes

- Primary track: **Ring**  
- Friction / product feedback: log during validation (Phase 6)  
- Cut for deadline: Bee, Fire TV app, face ID, YOLO Re-ID, second codebase  
