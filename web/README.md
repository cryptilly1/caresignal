# CareSignal web app

This is the caregiver and DoorSense web app for CareSignal. For product context,
Ring setup, and the multi-device demo flow, see the repository
[README](../README.md).

## Run locally

For Netlify, the repository-root `netlify.toml` builds the `web` application with
Node 22 and uses Netlify's automatic Next.js adapter. Configure production
builds from `cryptilly1/caresignal` on its production branch,
`cryptilly1-porchlight-continuation`. With `web` as the base directory, `.next`
is the publish directory. Pushes to that branch trigger Netlify through the
repository webhook; environment values stay in Netlify, not GitHub source.
Configure production
environment variables in Netlify, never in committed files. Public Supabase
connection settings in `.env.example` enable Supabase account authentication;
durable/shared household storage, household membership permissions, and shared
signaling storage are not yet implemented. The existing production access gate still requires a randomly
generated `CARESIGNAL_APP_PASSWORD` of at least 32 characters. Do not rely on
server memory for multi-device testing on serverless deployments.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Ring Playground features
need a short-lived access token; configure it locally in `.env.local` or use
the in-app token setup. Never commit `.env.local`.

## Public deployment security

Set `CARESIGNAL_APP_PASSWORD` and `CARESIGNAL_MCP_TOKEN` to separate randomly
generated secrets of at least 32 characters before deploying. For example:

```bash
openssl rand -base64 32
```

The caregiver password creates an eight-hour HttpOnly, Secure, SameSite cookie.
The MCP endpoint requires `Authorization: Bearer <CARESIGNAL_MCP_TOKEN>`.
Set `ALEXA_SKILL_ID` to the application ID from the Alexa developer console.
Alexa Skill requests are validated against Amazon's certificate chain, raw-body
signature, timestamp, and configured skill ID; the browser-based Alexa simulator
uses the caregiver session.
Without these variables, the local development app remains open, but the
production API routes fail closed.

## Designed onboarding preview

The public product website lives at `/`; **Open app** leads to `/welcome`.
App routes include a Web/Mobile viewport switch. Mobile uses a 390px iframe
with its own viewport so media queries and fixed controls behave as on a phone;
it does not change household authorization. The website has separate entry
points for the care circle, receiver, DoorSense, camera, voice, and audio tools.
Web mode spans the browser width; its welcome screen fills the space below the
viewport toolbar. The old centered phone shell remains confined to mobile preview.
The website's compact "How it works" previews crop actual 390px app captures into
minimal neutral frames, stored under `public/images/product/`. DoorSense adds an
explicitly illustrative motion banner and response modal over the receiver
capture. These show example household information, not live monitoring; no camera
is opened for these assets. Experience links use the shared glass button style.

Connect Ring uses full-width stacked cards on desktop instead of the general
settings grid. Camera setup and Ring live-view drawers expand to 680px on wide
screens while retaining the standard narrow drawer on phones.

**Connect camera dummy** opens the shared camera setup drawer, also available
in Settings → Ring account / Connect Ring and DoorSense camera settings.
QR codes are generated locally, contain only the supplied HTTPS origin plus
`/cam`, and never include credentials. For local multi-device testing, enter
an HTTPS tunnel address pointing at the same running server; localhost and the
unpublished Netlify site are not usable phone links. The phone must pass the
existing household gate where enabled. Its motion events do not make it the
receiver's DoorSense video source.

Settings → Connect Ring also offers a live-view panel backed by the existing
authenticated Ring WHEP endpoint. Save a valid Playground token first.
Device access and streaming permissions are still required. Streaming starts
only on request, reports actual peer connection state, starts muted, and closes
the peer and remote session on stop or panel dismissal. No live Ring credentials
or successful cross-network stream have been supplied or verified by this change.

The app welcome page includes **Continue with demo**, which opens the local caregiver
activity preview without signing in or bypassing protected household APIs. Demo
care lead display names use Elias; existing fixture IDs remain unchanged so
assignments and duty rotations retain their relationships. The exact old seeded
Alex identity is upgraded on load without resetting logs or replacing custom names.

