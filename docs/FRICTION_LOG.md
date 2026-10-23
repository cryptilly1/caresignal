# CareSignal — friction & product feedback log

Hackathon validation notes (Ring Playground + CareSignal UX).  
Fill during rehearsals; paste highlights into Devpost if asked.

## How to use

One row per friction. Severity: **blocker** / **annoying** / **niggle**.

| # | When | Where | What happened | Severity | Workaround / fix |
|---|------|-------|---------------|----------|------------------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

## Known demo friction (seeded from build)

| # | When | Where | What happened | Severity | Workaround / fix |
|---|------|-------|---------------|----------|------------------|
| 1 | Anytime | Phone tunnel | Quick tunnel URL rotates when cloudflared restarts | blocker | Restart tunnel; update `NEXT_PUBLIC_PHONE_URL`; prefer named Cloudflare tunnel |
| 2 | Demo | Ring Playground | Token expires ~30 min | blocker | Generate new token → `.env.local` → restart Next → Sync |
| 3 | Live assist | Phone Safari | Autoplay blocks sound until tap | annoying | “Tap for sound + talk” / Rejoin |
| 4 | Live assist | Same Mac | DoorSense + doorbell share speakers — hard to isolate | niggle | Lower caregiver vol on DoorSense; use second browser for `/doorbell` |
| 5 | State | Mac vs phone | Was localStorage-split | fixed | `/api/household` push/poll — open both devices on same tunnel origin |

## Ring Playground / API feedback

- What worked:
- What was confusing (auth, events, simulators, docs):
- Missing for care/accessibility use case:

## Tunnel cheat sheet

```bash
# Dev server
cd porchlight/web && npm run dev

# Quick tunnel (URL changes each run)
npx cloudflared tunnel --url http://127.0.0.1:3000

# Put URL in .env.local
NEXT_PUBLIC_PHONE_URL=https://….trycloudflare.com
```

Named tunnel (stable URL): see [Cloudflare named tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/).

## Judge dry-run checklist

- [ ] Fresh Ring token + Sync shows **Source: Ring**
- [ ] DoorSense ring → Tell caregiver → phone live assist
- [ ] Alert → **I’m on it — I accept** → playbook → resolve
- [ ] Second run: ignore → backup escalate → resolve
- [ ] `/doorbell` hears caregiver; Mom hears door mic
