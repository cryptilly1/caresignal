# CareSignal + DoorSense — checklist

**Track:** Ring (caretaking + accessibility)  
**Deadline:** Oct 23, 2026 @ 12:00pm PDT  
**Core:** Keep this codebase · product name CareSignal · do **not** start over.

**Judge one-liner:** CareSignal turns Ring home events + care-receiver check-ins into an owned care action with escalation and an audit trail — DoorSense makes the doorbell accessible so the resident can respond or summon help without watching a camera all day.

---

## Done (keep — don’t rebuild)

### Care loop (CareSignal core)
- [x] Care pact, duty rota, backup
- [x] Check-in / meds / walk (`/recipient`)
- [x] Alerts, playbooks, assign, handoff, resolve
- [x] Auto-escalation to backup
- [x] Demo injectors (`/demo`)
- [x] Caregiver Today + Alerts + Family + You

### Phase 1 — Ring (must for track)
- [x] Playground token → `/api/ring/*` (devices, sync, push, stream)
- [x] Ingest `button_press` / motion into care pipeline
- [x] UI source labels (Ring Playground vs phone cam stand-in)
- [x] Instant doorbell path for zero-lag demo

### Phase 2 — DoorSense MVP
- [x] `/doorsense` large actions + TTS
- [x] Ring ding / Instant → resident prompt
- [x] Expecting / Tell caregiver / Need help / Dismiss
- [x] Tell caregiver / Need help → caregiver alert (+ live assist)

### Phase 0 — Rebrand + story
- [x] CareSignal UX copy (Today, recipient, meta, phone-cam, LICENSE)
- [x] One-liner on Today + README
- [x] README Ring / Devpost track notes + judge path
- [x] Enter chooser (caregiver / DoorSense / TV / doorbell)
- [x] **TV DoorSense** (`/tv`) — side overlay + remote-friendly choices while “watching”

### Today’s demo layout (live assist — beyond original plan)
- [x] Role split: phone = caregiver · Mac = DoorSense · `/tv` = TV overlay · `/doorbell` = door speaker
- [x] Doorbell sim → Mac camera opens + choices
- [x] Tell caregiver → WebRTC video+audio to phone
- [x] Caregiver talk-back → Mom **and** doorbell
- [x] Doorbell mic → caregiver **and** Mom
- [x] Leave / Rejoin; speaker + mic mute controls for isolation tests
- [x] Enter chooser for caregiver / DoorSense / doorbell

---

## Do next (priority order · cut hard for Oct 23)

### A — Ship / judge package (highest leverage)
- [x] **HTTPS tunnel live** — `NEXT_PUBLIC_PHONE_URL` (quick tunnel; named optional)
- [ ] **Judge video script dry-run** (≤3 min): Ring Playground event → DoorSense → Tell caregiver → live A/V → I’m on it → (2nd run) escalate → resolve
- [x] **README judge path** — 30s + 3min; 3-device layout URLs; token refresh note
- [x] **Friction / feedback log** — `docs/FRICTION_LOG.md`
- [ ] **Record demo video early** (token expires ~30 min — script refresh)

### C — Phase 3 tighten (only story beats)
- [x] Make **I’m on it / Accept responsibility** the obvious demo beat
- [x] Coverage gap banner (no one on duty / primary didn’t accept)
- [x] Expected visit window vs unexpected doorbell (schedule hint only — no face ID)
- [x] Cap/coalesce alerts so demo doesn’t explode
- [x] Shared household state Mac+phone (server) — `/api/household`

### D — Phase 4 cards (selective)
- [x] How am I feeling?
- [x] Someone is coming (schedule card)
- [x] I need a break
- [x] I need help (tablet → caregiver alert + DoorSense link)
- [ ] Defer: full plan designer, transport GPS, PSTN call family

### E — Phase 5 thin agents (optional)
- [x] Home Context: Ring + Mom cards timeline (`HomeContextTimeline` on Today)
- [x] Escalation: rename/clarify (keep deterministic) · Alerts inbox copy
- [x] Care Summary: template day digest `/summary` (+ card on Today)
- [x] Medication agent: due/overdue/taken · Mom + caregiver Today
- [x] Skip: diagnose, multi-LLM swarm, Bedrock

### F — Nice-to-have integrations
- [x] Ring token paste/refresh without full server restart (`/setup` + `/api/ring/token`)
- [ ] Fire tablet kiosk polish for `/recipient`
- [x] Alexa listens — Custom Skill `/api/alexa` + MCP `/api/mcp` + simulator `/alexa`

---

## Explicitly cut for Oct 23

- [ ] ~~Bee wearable~~
- [ ] ~~Full Fire TV native app~~
- [ ] ~~YOLO / OSNet Re-ID service~~
- [ ] ~~Face recognition / auto unlock~~
- [ ] ~~Claim “person left home” from motion alone~~
- [ ] ~~Edit every playbook / invite arbitrary members~~ (seed family OK)
- [ ] ~~Second CareSignal codebase~~
- [ ] ~~Phone-cam as Ring proof~~ (stand-in only, labeled)

---

## Judge must-see script

1. Setup: Mom + Alex on duty, Sam backup, escalation ~1 min  
2. Ring: Playground doorbell/motion → CareSignal with **Source: Ring**  
3. DoorSense: spoken prompt → **Tell my caregiver** (+ live cam share)  
4. Caregiver phone: alert → live assist → **I’m on it** → playbook  
5. Second run: ignore → backup Sam → resolve with note  
6. Timeline: Ring evidence ≠ invented visitor identity  

Optional: phone-cam green person (labeled stand-in), never instead of Ring.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| No Ring calls in repo | Phase 1 done — keep Sync visible in video |
| 30-min Playground token | Script refresh; record video early |
| Tunnel URL churn | Named Cloudflare tunnel |
| Over-claiming identity | Copy: doorbell/motion + schedule hints only |
| Mac/phone localStorage split | Same origin via tunnel; server household if time |
| Scope creep | One loop + DoorSense + Ring proof + live assist |

---

## Mapping (brief → code)

| Concept | Status | Where |
|---------|--------|--------|
| CareSignal caregiver | Done · polish brand | `/today`, alerts, family, setup |
| Care receiver tablet | Done · selective cards | `/recipient`, `/doorsense` |
| Care receiver TV | Done · side overlay + remote | `/tv` |
| Care receiver Alexa | Done · skill + MCP + simulator | `/alexa`, `/api/alexa`, `/api/mcp` |
| Ring connected home | Done · keep Sync in demo | `/api/ring/*`, RingBridge |
| Escalation | Done · sharpen “accept” | store + escalation |
| DoorSense | Done · live assist add-on | `/doorsense`, `/tv`, `/doorbell`, CaregiverDoorAssist |
| Phone cam | Optional demo B | `/cam`, phone-cam.html |
