# CareSignal + DoorSense — full plan & checklist

**Product:** CareSignal (folder name may remain `porchlight`)  
**Track:** Ring — caretaking + accessibility  
**Deadline:** Oct 23, 2026 @ 12:00pm PDT  
**Rule:** Extend the existing app. Do **not** start over.

**One-liner for judges:** CareSignal turns Ring home events + care-receiver check-ins into an owned care action with escalation and an audit trail — DoorSense makes the doorbell accessible so the resident can respond or summon help without watching a camera all day.

---

## Architecture

```
Ring Playground / device
  → Token + sync / push / webhook
  → Normalize → care events
  → Deterministic engine (engine.ts / store)
  → DoorSense (resident UI + TTS + optional live cam)
  → Caregiver Today / Alerts + live assist
  → Escalation (deterministic)
  → Audit timeline

Optional later: Alexa+ Private Preview OAuth polish, day-digest LLM  
Wired now: Alexa Custom Skill + MCP tools + `/alexa` simulator
```

**Hard rule:** Deadlines, who to call, escalation, permissions, audit = **deterministic code**. AI only for summaries / spoken prompts / copy — never “they’re safe” or “call X.”

**Demo device layout (current):**


| Device         | Role                        | URL          |
| -------------- | --------------------------- | ------------ |
| Phone (tunnel) | Caregiver                   | `/today`     |
| Mac / Cursor   | Care receiver + door cam    | `/doorsense` |
| Living-room TV | DoorSense overlay · Vega WebView / VVD or Silk | `/tv` + `tv-shell/` |
| Echo / Alexa   | DoorSense + check-in by voice | `/alexa` → `/api/alexa` |
| Other browser  | Doorbell speaker + door mic | `/doorbell`  |


---



## Phase overview


| Phase  | Focus                           | Status             |
| ------ | ------------------------------- | ------------------ |
| **0**  | Rebrand + story                 | Done               |
| **1**  | Live Ring integration           | Done               |
| **2**  | DoorSense MVP                   | Done               |
| **2b** | Live door assist (today)        | Done               |
| **3**  | Tighten care loop               | Mostly done         |
| **4**  | Care receiver cards (selective) | Todo / selective   |
| **5**  | Thin agents                     | Todo / optional    |
| **6**  | Ship package                    | In progress        |


---



# Phase 0 — Rebrand + story

**Goal:** Judges see CareSignal + DoorSense, not a generic dashboard.

### Checklist

- [x] Rename UX copy Porchlight → **CareSignal** (Today, recipient, README, meta, speech)
- [x] One-liner on Today + README (accountability loop + DoorSense)
- [x] Enter chooser: caregiver / DoorSense / TV / doorbell
- [x] `/tv` DoorSense overlay (side panel + remote while “watching”)
- [x] Devpost / README track notes match Ring rules
- [x] Keep repo name `porchlight` if needed (optional rename later)

---



# Phase 1 — Live Ring integration (must ship for track)

**Goal:** Repo **actually calls** Ring APIs; video shows Playground → CareSignal.

### Checklist

- [x] Playground token in `.env.local` (`RING_ACCESS_TOKEN`)
- [x] Device list / status (`/api/ring/status`)
- [x] Event sync (`/api/ring/sync`) — button_press, motion, etc.
- [x] Instant push path (`/api/ring/push`) for demo lag
- [x] Optional WHEP stream route (`/api/ring/stream`)
- [x] Map into existing ingest / DoorSense / alerts
- [x] UI labels: **Source: Ring Playground** vs **phone cam stand-in**
- [ ] Prove in **recorded** video: Playground → alert → ack → escalate → resolve
- [ ] Token refresh documented (≈30 min expiry)

**Keep injectors as backup only — not the Ring proof.**

---



# Phase 2 — DoorSense MVP (accessibility)

**Goal:** Doorbell/motion → accessible resident choice → caregiver follow-through.

### Checklist

- [x] `/doorsense` resident surface
- [x] Spoken announcement on ding
- [x] Large actions: expecting / tell caregiver / need help / dismiss
- [x] Wire tell caregiver / need help → alert + live assist flag
- [x] Accessibility: large targets, high contrast, TTS
- [ ] Optional: schedule-only “who might this be” (visit window) — **no face ID**
- [ ] Visual pulse if resident may not hear chime (polish)

**Do not:** auto-unlock, invent visitor identity, treat silence as “all fine.”

---



# Phase 2b — Live door assist (built in session)

**Goal:** Demo “caregiver sees/hears door; talks to Mom + visitor.”

### Checklist

- [x] Doorbell sim → Mac camera opens + DoorSense choices
- [x] Tell caregiver → WebRTC Mac cam+mic → phone
- [x] Caregiver talk-back → DoorSense speakers
- [x] `/doorbell` page (separate browser) — audio only, no video
- [x] Caregiver talk-back → doorbell speakers
- [x] Doorbell mic → caregiver
- [x] Doorbell mic → care receiver (Mom)
- [x] Leave / Rejoin (video + audio restored on rejoin)
- [x] DoorSense: caregiver volume, doorbell volume, mute local mic
- [x] Doorbell: speaker volume, mute door mic, level meters
- [ ] Stable tunnel URL for phone (named Cloudflare) — quick tunnel OK if URL updated
- [ ] Connection status copy polish (connected / reconnecting)

