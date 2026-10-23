# CareSignal TV shell (Fire TV / Vega)

DoorSense on TV is still the web UI at **`/tv`**. This folder is the **Vega WebView** wrapper so that experience runs on:

- **Vega Virtual Device (VVD)** — Fire TV / Vega simulator  
- **Physical Fire TV** on Vega OS (e.g. Stick 4K Select)

Same URL on both. No second DoorSense UI.

## Prerequisites

1. Mac or Linux (Vega SDK does not support Windows/WSL).  
2. Install [Vega Developer Tools](https://developer.amazon.com/apps-and-games/vega) + VS Code **Vega Studio** extension.  
3. CareSignal web running with an **HTTPS** URL the simulator can reach:
   - Local next: `npm run dev` in `../web`
   - Tunnel (needed for real device / many simulator setups): cloudflared → use `https://….trycloudflare.com/tv`

HTTP is blocked by default in modern Vega WebView — use HTTPS.

## One-time: generate the Vega project

From this directory (or any parent):

```bash
vega project generate \
  --template vegaWebview \
  --name CareSignalTV \
  --packageId com.caresignal.tv \
  --outputDir CareSignalTV
```

Then:

```bash
cd CareSignalTV
npm install @amazon-devices/webview
```

Replace `src/App.tsx` with the contents of [`App.tsx`](./App.tsx) in this folder.

Set the DoorSense URL (tunnel or LAN HTTPS):

Edit the default URI in `src/App.tsx` to your reachable HTTPS URL before build.

## Run on Vega Virtual Device (simulator)

```bash
# Terminal A — CareSignal web + tunnel
cd ../web && npm run dev
# + cloudflared tunnel --url http://localhost:3000

# Terminal B — VVD
vega virtual-device start

# Terminal C — build & launch
cd CareSignalTV
npm run build:app   # or Vega Studio ▷ Build

# Apple Silicon VVD typically wants aarch64; x86_64 VVD wants x86_64 — match your VVD.
vega run-app build/aarch64-release/CareSignalTV_aarch64.vpkg \
  com.caresignal.tv.main \
  -d VirtualDevice
```

Use Vega Studio’s **Build / Install / Run** buttons if you prefer the GUI — same result.

## Run on a physical Fire TV (Vega)

1. Enable developer mode on the stick.  
2. Connect device (`vega device list`).  
3. Build **armv7** (or the arch your device needs) and install:

```bash
vega device install-app --packagePath build/armv7-release/CareSignalTV_armv7.vpkg
vega device launch-app --appName com.caresignal.tv.main
```

## What judges see

- App launches fullscreen on Fire TV / VVD  
- DoorSense overlay (quiet pill → side choices on ding)  
- Remote ↑↓ · OK (and mic if WebView speech works)  
- Same CareSignal backend as phone + tablet  

## Fire OS (Android) note

Older Fire OS sticks can still open the same HTTPS `/tv` URL in **Silk**, or wrap the same URL in a classic Android WebView APK. Prefer **Vega WebView + VVD** when the target is Vega / Stick 4K Select.
