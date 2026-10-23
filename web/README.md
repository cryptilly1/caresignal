# CareSignal web app

This is the caregiver and DoorSense web app for CareSignal. For product context,
Ring setup, and the multi-device demo flow, see the repository
[README](../README.md).

## Run locally

For Netlify, the repository-root `netlify.toml` builds the `web` application with
Node 22 and explicitly enables Netlify's Next.js adapter. Configure production
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
Loopback development requests (`localhost`, `127.0.0.1`, or `[::1]`) open without
a household password, even when one is configured for tunnel testing. This
bypass is disabled in production and does not apply to forwarded or Cloudflare
requests. Public tunnels require the configured household password; without it
their household APIs fail closed. MCP's no-token development exception is also
limited to direct loopback requests. Production API routes remain protected.
The access screen uses the shared blue/glass design and offers a password-free
demo and account sign-in before its separate live-household operator controls.

## Designed onboarding preview

For a temporary phone-camera demonstration through an HTTPS tunnel, run
`CARESIGNAL_TEMPORARY_CAMERA_DEMO=true npm run dev -- --port 3000`.
This explicitly bypasses the shared caregiver password on the development server
only; production/Netlify always retain their access checks. Treat the tunnel URL
as private: anyone with it can access demo care and camera endpoints while this
mode is enabled. Use sample data, end camera sharing after testing, and restart
without the flag to restore tunnel authentication. It does not bypass the MCP
token or Google sign-in.

Caregiver Home has a play button beside the profile control. Its simulation
drawer creates labelled, page-local care alerts, camera-motion events, receiver
help requests, missed check-ins, and missed visits. Test events can be owned or
cleared without modifying shared care records, camera settings, or receiver
requests. They disappear on navigation/reload. Shared alerts appear separately
in a notification stack below the overview: expand it or dismiss one/all without
clearing the underlying care. Care alerts has a confirmed **Clear all** action
covering pending and accepted alerts; it retains timelines and follow-up tasks
and does not clear alerts arriving after the confirmation was opened.
Household polling, phone-camera sightings, Ring sync, and live door assist stay
mounted while the simulation drawer is open. Live feeds still require operational
access and configured devices; a simulation does not validate a real Ring stream.

DoorSense, its My Day card, and both live-assist and call-preview controls share
a scoped type and shape scale: 16px action labels, 14px supporting copy,
13px status text, 24px cards, pill-shaped action buttons, and 16px media/control corners. Actions remain at least
48px high (56px for receiver response rows); icon-only call controls have 44px
targets. Text can wrap and grow instead of being forced onto one line. Headings
stay proportionate across screen sizes, video frames preserve their proportions,
and empty-camera views grow for larger text. Primary/help controls use
higher-contrast blue/red fills; leave/cancel actions have a separate soft-red
treatment. These styles do not change camera permissions, sharing, or call logic.
All shared choice drawers use compact close icons inside 44px targets, 20px
headings, pill-shaped buttons with wrapping 16px action labels, and consistent fields and supporting copy.
Their headers remain visible while long content scrolls; keyboard focus stays
inside the drawer and returns to its trigger on close. The sound drawer uses
dedicated volume sliders, not text-field styling: 6px tracks, 22px thumbs,
visible percentages, keyboard focus, and native 5% volume steps.

Real incoming Live Assist requests open in the floating DoorSense video panel.
Minimize collapses it to a restore bar with live call status; it does not leave
the call, stop the microphone, or remount the media elements. Video can expand
within the panel and return to its regular size. Escape restores expanded video
first, then minimizes the panel. Only explicit Leave/Cancel or connection cleanup
ends the connection; the preview flow remains separately labelled.
The expanded view keeps connection status, errors, mute, and leave controls
available, and fits the complete camera frame. The compact restore bar includes
a microphone toggle. Sticky panel controls stay reachable when content scrolls;
the panel is mounted above page content so navigation cannot cover its controls.
Video captions identify the receiver-shared view without claiming a Ring source.

The public product website lives at `/`; **Open app** leads to `/welcome`.
The welcome drawer supports email/password sign-in or sign-up and Google OAuth;
GitHub is not currently offered. Required fields, provider failures, and account
errors keep the user in the drawer rather than advancing onboarding.
Successful sign-in returns through `/auth/continue`. Returning accounts open
caregiver Home directly; accounts that finish receiver setup open My Day.
New Google accounts and email sign-ups still receive onboarding, and unfinished
setup remains resumable. Finishing setup saves a routing-only completion flag
and role in Supabase user metadata plus an account-ID-scoped browser marker.
Older accounts without a completion flag default to caregiver Home on sign-in
instead of repeating onboarding. Generic demo setup is never used to mark a
different account complete. These flags do not grant household membership or
operational API access, and do not synchronize the browser's care setup data.
`/account` provides an **Open CareSignal** action for existing sessions.

