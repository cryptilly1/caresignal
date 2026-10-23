"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff } from "lucide-react";
import { DOOR_LIVE_ICE } from "@/lib/webrtc-ice";

type Snapshot = {
  available: boolean;
  publisherId: string | null;
  peer: { answer: RTCSessionDescriptionInit | null; cameraIce: RTCIceCandidateInit[] } | null;
};

export function DoorCameraPreview({ enabled = true, onAvailability, onStream, compact = false }: {
  enabled?: boolean;
  onAvailability?: (available: boolean) => void;
  onStream?: (stream: MediaStream | null) => void;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const availabilityRef = useRef(onAvailability);
  const streamCallbackRef = useRef(onStream);
  const [connected, setConnected] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  availabilityRef.current = onAvailability;
  streamCallbackRef.current = onStream;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let peer: RTCPeerConnection | null = null;
    let viewerId: string | null = null;
    let publisher: string | null = null;
    let iceIndex = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function signal(body: object) {
      const response = await fetch("/api/door-camera", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? "The door camera connection failed.");
      }
    }
    function close() {
      peer?.close();
      peer = null;
      streamCallbackRef.current?.(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      setConnected(false);
      if (viewerId) {
        void fetch("/api/door-camera", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave", id: viewerId }), keepalive: true })
          .catch(cause => console.error("Unable to release door camera viewer", cause));
      }
      viewerId = null;
    }
    async function tick() {
      try {
        const response = await fetch(`/api/door-camera${viewerId ? `?viewer=${viewerId}` : ""}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Live door camera updates are unavailable.");
        const snapshot = await response.json() as Snapshot;
        if (controller.signal.aborted) return;
        setAvailable(snapshot.available);
        availabilityRef.current?.(snapshot.available);
        if (!snapshot.available || publisher !== snapshot.publisherId || peer?.connectionState === "failed" ||
            (peer && !snapshot.peer)) {
          close();
          publisher = snapshot.publisherId;
        }
        if (snapshot.available && !peer) {
          setError("");
          const pc = new RTCPeerConnection({ iceServers: DOOR_LIVE_ICE });
          peer = pc;
          viewerId = crypto.randomUUID();
          const id = viewerId;
          iceIndex = 0;
          const candidates: RTCIceCandidateInit[] = [];
          let offered = false;
          pc.addTransceiver("video", { direction: "recvonly" });
          pc.onicecandidate = event => {
            if (!event.candidate || peer !== pc) return;
            const candidate = event.candidate.toJSON();
            if (!offered) candidates.push(candidate);
            else void signal({ action: "ice", id, candidate }).catch(cause => {
              if (!controller.signal.aborted) setError(cause.message);
            });
          };
          pc.ontrack = event => {
            if (peer !== pc || controller.signal.aborted) return;
            if (videoRef.current) {
              const stream = event.streams[0] ?? new MediaStream([event.track]);
              videoRef.current.srcObject = stream;
              streamCallbackRef.current?.(stream);
              void videoRef.current.play().catch(() => setError("Tap the video to start playback."));
            }
          };
          pc.onconnectionstatechange = () => {
            if (peer !== pc || controller.signal.aborted) return;
            setConnected(pc.connectionState === "connected");
          };
          await pc.setLocalDescription(await pc.createOffer());
          await signal({ action: "offer", id, sdp: pc.localDescription });
          offered = true;
          for (const candidate of candidates) await signal({ action: "ice", id, candidate });
        } else if (peer && viewerId && snapshot.peer) {
          await signal({ action: "heartbeat", id: viewerId });
          if (snapshot.peer.answer && peer.signalingState === "have-local-offer") await peer.setRemoteDescription(snapshot.peer.answer);
          if (peer.remoteDescription) {
            for (; iceIndex < snapshot.peer.cameraIce.length; iceIndex++) await peer.addIceCandidate(snapshot.peer.cameraIce[iceIndex]);
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          console.error("Door camera preview failed", cause);
          setError(cause instanceof Error ? cause.message : "The live door view could not connect.");
          close();
        }
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(tick, 900);
      }
    }
    void tick();
    return () => { controller.abort(); clearTimeout(timer); close(); };
  }, [enabled]);

  return <div className={`door-camera-preview${compact ? " door-camera-preview--compact" : ""}`}>
    <video ref={videoRef} autoPlay playsInline muted aria-label="Live phone door camera" onClick={event => {
      void event.currentTarget.play().catch(cause => setError(cause.message));
    }} />
    {connected ? <span className="door-camera-preview__badge">Live · Phone camera</span> :
      <div className="door-camera-preview__empty"><CameraOff aria-hidden="true" size={compact ? 24 : 36} /><span>{error || (available ? "Connecting to the door camera..." : "Door camera is not watching")}</span></div>}
    {connected && error && <p className="door-camera-preview__error" role="status">{error}</p>}
  </div>;
}
