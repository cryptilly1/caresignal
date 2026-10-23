# CareSignal · Alexa

Alexa hears the same care actions as TV remote mic / tablet voice.

## Endpoints (HTTPS tunnel required)

| Path | Role |
|------|------|
| `POST /api/alexa` | Alexa Custom Skill (ASK JSON) |
| `POST /api/alexa` + `{ "simulate": true, "action": "tell_caregiver" }` | Demo without Echo |
| `GET /api/alexa/events` | Caregiver poll (check-in / meds / walk) |
| `POST /api/mcp` | MCP tools for Alexa+ Toolkit / Inspector |
| `/alexa` | In-app simulator + setup |

## Phrases

- “Alexa, open Care Signal” → “I’m okay” / “tell my caregiver” / “I need help”
- DoorSense: expecting · tell caregiver · need help · not now · what’s at the door
- Daily: I’m okay · took my medicine · went for a walk

## Custom Skill setup (Echo)

1. [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) → Create Skill → Custom → Provision your own.
2. Invocation name: **care signal**
3. JSON Editor → paste `docs/alexa/interaction-model.json` → Save Model → Build Model.
4. Endpoint → HTTPS → your tunnel + `/api/alexa` (e.g. `https://….trycloudflare.com/api/alexa`).
5. Test in console or on a device registered to the same Amazon account.

Signature verification is skipped for hackathon speed — do not leave a public skill unverified in production.

## Alexa+ MCP (optional)

When you have Alexa+ Private Preview + `alexa-ai` CLI:

```bash
alexa-ai new mcp --name "CareSignal" --locale en-US \
  --mcp-server-url "https://YOUR-TUNNEL/api/mcp"
```

Tools exposed: `caresignal_im_okay`, `caresignal_log_medicine`, `caresignal_log_walk`, `caresignal_door_status`, `caresignal_door_respond`.

Production Alexa+ also requires OAuth (PRM + PKCE). The MCP tools work without auth for demo introspection.

## Demo without hardware

Open `/alexa` → tap a phrase → caregiver `/today` shows the toast / check-in; DoorSense “tell caregiver” opens live assist the same as tablet/TV.