In Supabase Authentication → URL Configuration, allow each app origin's
`/auth/callback` (including the `next=recovery` query string), e.g. an appropriately scoped
`https://your-app-host/auth/callback**`, and use the deployed app as Site URL.
Add the current HTTPS tunnel callback separately when testing phones. If Supabase
falls back to Site URL with an OAuth `code` or provider error, the website root
forwards it to the callback instead of displaying the marketing page.
PKCE still requires finishing sign-in on the same origin/browser that started
it; a missing redirect allowlist entry cannot be repaired by forwarding a code
from one origin to another. Google itself should redirect to Supabase's
`/auth/v1/callback`, not directly to the app. Password recovery retains its
dedicated update-password screen. Auth continuation runs outside device previews.
Sign out is available in the caregiver Home profile and Settings account section.
It ends the account session on this device and clears shared caregiver access,
then returns to Welcome without deleting saved setup or care records.
Desktop app routes include a Web/Mobile/Tablet viewport switch. Mobile simulates an
iPhone 16 Pro using a 402 x 874 CSS-pixel iframe inside a device frame, so media
queries and fixed controls behave as on a phone, without a Dynamic Island overlay.
Use Hide to dismiss the preview toolbar and Show controls to restore it; the
preference persists for the browser tab and keyboard focus follows the toggle.
The website and preview toolbar reuse the app's heart-pulse logo.
Viewports 760px and narrower
render the responsive app directly, without a simulator, iframe, or preview
toolbar, even if a desktop Mobile preference was saved. Resizing back restores
the desktop preference. Neither mode changes household authorization.
Tablet uses an Amazon Fire-style landscape frame around a 960 x 600 CSS-pixel
viewport. This is a browser layout preview, not a Fire OS or Vega emulator.
Device frames scale to available desktop width without changing the iframe's
internal viewport; actual phones still render the responsive app directly.
The shared preview frame name keeps provider sign-in outside both simulators.
Caregiver and receiver onboarding have wide layouts above 760px: the role picker
shows both choices together, and setup headings and forms sit in a centered
column over a full-viewport background with white headings. Setup cards stretch
across that column on Web and tablet, with white inactive segment labels.
Phone role selection
remains a scrollable carousel. The desktop layout hides decorative phone chrome.
Onboarding actions use the same feathered glass blur as the logged-in navigation;
content scrolls underneath, with bottom padding keeping the last fields reachable.
The top scroll edge fades gently, headings stay white at every viewport size,
and a subtle dark-blue footer tint keeps the secondary action readable.
The website has separate entry
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
Shared drawers use a light, blurred scrim, bottom-sheet placement on phones,
and centered placement on desktop. Contents scroll without compressing form
controls. The account page uses a spaced, non-shrinking column so notices,
headings, and forms do not run together on short or narrow screens.

**Connect camera dummy** opens the shared camera setup drawer, also available
in Settings → Ring account / Connect Ring and DoorSense camera settings.
QR codes are generated locally, contain only the supplied HTTPS origin plus
`/cam`, and never include credentials. For local multi-device testing, enter
an HTTPS tunnel address pointing at the same running server;
localhost is not a usable phone link. The hosted site is a separate server,
not a way to join a local household session. The phone must pass the
existing household gate where enabled. Its video is a separate phone feed;
motion does not open the receiver's own camera or microphone.

`/cam` opens the phone door-camera screen. **Start watching** explicitly opens
video only. The watching/off/person-present states and Controls sheet use the
supplied camera designs, adapted to CareSignal blue. Controls switches the
front/rear camera, mirrors this phone's preview, and sends a labelled **Test**
notification; tests never create care alerts or visitor prompts. Person detection
runs in the phone browser; ordinary detections also update the shared DoorSense
prompt.

The protected `/api/door-camera` channel negotiates separate receive-only WebRTC
peers for up to 12 viewers of one phone. Receiver My Day, DoorSense and the
caregiver door panel show the actual phone view, not a visitor photograph, and
only label it live once connected. Previewing requests no viewer microphone.
Stopped cameras show an inactive state; changing cameras reconnects viewers.
Publisher/viewer leases expire after 30 seconds without a heartbeat. Signaling
is still single-process memory: use the same running local server via HTTPS
tunnel for this temporary demonstration, not multi-instance Netlify deployment.

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
- `http://localhost:3001/auth/callback`
- `http://localhost:3001/auth/callback?next=recovery`