## Account authentication

Email/password sign-in and signup, Google/GitHub OAuth, password reset, and local
sign-out use Supabase. Configure `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in local and hosted environments. Enable
the desired providers in Supabase; disabled providers display an explicit error.
Provider client secrets belong in Supabase, not the repository or browser.

In Supabase Authentication URL Configuration, set the hosted Site URL and allow:

- `https://caresignal-602.netlify.app/auth/callback`
- `https://caresignal-602.netlify.app/auth/callback?next=recovery`
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/callback?next=recovery`

For Google and GitHub, use the Supabase project's `/auth/v1/callback` URL in the
provider console, not the Netlify callback. Email confirmation and reset links
must be opened in the browser where the PKCE flow started. `/account` reports the
real account status. Account login does not grant access to the shared seeded
household; household membership authorization is a separate pending integration.
Use Node 22 or newer for the Supabase SDK.

`/onboarding` includes caregiver and recipient profiles, member invitations,
a starting duty/backup plan, daily check-ins, and household review. Long screens
scroll within the viewport while the bottom actions remain available. Wider
viewports use a two-column layout for the new setup screens.

Finish Setup saves this preview under `caresignal-setup-v1` in browser storage
and opens `/care-circle`. The home screen's Manage links reopen the saved setup.
This preview is separate from the existing operational household at `/today`.
Invitations are local demo records only: no email, authentication, contact
permission, or active reminders are connected. The contacts tab uses explicitly
labelled sample contacts. The backup drawer lists only invited care-team
members, supports multiple selections, and applies changes with Add members.
Selected pending members remain marked Pending and cannot respond until they
join; joined backups are shown as Added. Closing the drawer discards unconfirmed
selections. Existing saved single-backup selections migrate automatically.
Relationship, access level, shift, repeat, reminder time, and backup choices use
slide-up drawers matching the account sheet, with keyboard focus containment,
Escape/tap-outside dismissal, and focus restored to the trigger.

Selecting **I receive support** opens `/onboarding/receiver`: an unconnected
state, invitation-code entry, household review with explicit Accept & Join,
and an optional daily reminder. Use the clearly labelled demo code `CS-7K4M`
to preview the supplied household; arbitrary codes never resolve to a household.
On-screen demo helper copy is omitted to match the designs; enter the code
manually. This does not enable a live invitation or reminder service.
Invitation links can open `/onboarding/receiver?code=CS-7K4M`. Checking a code
does not save joining consent. The reminder has no default selection; accepting,
declining, or skipping is the receiver's choice.
Back from the joined screen reopens household review for inspection; it does
not revoke joining consent. Continuing from that review preserves the existing
reminder preference instead of accepting the invitation again.

Receiver consent and preferences are stored separately under
`caresignal-receiver-v1`. **Go to My Day** and **I'll connect later** open the
local `/onboarding/my-day` preview, not the protected operational `/recipient`
surface. Demo check-ins are device-local only. No real invitations are accepted,
messages sent, household data shared, or reminder notifications scheduled.

## Caregiver home activity preview

`/care-circle?view=activity` shows the designed caregiver home: duty and backup,
overview tiles, open care alerts, recipient logs, medicine and Ring health.
The setup-ready home at `/care-circle` is preserved and links to this view.
The elongated Figma home is rendered as natural content within a scrolling
viewport, with a fixed glass navigation bar and a wider desktop layout.

Open the door-help alert to view the large request card, then Join call to
inspect its connected state. Mute, minimize/reopen, expand video, decline and
leave are local UI interactions; the original Figma visitor photo is a still,
marked PREVIEW. No camera or microphone is opened, and no audio is captured or
transmitted. Leaving or declining a call does not clear the alert. Clear removes
it from the open list but retains it in care history; taking ownership and
clearing persist under `caresignal-home-preview-v1`, separate from live data.

Profile options include a visitor-only scenario and Reset preview activity.
Direct links support `&door=request`, `&door=visitor`, and `&door=connected`.
All activity and device health in this view are Figma sample data, not monitoring
results. The existing protected operational surfaces and camera services are
unchanged. This screen's pastel background, glass summary tiles, inset cards,
compact status labels, and door overlay define the visual reference for further
screen refinements.

## Settings and device setup

`/setup` uses the new caregiver design language and retains caregiver authentication.
Its card-based menu opens deep-linkable internal pages via `?section=`: `rhythm`,
`windows`, `response`, `rota`, `cover`, `door`, `visitors`, `members`, `playbooks`,
`ring`, `connect`, `permissions`, and `account`. Back links preserve the hierarchy;
browser Back works between pages. Time/member choices and editors use slide-up
drawers; camera sensitivity and alert policy use segmented controls.

Existing care-pact, camera, duty, and override controls still use the household
store. Visitor add/edit/remove and playbook editing update that same store and
its existing local/server synchronization. The rota is date-based, not a new
weekly recurrence system. Temporary cover starts immediately and must be ended
manually; it does not claim scheduled expiry or send new notifications.

Ring setup preserves the existing server-memory Playground-token API. It never
asks for a Ring password, fabricates an OAuth authorization page, or infers online
device health from a configured token. Clearing a pasted token falls back to an
environment token if present; it is not account-level revocation.

Individual caregiver/receiver authentication, real invitations, and Ring OAuth
remain unimplemented. The account page says this explicitly, and household demo
members are marked Demo rather than presented as verified signed-in identities.
No new account switching or authentication bypass is introduced.

## Alerts and Care circle

`/escalation` is the redesigned care-alert inbox. Horizontally scrolling status
pills are individual compact buttons with muted backgrounds and a white selected
state, without a shared background track. They select
Escalated, Awaiting acceptance, or Accepted/in progress; cards in
each group browse sideways with scroll snapping and previous/next controls.
`/escalation?view=history` retains resolved and individually cleared incidents.
Clearing adds a distinct `cleared` status and a timeline entry rather than
deleting the event or pretending care was completed.

`/alerts/[id]` shows responsibility, playbook progress, linked tasks, handoff,
outcomes, and the real incident timeline. Accepting records the current demo
caregiver as owner and stops escalation. Handoff transfers ownership immediately;
it is not a pending request. Outcome selection and notes use a slide-up drawer.
Existing live door assist remains available when there is an active session;
arbitrary care alerts are not presented as live visitor video.

The former Family tasks route, `/assignments`, is now **Care circle**. It includes
assigned-to-me, all-open, and completed/declined filters; task detail links use
`?task=<id>`. `?view=new` creates a task with an explicit caregiver and relative
due time, optionally linked using `&alert=<id>`. Tasks remain open independently
of resolving or clearing their related incident. Overdue tasks stay actionable.
All data uses the existing household store and synchronization; no sample care
incidents are silently inserted into the operational household.

The four-tab caregiver navigation connects Home, Alerts, Care circle, and
Settings. `/care-circle` still hosts the setup-ready home and its separate
activity preview; it is not repurposed as the operational task store. Activity
preview fixtures remain separate from real household alerts. The duty/backup
summary card appears on Home only, not the Alerts, Care circle, or Settings menus.
Alerts, Care circle, and Settings center the wordmark in their header. Nested
pages use a round glass Back link in that header rather than a separate content
row, keeping their smaller page titles aligned with the top-level pages.
Shared selection drawers use consistent inset option rows and a checked selected
state. Member options show an initials avatar, name, and household role instead
of an email address; these are demo household identities, not verified accounts.

## Receiver daily experience

`/recipient` is the operational receiver Home, using the blue/glass design
language with mood, check-in, voice, and reminder tiles; medicine, walk, and
expected-visitor rows; and quick access to the care circle. Its receiver-only
navigation opens `?view=reminders`, `?view=circle`, and `?view=settings`, not
caregiver management screens. The old `/home` redirect still opens `/recipient`.
The receiver onboarding My Day preview links here without copying its local
demo check-ins or treating a sample invitation as household authentication.

Mood uses the existing three feeling levels with a slider and explicit Log
action. The medicine drawer browses the household's scheduled medicines
sideways and records an existing medicine/time slot as taken, with duplicate
protection. It displays the configured amount rather than offering arbitrary
dose changes; the artwork is a generic medicine icon, not a product photograph.
Walks, check-ins, visits, breaks, and urgent help use the shared household store.
One-off visits replace today's previous one-off window and end no later than
midnight; a visit label does not establish visitor identity.

The reminder count is the number of unlogged scheduled medicine slots plus an
outstanding daily check-in, excluding check-in while on a break. It is not a
claim that push notifications have been scheduled. Taking a break pauses quiet
check-in escalation for today, not door alerts or urgent help.

Voice starts only after tapping **Tap to speak** and stops on dismissal. Check-in
can be recorded by voice; medicine and walk commands open their drawers for
explicit confirmation. Unsupported-browser and microphone errors are shown.
This page does not claim Alexa is connected, implement general member calls,
or replace emergency services. The connection drawer links to the existing
DoorSense sharing flow. TV and camera tools retain their existing interfaces.
Individual receiver authentication remains unimplemented; the
existing shared household access gate is unchanged.

Receiver status chips share the onboarding 25px minimum height. The mood action
uses the normal 44px glass button treatment, and microphone/bell tile icons use
matching blue-tinted circles. Text-glyph controls (checks, close marks, and
chevrons) use consistently sized Lucide SVG icons throughout the redesigned
screens and shared drawers.

The medicine cabinet supports touch/trackpad scrolling, mouse-wheel scrolling
while the rail can move, and previous/next buttons. Walk durations include
Custom (1–1,440 whole minutes). Care-task due times and backup-notification
delays also offer Custom durations; changing a delay does not create a repeat.

Expected visitors support one-off, daily, weekly, every-two-weeks, monthly, and
custom day/week/month intervals anchored to a start date. Monthly visits use
the last day of a shorter month when necessary. Existing weekly visitors retain
their weekday behavior until edited. These schedules drive visitor matching,
receiver Home, and the care summary, not just the settings labels.

Receiver duty timing follows the operational date-based rota (its day rolls
over at UTC midnight, displayed in the browser's local time). Temporary cover
is marked as lasting until manually ended. The onboarding Home preview's
illustrative shift hours are not substituted for operational duty data.

DoorSense remains directly below the four receiver Home tiles. Its inactive
state is always rendered; recent door events switch it to a motion state for
two minutes, with a View camera action into the existing DoorSense workflow.
The card polls event metadata only: it does not capture media, auto-open a
camera, claim the camera is live, or use a reference photograph as live video.
Loading and connection-error states are distinct from inactivity.

## DoorSense door view

`/doorsense` uses the shared blue/glass components in a responsive tablet layout:
camera and response cards sit side by side, with separate caregiver sound,
visitor sound, and microphone controls beneath. On phones these cards stack.
Quiet, visitor, waiting, connected/muted, confirmation, and error states use the
existing door-event and WebRTC endpoints; no stock visitor image represents live
footage. The current video source is explicitly labeled as the receiver device's
camera stand-in, not a Ring video feed.

The quiet screen captures no media or door audio. A new door event less than two
minutes old opens video only. Sharing requires an explicit caregiver/help action;
the microphone stays muted while waiting and until explicitly enabled after a
WebRTC connection is established. Urgent help is saved before asking for media
permissions, so denied camera or microphone access does not block that request.
This is not an emergency call.

Canceling sharing or ending a call stops the microphone and caregiver link while
leaving the local camera view open. Closing the door view, navigating away, or the
five-minute view timeout stops local camera/microphone tracks and door audio.
Late permission results are stopped rather than reopening a closed view. Optional
session IDs on publisher signaling prevent delayed cleanup or ICE from modifying
a newer sharing session; existing signaling clients remain compatible.