---



# Phase 3 — Tighten the care loop

**Goal:** Story beats judges remember: accept → escalate → audit.

### Checklist

- [x] **Accept responsibility** beat obvious (“I’m on it — I accept”)
- [x] Coverage gap banner (open alerts awaiting accept)
- [x] Expected visit window vs unexpected doorbell (schedule hint; no face ID)
- [x] Cap / coalesce alerts (45s coalesce + max 3 open door alerts)
- [x] Shared household state Mac + phone (server) — `/api/household` poll + push
- [x] Alert copy: unexpected doorbell / visit window — not “stranger at door”

---



# Phase 4 — Care receiver cards (selective)

**Add now**

- [x] How am I feeling?
- [x] Someone is coming (schedule)
- [x] I need help (reinforce existing)
- [x] I need a break (if not covered by dismiss)

**Defer**

- [ ] Full today’s-plan designer
- [ ] Transport logistics / outing GPS
- [ ] PSTN “call my family”

---



# Phase 5 — Agents (thin)

**Named roles as code modules — not six LLMs.**

### Checklist

- [x] **Home Context** — Ring + check-ins → clear timeline lines (rules) · `lib/agents/home-context.ts`
- [x] **Escalation** — deterministic workflow; rename/clarify in UI · `lib/agents/escalation.ts`
- [x] **Care Summary** — template day digest (`/summary`) · skip Bedrock for now
- [x] **Medication agent** — due / overdue / taken rules · Mom cards + caregiver Today
- [x] Skip “diagnose” / “who is safe” AI
- [x] Skip Bedrock (template digest only)

---



# Phase 6 — Ship package

**Goal:** Submit-ready video, README, friction log, visible Ring calls.

### Checklist

- [ ] ≤3 min video: problem → Ring → DoorSense → live assist → ack → escalate → resolve
- [x] README judge script (30s + 3min) + 3-device layout
- [x] Friction / product feedback log (Ring Playground + APIs) — `docs/FRICTION_LOG.md`
- [x] Repo shows real Ring imports/calls; license + collaborators
- [x] HTTPS tunnel during demo (`NEXT_PUBLIC_PHONE_URL` set; restart cloudflared if URL rotates)
- [ ] Optional: AWS Builder only if summary already in
- [x] Fire TV / Vega = `/tv` in Vega WebView (`tv-shell/`) → VVD simulator or device (not a full native rewrite)



### Judge must-see script

1. Setup: Mom + Alex on duty, Sam backup, escalation ~1 min
2. Ring: Playground doorbell/motion → CareSignal (**Source: Ring**)
3. DoorSense: spoken prompt → **Tell my caregiver** (+ live share)
4. Caregiver: alert → live assist → **I’m on it** → playbook
5. Second run: ignore → Sam backup → resolve with note
6. Timeline: Ring evidence ≠ invented identity

Optional: phone-cam green person (labeled stand-in only).

---



# Explicitly cut for Oct 23

- [x] ~~Bee wearable~~ — skip  
- [x] ~~Full Fire TV native rewrite~~ — skip (Vega WebView + `/tv` on VVD / Stick)
- [x] ~~YOLO / OSNet Re-ID~~ — skip  
- [x] ~~Face recognition / auto unlock~~ — skip  
- [x] ~~“Person left home” from motion alone~~ — skip  
- [x] ~~Edit all playbooks / invite arbitrary members~~ — seed family OK  
- [x] ~~Second CareSignal codebase~~ — skip  
- [x] ~~Phone-cam as Ring proof~~ — stand-in only  

---



# Recommended build order (remaining days)

1. **Phase 6** — tunnel + video + friction log (README judge path done in Phase 0)  
2. **Phase 3** — accept beat + visit window + coalesce  
3. **Phase 4** — only cards that appear in the video  
4. **Phase 5** — only if time / AWS mini  

---



# Risk register


| Risk                    | Mitigation                                        |
| ----------------------- | ------------------------------------------------- |
| No Ring calls in repo   | Phase 1 done — keep Sync on camera in video       |
| 30-min Playground token | Script refresh; record early                      |
| Tunnel URL churn        | Named Cloudflare tunnel                           |
| Over-claiming identity  | Schedule hints only; no face claims               |
| Mac/phone state split   | Demo via same tunnel origin; server store if time |
| Scope creep             | One loop + DoorSense + Ring + live assist         |


---



# Mapping: brief → code


| Concept              | Code today                                  | Action             |
| -------------------- | ------------------------------------------- | ------------------ |
| CareSignal caregiver | `/today`, alerts, family, setup             | Finish rebrand     |
| Care receiver        | `/recipient`, `/doorsense`, `/tv`           | Selective cards    |
| Ring                 | `/api/ring/*`, RingBridge                   | Keep in every demo |
| Escalation           | store + escalation UI                       | Sharpen “accept”   |
| DoorSense            | `/doorsense`, `/tv`                         | Done               |
| Live assist          | CaregiverDoorAssist, `/doorbell`, door-live | Stabilize tunnel   |
| Phone cam            | `/cam`                                      | Optional labeled B |


---

*Living checklist also mirrored in condensed form:* `[CHECKLIST.md](./CHECKLIST.md)`*.*