Keep both hosted and local entries: an unlisted `redirectTo` falls back to
Supabase's Site URL. Set the Site URL to `https://caresignal-602.netlify.app`.
For phone testing, also add the current tunnel's exact `/auth/callback` and
`/auth/callback?next=recovery` URLs. The URL changes when a quick tunnel restarts.
When a local reverse proxy exposes an internal localhost origin to Next.js,
set `CARESIGNAL_PUBLIC_ORIGIN` to that tunnel's HTTPS origin in `.env.local`.
The callback uses it only when a request host matches that configured host;
ordinary localhost callbacks still return to localhost.

Google/GitHub sign-in leaves the simulated phone iframe before navigating to
the provider, since providers block embedded sign-in. Successful OAuth,
email confirmation, and email/password sign-in continue to `/onboarding`;
password recovery continues to the account password-update form. Failed
callbacks show the account error screen rather than claiming a signed-in state.

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
to preview the supplied household, invited by **Elias Aderemi**; arbitrary codes
never resolve to a household. The code and inviter name appear below the entry
field and in the invitation review. The receiver's profile is kept separate.
Signed-in account profile names prefill empty caregiver name fields and replace
the receiver's untouched example name. Existing custom names remain editable and
are not overwritten; signing in never fills the caregiver's receiver details.
Caregiver setup requires the care lead's full name, the receiver's full name,
and their relationship before advancing beyond those steps or finishing.
Preferred names, receiver username, invitations, and explicitly skippable plans
remain optional. Missing required details return focus to the relevant step;
direct review links cannot finish an incomplete setup.
This does not enable a live invitation or reminder service, and no code-request
feature is provided yet.
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

Open the sample door-help alert to inspect its local call-controls preview.
Mute, minimize/reopen, expand, decline and leave remain explicitly labelled
preview interactions; the image now shows the actual phone camera when watching,
or an unavailable state when it is off. No local microphone is opened by this
panel. Real receiver sharing requests appear in the separate **Live door assist**
card. Leaving or declining a preview does not clear the alert. Clear removes
it from the open list but retains it in care history; taking ownership and
clearing persist under `caresignal-home-preview-v1`, separate from live data.

Profile options include a visitor-only scenario and Reset preview activity.
Direct links support `&door=request`, `&door=visitor`, and `&door=connected`.
The overview activity and device health remain Figma sample data, not monitoring
results; incoming shared alerts, live assist and the phone camera are operational.
This screen's pastel background, glass summary tiles, inset cards,
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
The motion pill turns red, a six-second dismissible top notice appears, and the
card connects to the phone's receive-only live view when available. It never
opens the receiver's local camera or microphone for a preview or substitutes a
reference photograph for live video.
Loading and connection-error states are distinct from inactivity.

## DoorSense door view

`/doorsense` uses the shared blue/glass components in a responsive tablet layout:
camera and response cards sit side by side, with separate caregiver sound,
visitor sound, and microphone controls beneath. On phones these cards stack.
Quiet, visitor, waiting, connected/muted, confirmation, and error states use the
existing door-event and WebRTC endpoints; no stock visitor image represents live
footage. Door events from the phone and Ring Playground update the same visitor
prompt, even when only the receiver screen is open. The video source is labelled
as the phone door camera or an explicitly opened receiver-device stand-in, never
as a Ring video feed.

The quiet screen captures no media or door audio. A new door event less than two
minutes old opens the phone-camera view without requesting local media.
The receiver can explicitly open their own camera if no phone is watching.
Sharing requires an explicit caregiver/help action;
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

**Live door assist** uses the supplied waiting/connecting/connected designs in
blue/glass styling. Its preview is receive-only; **Join** explicitly asks for
the caregiver microphone and joins the receiver's camera/audio link. A connected
caregiver may mute, leave and rejoin. Receiver microphone transmission remains
off until the receiver enables it. The visitor speaker is linked separately
through `/doorbell`, and is never claimed connected merely because the receiver
call connected. Joining accepts an unowned door alert; existing ownership by
another caregiver is displayed, not overwritten. Leaving keeps the care alert
and phone watching session intact. Dummy audio and phone video are not proof of
a successful live Ring-device stream.
If the phone feed disconnects while being shared, receiver microphone and
caregiver sharing stop instead of leaving a frozen picture labelled live.
