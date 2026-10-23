"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, QrCode } from "lucide-react";
import { BottomDrawer } from "./BottomDrawer";

export function CameraConnectButton({ className = "cs-button cs-button--glass", children = "Connect phone camera" }: {
  className?: string; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">{children}<QrCode size={18} /></button>
    {open && <BottomDrawer title="Connect a camera" wide onClose={() => setOpen(false)}><CameraConnectionOptions /></BottomDrawer>}
  </>;
}

function cameraUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hostname === "localhost" || url.hostname === "[::1]" || url.hostname.startsWith("127.")) return null;
    return new URL("/cam", url.origin).href;
  } catch { return null; }
}

export function CameraConnectionOptions() {
  const [address, setAddress] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const url = cameraUrl(address);

  useEffect(() => {
    const timer = window.setTimeout(() => setAddress(window.location.origin), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    if (url) {
      void import("qrcode").then(({ toDataURL }) => toDataURL(url, { width: 256, margin: 3, errorCorrectionLevel: "M" })).then((value) => {
        if (active) { setQr(value); setError(""); }
      }).catch((cause: unknown) => {
        if (active) { setQr(""); setError("The QR code could not be generated. Open the camera link directly instead."); }
        console.error("Camera QR generation failed", cause);
      });
    }
    return () => { active = false; };
  }, [url]);

  return <div className="camera-connect">
    <div className="camera-connect__intro"><span className="settings-icon"><QrCode size={23} /></span><div><h3>Turn your phone into a door camera.</h3><p>Scan with your phone&apos;s camera, then open the link and allow camera access.</p></div></div>
    <label className="onboarding-field"><span>CareSignal HTTPS address</span><input type="url" value={address} placeholder="https://your-caresignal-tunnel.example" onChange={(event) => { setAddress(event.target.value); setQr(""); setError(""); }} /></label>
    {url ? <div className="camera-connect__qr">{qr ? <Image src={qr} width={224} height={224} alt={`Scan to open the phone camera at ${url}`} unoptimized /> : !error && <p role="status">Generating QR code...</p>}<a href={url} target="_blank" rel="noopener noreferrer">{url}<ArrowUpRight size={16} /></a></div> : <p className="camera-connect__notice">A phone cannot reach your computer through localhost. Paste the HTTPS tunnel address for this same running CareSignal server. An unpublished Netlify address will not work.</p>}
    {error && <p className="settings-error" role="alert">{error}</p>}
    <Link className="cs-button cs-button--primary" href="/cam">Open camera on this device <ArrowUpRight size={17} /></Link>
    <p className="camera-connect__note">Keep the phone page open and unlocked. This stand-in detects activity and sends door events; it does not stream its video into the receiver&apos;s DoorSense view. Household access may be required on the phone.</p>
    <div className="camera-connect__alternative"><strong>Using Amazon&apos;s developer Playground?</strong><p>Use its access token to connect Ring events and request a Ring live stream instead. This is separate from the phone camera.</p><Link className="cs-button cs-button--glass" href="/setup?section=connect">Connect Ring Playground <ArrowUpRight size={17} /></Link></div>
  </div>;
}
