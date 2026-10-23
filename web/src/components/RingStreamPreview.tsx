"use client";

import { useEffect, useRef, useState } from "react";
import { DOOR_LIVE_ICE } from "@/lib/webrtc-ice";

async function closeSession(sessionUrl: string) {
  const response = await fetch("/api/ring/stream", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionUrl }),
    keepalive: true,
  });
  if (!response.ok) throw new Error(`Could not close Ring stream (${response.status}).`);
}

async function gatherIce(peer: RTCPeerConnection, signal: AbortSignal) {
  if (signal.aborted) throw new Error("Stream canceled.");
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      peer.removeEventListener("icegatheringstatechange", changed);
      signal.removeEventListener("abort", canceled);
      if (error) reject(error); else resolve();
    };
    const changed = () => { if (peer.iceGatheringState === "complete") finish(); };
    const canceled = () => finish(new Error("Stream canceled."));
    const timer = window.setTimeout(() => finish(new Error("Network setup timed out. Check your connection and try again.")), 12000);
    peer.addEventListener("icegatheringstatechange", changed);
    signal.addEventListener("abort", canceled, { once: true });
  });
}

export function RingStreamPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const sessionRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => () => {
    attemptRef.current += 1;
    abortRef.current?.abort();
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    peerRef.current?.close();
    if (sessionRef.current) void closeSession(sessionRef.current).catch((cause) => console.error("Ring stream cleanup failed", cause));
  }, []);

  async function stop() {
    attemptRef.current += 1;
    abortRef.current?.abort();
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    peerRef.current?.close();
    peerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const session = sessionRef.current;
    sessionRef.current = null;
    setStatus("idle");
    if (session) {
      try { await closeSession(session); } catch (cause) {
        console.error("Ring stream close failed", cause);
        setError(cause instanceof Error ? cause.message : "Could not close the remote Ring session.");
        setStatus("error");
      }
    }
  }

  async function start() {
    setError("");
    setStatus("connecting");
    const attempt = ++attemptRef.current;
    const current = () => attempt === attemptRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    let createdSession: string | null = null;
    let peer: RTCPeerConnection | null = null;
    try {
      if (!window.isSecureContext || typeof RTCPeerConnection === "undefined") throw new Error("Live view requires HTTPS and a browser with WebRTC support.");
      peer = new RTCPeerConnection({ iceServers: DOOR_LIVE_ICE });
      peerRef.current = peer;
      peer.addTransceiver("video", { direction: "recvonly" });
      peer.addTransceiver("audio", { direction: "recvonly" });
      const remote = new MediaStream();
      peer.ontrack = (event) => {
        if (!current()) return;
        remote.addTrack(event.track);
        if (videoRef.current) videoRef.current.srcObject = remote;
      };
      peer.onconnectionstatechange = () => {
        if (!current() || !peer) return;
        if (peer.connectionState === "connected") {
          if (timerRef.current !== null) window.clearTimeout(timerRef.current);
          setStatus("live");
        }
        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          setError("The Ring stream disconnected. Stop the session and try again.");
          setStatus("error");
        }
      };
      await peer.setLocalDescription(await peer.createOffer());
      await gatherIce(peer, controller.signal);
      if (!current()) return;
      const response = await fetch("/api/ring/stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdpOffer: peer.localDescription?.sdp }),
      });
      const data = await response.json() as { error?: string; sdpAnswer?: string; sessionUrl?: string };
      if (data.sessionUrl) createdSession = data.sessionUrl;
      if (!current()) {
        if (createdSession) await closeSession(createdSession);
        return;
      }
      if (!response.ok || !data.sdpAnswer || !createdSession) throw new Error(data.error ?? "Ring did not return a usable stream. Check your token and device permissions.");
      sessionRef.current = createdSession;
      await peer.setRemoteDescription({ type: "answer", sdp: data.sdpAnswer });
      if (!current()) return;
      if (peer.connectionState !== "connected") timerRef.current = window.setTimeout(() => {
        if (current()) { setStatus("error"); setError("Ring did not connect in time. Stop this session and check Playground live-view access."); }
      }, 30000);
    } catch (cause) {
      peer?.close();
      if (createdSession && current()) {
        sessionRef.current = null;
        try { await closeSession(createdSession); } catch (cleanupError) { console.error("Ring stream cleanup failed", cleanupError); }
      }
      if (!current()) { console.error("Canceled Ring stream request failed", cause); return; }
      peerRef.current = null;
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Ring live view could not start.");
    }
  }

  return <div className="ring-stream-preview">
    <p>Requests a live stream from Ring&apos;s developer API using the token saved on this server. A valid token alone does not guarantee live-view permission or a stream-capable device.</p>
    <video ref={videoRef} playsInline autoPlay muted controls aria-label="Ring Playground live stream" />
    <p role="status">{status === "live" ? "Connected to Ring live view" : status === "connecting" ? "Connecting to Ring..." : "Ring stream is not connected"}</p>
    {error && <p className="settings-error" role="alert">{error}</p>}
    {status !== "idle" ? <button type="button" className="cs-button cs-button--glass" onClick={() => void stop()}>{status === "error" ? "Reset stream" : "Stop stream"}</button> : <button type="button" className="cs-button cs-button--primary" onClick={() => void start()}>Start Ring live view</button>}
    <p className="camera-connect__note">Audio starts muted. Use the video controls to listen. Close this panel to end the stream. This does not connect the phone stand-in or replace the receiver&apos;s camera.</p>
  </div>;
}
