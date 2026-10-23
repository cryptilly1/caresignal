"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, DoorOpen, MessageCircle, Mic, MicOff, PhoneOff, Video, X } from "lucide-react";
import { DOOR_LIVE_ICE } from "@/lib/webrtc-ice";
import type { SignalPayload } from "@/lib/door-live-server";
import { useStore } from "@/lib/store";
import { DoorCameraPreview } from "./DoorCameraPreview";

type AssistEvent = { id: string; at: string; label: string; liveAssist?: boolean };
async function signal(body?: object): Promise<SignalPayload> {
  const response = await fetch("/api/door-live", {
    cache: "no-store",
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true } : {}),
  });
  if (!response.ok) throw new Error(`Live door assist is unavailable (${response.status}). Check your connection and operational access.`);
  return response.json() as Promise<SignalPayload>;
}

export function CaregiverDoorAssist({ hideIdle = false }: { hideIdle?: boolean } = {}) {
  const { state, acknowledgeAlert } = useStore();
  const recipient = state.careRecipientName || "Your care receiver";
  const [active, setActive] = useState<AssistEvent | null>(null);
  const [phase, setPhase] = useState<"waiting" | "connecting" | "connected">("waiting");
  const [micOn, setMicOn] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [bellLinked, setBellLinked] = useState(false);
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bellAudioRef = useRef<HTMLAudioElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const bellRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const sessionRef = useRef(0);
  const offeredSessionRef = useRef(0);
  const talkSessionRef = useRef(0);
  const dismissed = useRef(new Set<string>());
  const seen = useRef(new Date(Date.now() - 120000).toISOString());
  const linkedAlert = state.alerts.find(alert => alert.type === "unusual_door" && ["open", "acknowledged", "escalated"].includes(alert.status));
  const ownedByOther = linkedAlert?.status === "acknowledged" && linkedAlert.ownerId !== state.currentUserId;
  const ownership = linkedAlert?.status === "acknowledged"
    ? linkedAlert.ownerId === state.currentUserId ? "Owned by you" : `Owned by ${state.members.find(member => member.id === linkedAlert.ownerId)?.name ?? "your caregiver"}`
    : "On call: You";

  const stop = useCallback(async () => {
    generation.current++;
    peerRef.current?.close();
    peerRef.current = null;
    const talkSessionId = talkSessionRef.current;
    talkSessionRef.current = 0;
    bellRef.current?.close();
    bellRef.current = null;
    micRef.current?.getTracks().forEach(track => track.stop());
    micRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (bellAudioRef.current) bellAudioRef.current.srcObject = null;
    setPhase("waiting");
    setMicOn(false);
    setVideoReady(false);
    setBellLinked(false);
    setStartedAt(null);
    if (talkSessionId) await signal({ role: "care", type: "talk-stop", talkSessionId });
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const [live, response] = await Promise.all([
          signal(), fetch(`/api/door-sighting?since=${encodeURIComponent(seen.current)}`, { cache: "no-store" }),
        ]);
        if (!response.ok) throw new Error("Door-help requests could not be loaded.");
        const { events } = await response.json() as { events: AssistEvent[] };
        if (cancelled) return;
        offeredSessionRef.current = live.sessionId;
        for (const event of [...events].reverse()) {
          if (event.at > seen.current) seen.current = event.at;
          if (event.liveAssist && !dismissed.current.has(event.id)) setActive(event);
        }
        if (live.sharing && live.offer && !dismissed.current.has(`session-${live.sessionId}`)) {
          setActive(current => current ?? { id: `session-${live.sessionId}`, at: live.updatedAt, label: live.label, liveAssist: true });
        }
        if (peerRef.current && (!live.sharing || live.sessionId !== sessionRef.current)) {
          await stop();
          setError("The receiver ended or restarted sharing. Join again when they are ready.");
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Live assist updates failed.");
      } finally {
        if (!cancelled) timer = setTimeout(poll, 1200);
      }
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); void stop().catch(cause => console.error("Live assist cleanup failed", cause)); };
  }, [stop]);

  async function join() {
    await stop().catch(cause => setError(cause.message));
    const attempt = ++generation.current;
    setPhase("connecting");
    setError("");
    try {
      let live = await signal();
      if (live.sharing && live.answer) {
        const previousSession = live.sessionId;
        await signal({ role: "view", type: "restart", sessionId: previousSession });
        for (let i = 0; live.sessionId === previousSession || !live.sharing; i++) {
          if (attempt !== generation.current) return;
          if (i >= 30) throw new Error("The receiver has not restarted sharing. Ask them to reopen DoorSense.");
          await new Promise(resolve => setTimeout(resolve, 400));
          live = await signal();
        }
      }
      for (let i = 0; !live.sharing || !live.offer; i++) {
        if (attempt !== generation.current) return;
        if (i >= 30) throw new Error("Waiting for the receiver to share. Ask them to tap Tell my caregiver in DoorSense.");
        await new Promise(resolve => setTimeout(resolve, 400));
        live = await signal();
      }
      if (attempt !== generation.current) return;
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access needs HTTPS or localhost.");
      const mic = await navigator.mediaDevices.getUserMedia({
        video: false, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (attempt !== generation.current) { mic.getTracks().forEach(track => track.stop()); return; }
      micRef.current = mic;
      mic.getAudioTracks().forEach(track => { track.enabled = false; });
      const pc = new RTCPeerConnection({ iceServers: DOOR_LIVE_ICE });
      peerRef.current = pc;
      sessionRef.current = live.sessionId;
      const media = new MediaStream();
      pc.ontrack = event => {
        if (attempt !== generation.current) return;
        media.addTrack(event.track);
        if (videoRef.current) {
          const video = videoRef.current;
          if (video.srcObject !== media) {
            video.srcObject = media;
            void video.play().catch(() => {
              if (attempt === generation.current) setError("Tap the camera view to allow sound and playback.");
            });
          }
        }
      };
      pc.onconnectionstatechange = () => {
        if (attempt !== generation.current) return;
        if (pc.connectionState === "connected") {
          setPhase("connected");
          setStartedAt(current => current ?? Date.now());
          setElapsed(0);
          mic.getAudioTracks().forEach(track => { track.enabled = true; });
          setMicOn(true);
          if (linkedAlert && linkedAlert.status !== "acknowledged") acknowledgeAlert(linkedAlert.id);
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          void stop().catch(cause => console.error("Unable to release live assist", cause));
          setError("The call disconnected. Check connectivity and join again.");
        }
      };
      await pc.setRemoteDescription(live.offer!);
      const audio = pc.getTransceivers().find(transceiver => transceiver.receiver.track.kind === "audio");
      if (!audio) throw new Error("The receiver has not shared an audio link. Restart sharing from DoorSense.");
      audio.direction = "sendrecv";
      await audio.sender.replaceTrack(mic.getAudioTracks()[0]);
      const candidates: RTCIceCandidateInit[] = [];
      let answered = false;
      pc.onicecandidate = event => {
        if (!event.candidate || attempt !== generation.current) return;
        const candidate = event.candidate.toJSON();
        if (!answered) candidates.push(candidate);
        else void signal({ role: "view", type: "ice", sessionId: live.sessionId, candidate }).catch(cause => setError(cause.message));
      };
      await pc.setLocalDescription(await pc.createAnswer());
      if (attempt !== generation.current) return;
      await signal({ role: "view", type: "answer", sessionId: live.sessionId, sdp: pc.localDescription });
      answered = true;
      for (const candidate of candidates) await signal({ role: "view", type: "ice", sessionId: live.sessionId, candidate });

      const bell = new RTCPeerConnection({ iceServers: DOOR_LIVE_ICE });
      bellRef.current = bell;
      bell.addTrack(mic.getAudioTracks()[0], mic);
      bell.ontrack = event => {
        if (attempt !== generation.current || !bellAudioRef.current) return;
        bellAudioRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void bellAudioRef.current.play().catch(() => setError("Tap the live view to allow visitor sound."));
      };
      bell.onconnectionstatechange = () => { if (attempt === generation.current) setBellLinked(bell.connectionState === "connected"); };
      const bellCandidates: RTCIceCandidateInit[] = [];
      let bellOffered = false;
      bell.onicecandidate = event => {
        if (!event.candidate || attempt !== generation.current) return;
        const candidate = event.candidate.toJSON();
        if (!bellOffered) bellCandidates.push(candidate);
        else void signal({ role: "care", type: "ice", talkSessionId: talkSessionRef.current, candidate }).catch(cause => setError(cause.message));
      };
      await bell.setLocalDescription(await bell.createOffer());
      if (attempt !== generation.current) return;
      const talk = await signal({ role: "care", type: "talk-offer", sdp: bell.localDescription });
      if (attempt !== generation.current) {
        await signal({ role: "care", type: "talk-stop", talkSessionId: talk.talkSessionId });
        return;
      }
      talkSessionRef.current = talk.talkSessionId;
      bellOffered = true;
      for (const candidate of bellCandidates) await signal({ role: "care", type: "ice", talkSessionId: talk.talkSessionId, candidate });
      let receiverIce = 0, bellIce = 0;
      const connectedBy = Date.now() + 20000;
      async function pollMedia() {
        if (attempt !== generation.current) return;
        try {
          const data = await signal();
          if (attempt !== generation.current) return;
          if (!data.sharing || data.sessionId !== live.sessionId) throw new Error("The receiver ended sharing.");
          if (pc.connectionState !== "connected" && Date.now() > connectedBy) throw new Error("The call could not connect. Check both devices’ network and try again.");
          for (; receiverIce < data.pubIce.length; receiverIce++) await pc.addIceCandidate(data.pubIce[receiverIce]);
          if (data.talkSessionId === talk.talkSessionId) {
            if (data.talkAnswer && !bell.remoteDescription) await bell.setRemoteDescription(data.talkAnswer);
            if (bell.remoteDescription) for (; bellIce < data.talkBellIce.length; bellIce++) await bell.addIceCandidate(data.talkBellIce[bellIce]);
          }
          if (attempt === generation.current) setTimeout(() => void pollMedia(), 500);
        } catch (cause) {
          if (attempt !== generation.current) return;
          await stop().catch(error => console.error("Live assist release failed", error));
          setError(cause instanceof Error ? cause.message : "The call could not update.");
        }
      }
      void pollMedia();
    } catch (cause) {
      if (attempt !== generation.current) return;
      await stop().catch(error => console.error("Live assist release failed", error));
      setError(cause instanceof Error ? cause.message : "The call could not connect.");
    }
  }

  if (!active && hideIdle) return null;
  const duration = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  return <section className="care-card live-door-assist simulation-live" aria-label="Live door assist">
    <header className="live-door-assist__header"><span><DoorOpen aria-hidden="true" size={21} />DoorSense</span><span>Live door assist</span><button aria-label="Dismiss live assist" type="button" onClick={() => {
      if (active) dismissed.current.add(active.id);
      dismissed.current.add(`session-${offeredSessionRef.current}`);
      void stop().catch(cause => setError(cause.message));
      setActive(null);
    }}><X aria-hidden="true" size={18} /></button></header>
    <h2>{phase === "connected" ? `Helping ${recipient}` : phase === "connecting" ? `Connecting to ${recipient}` : active ? `${recipient} needs door help` : "Ready for door help"}</h2>
    <div className="live-door-assist__state"><span className={`care-chip${phase === "connected" ? " care-chip--blue" : " care-chip--pending"}`}>{phase === "connected" ? `Connected · ${duration}` : phase === "connecting" ? "Connecting..." : "Waiting for you to join"}</span><span>{phase === "connected" ? ownership : "Not connected"}</span></div>
    <div className="live-door-assist__video">
      {phase === "waiting" && <DoorCameraPreview />}
      <video hidden={phase === "waiting"} ref={videoRef} autoPlay playsInline aria-label="Live receiver-shared door view" onLoadedData={() => setVideoReady(true)} onClick={event => {
        void event.currentTarget.play().catch(() => setError("Allow media playback in your browser."));
        if (bellAudioRef.current?.srcObject) void bellAudioRef.current.play().catch(() => setError("Visitor sound playback is blocked."));
      }} />
      {phase === "connected" && videoReady && <span className="door-camera-preview__badge">Live · Shared door view</span>}
      {phase === "connecting" && <div className="door-camera-preview__empty">Connecting to the shared camera...</div>}
    </div>
    <audio ref={bellAudioRef} autoPlay playsInline hidden />
    <div className="live-door-assist__voice"><MessageCircle aria-hidden="true" size={24} /><div><strong>{phase === "connected" ? micOn ? "Your microphone is on" : "Your microphone is muted" : "“Can you help me with this visitor?”"}</strong><p>{phase === "connected" ? micOn ? `Voice goes to ${recipient}${bellLinked ? " and the connected visitor speaker" : "; visitor speaker is not connected"}.` : "No sound is sent from your microphone." : "You haven’t joined yet. Your mic is off."}</p></div></div>
    {error && <p className="settings-error" role="status">{error}</p>}
    <div className="live-door-assist__actions">
      {phase === "waiting" ? <button className="cs-button cs-button--primary" disabled={!active} type="button" onClick={() => void join()}><Video aria-hidden="true" size={20} />{ownedByOther ? "Join call" : "Join & take ownership"}</button> : <>
        {phase === "connected" && <button className="cs-button cs-button--primary" aria-pressed={!micOn} type="button" onClick={() => {
          micRef.current?.getAudioTracks().forEach(track => { track.enabled = !micOn; });
          setMicOn(!micOn);
        }}>{micOn ? <Mic aria-hidden="true" size={20} /> : <MicOff aria-hidden="true" size={20} />}{micOn ? "Mute" : "Unmute"}</button>}
        <button className="cs-button cs-button--glass" type="button" onClick={() => void stop().catch(cause => setError(cause.message))}><PhoneOff aria-hidden="true" size={20} />{phase === "connecting" ? "Cancel connection" : "Leave call"}</button>
      </>}
    </div>
    <Link className="live-door-assist__alert" href={linkedAlert ? `/alerts/${linkedAlert.id}` : "/escalation"}><span><strong>Open door-help alert</strong><small>{linkedAlert?.title ?? active?.label ?? "Care alerts stay open until cleared"}</small></span><ArrowUpRight aria-hidden="true" size={19} /></Link>
    <p className="settings-note">Joining requests microphone access. Leaving stops your microphone, not the phone camera or the care alert. A visitor hears you only when their doorbell speaker is connected.</p>
  </section>;
}
