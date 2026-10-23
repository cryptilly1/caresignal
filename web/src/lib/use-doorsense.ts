"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DOOR_LIVE_ICE } from "./webrtc-ice";
import { speak } from "./speech";
import type { SignalPayload } from "./door-live-server";

export type DoorChoice = "expecting" | "tell_caregiver" | "need_help" | "dismiss";
type DoorEvent = { id: string; at: string; label: string; source: string };

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) throw new Error(`DoorSense could not ${init?.method ? "save this action" : "load updates"} (${response.status}). Please try again.`);
  return response.json() as Promise<T>;
}

const signal = (body: object) => readJson<SignalPayload>("/api/door-live", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export function useDoorSense(onHelp: () => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const caregiverAudioRef = useRef<HTMLAudioElement>(null);
  const visitorAudioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const visitorPeerRef = useRef<RTCPeerConnection | null>(null);
  const visitorSessionRef = useRef(0);
  const receivedIce = useRef(0);
  const visitorIce = useRef(0);
  const sessionRef = useRef(0);
  const seenEventRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const sharingRef = useRef(false);
  const connectedRef = useRef(false);
  const mutedRef = useRef(true);
  const cameraOpeningRef = useRef(false);
  const visitorConnectingRef = useRef(false);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState<DoorEvent | null>(null);
  const [visit, setVisit] = useState<DoorEvent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pollError, setPollError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [message, setMessage] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraOpening, setCameraOpening] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [caregiverAudio, setCaregiverAudio] = useState(false);
  const [visitorAudio, setVisitorAudio] = useState(false);
  const [micMuted, setMicMuted] = useState(true);
  const [caregiverVolume, setCaregiverVolume] = useState(0.5);
  const [visitorVolume, setVisitorVolume] = useState(1);
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<DoorChoice | "ended" | null>(null);

  const stopVisitor = useCallback(() => {
    visitorPeerRef.current?.close();
    visitorPeerRef.current = null;
    visitorSessionRef.current = 0;
    visitorIce.current = 0;
    visitorConnectingRef.current = false;
    if (visitorAudioRef.current) visitorAudioRef.current.srcObject = null;
    setVisitorAudio(false);
  }, []);

  const stopSharing = useCallback(async () => {
    const owned = sharingRef.current;
    const sessionId = sessionRef.current;
    sharingRef.current = false;
    connectedRef.current = false;
    peerRef.current?.close();
    peerRef.current = null;
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
    if (caregiverAudioRef.current) caregiverAudioRef.current.srcObject = null;
    mutedRef.current = true;
    setSharing(false);
    setConnectedAt(null);
    setCaregiverAudio(false);
    setMicMuted(true);
    if (owned) await signal({ role: "pub", type: "stop", sessionId });
  }, []);

  const closeMedia = useCallback(async () => {
    generationRef.current++;
    if (expiryRef.current) clearTimeout(expiryRef.current);
    expiryRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    stopVisitor();
    await stopSharing();
  }, [stopSharing, stopVisitor]);

  const openCamera = useCallback(async () => {
    if (cameraOpeningRef.current || streamRef.current?.getVideoTracks().some((track) => track.readyState === "live")) return;
    cameraOpeningRef.current = true;
    setCameraOpening(true);
    setMediaError("");
    const generation = generationRef.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access needs HTTPS or localhost and a supported browser.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!mountedRef.current || generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (!mountedRef.current || generation !== generationRef.current) return;
      setCameraOn(true);
      expiryRef.current = setTimeout(() => {
        void closeMedia().catch((error: Error) => setMediaError(error.message));
        setVisit(null);
        setResponse("ended");
        setMessage("This door session ended after five minutes. Camera and microphone are off.");
      }, 300000);
      stream.getVideoTracks().forEach((track) => { track.onended = () => {
        if (!mountedRef.current || streamRef.current !== stream) return;
        void closeMedia().catch((error: Error) => setMediaError(error.message));
        setMediaError("Camera access ended. Open the camera again to continue.");
      }; });
    } catch (error) {
      if (mountedRef.current && generation === generationRef.current) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraOn(false);
        setMediaError(error instanceof Error ? error.message : "Camera access failed. Check browser permissions.");
      }
    } finally {
      cameraOpeningRef.current = false;
      if (mountedRef.current) setCameraOpening(false);
    }
  }, [closeMedia]);

  const startSharing = useCallback(async () => {
    await openCamera();
    const camera = streamRef.current;
    if (!camera) throw new Error("Your camera is unavailable. The help request can still be sent, but no video is shared.");
    await stopSharing();
    if (!mountedRef.current) throw new Error("Sharing was cancelled.");
    const generation = generationRef.current;
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({
        video: false, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!mountedRef.current || generation !== generationRef.current) {
        microphone.getTracks().forEach((track) => track.stop());
        throw new Error("Sharing was cancelled.");
      }
      microphone.getAudioTracks().forEach((track) => { track.enabled = false; });
      microphoneRef.current = microphone;
      const pc = new RTCPeerConnection({ iceServers: DOOR_LIVE_ICE });
      peerRef.current = pc;
      receivedIce.current = 0;
      const candidates: RTCIceCandidateInit[] = [];
      let offered = false;
      for (const track of camera.getVideoTracks()) pc.addTrack(track, camera);
      for (const track of microphone.getAudioTracks()) pc.addTrack(track, microphone);
      for (const transceiver of pc.getTransceivers()) {
        transceiver.direction = transceiver.sender.track?.kind === "video" ? "sendonly" : "sendrecv";
      }
      pc.onicecandidate = (event) => {
        if (!event.candidate || peerRef.current !== pc) return;
        const candidate = event.candidate.toJSON();
        if (!offered) candidates.push(candidate);
        else void signal({ role: "pub", type: "ice", candidate, sessionId: sessionRef.current }).catch((error: Error) => setMediaError(error.message));
      };
      pc.ontrack = (event) => {
        if (event.track.kind !== "audio" || peerRef.current !== pc) return;
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        if (caregiverAudioRef.current) {
          caregiverAudioRef.current.srcObject = stream;
          void caregiverAudioRef.current.play().catch(() => setMediaError("Tap caregiver sound to allow audio playback."));
        }
        setCaregiverAudio(true);
        event.track.onended = () => setCaregiverAudio(false);
      };
      pc.onconnectionstatechange = () => {
        if (peerRef.current !== pc) return;
        const connected = pc.connectionState === "connected";
        connectedRef.current = connected;
        microphone.getAudioTracks().forEach((track) => { track.enabled = connected && !mutedRef.current; });
        if (connected) {
          setConnectedAt((value) => value ?? Date.now());
        } else {
          setConnectedAt(null);
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") setMediaError("The caregiver connection dropped. End sharing and try again.");
        }
      };
      await pc.setLocalDescription(await pc.createOffer());
      if (!mountedRef.current || peerRef.current !== pc || generation !== generationRef.current) return;
      const data = await signal({ role: "pub", type: "offer", sdp: pc.localDescription, label: "DoorSense · receiver device camera" });
      if (!mountedRef.current || peerRef.current !== pc || generation !== generationRef.current) {
        await signal({ role: "pub", type: "stop", sessionId: data.sessionId });
        return;
      }
      sessionRef.current = data.sessionId;
      sharingRef.current = true;
      setSharing(true);
      offered = true;
      for (const candidate of candidates) await signal({ role: "pub", type: "ice", candidate, sessionId: data.sessionId });
    } catch (error) {
      await stopSharing();
      throw error;
    }
  }, [openCamera, stopSharing]);

  const listenToVisitor = useCallback(async (data: SignalPayload) => {
    if (!data.bellMomOffer || visitorConnectingRef.current) return;
    visitorConnectingRef.current = true;
    const generation = generationRef.current;
    try {
      const pc = new RTCPeerConnection({ iceServers: DOOR_LIVE_ICE });
      visitorPeerRef.current = pc;
      visitorSessionRef.current = data.bellMomSessionId;
      visitorIce.current = 0;
      pc.onicecandidate = (event) => {
        if (event.candidate && visitorPeerRef.current === pc) void signal({ role: "mom", type: "ice", candidate: event.candidate.toJSON() }).catch((error: Error) => setMediaError(error.message));
      };
      pc.ontrack = (event) => {
        if (event.track.kind !== "audio" || visitorPeerRef.current !== pc) return;
        if (visitorAudioRef.current) {
          visitorAudioRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track]);
          void visitorAudioRef.current.play().catch(() => setMediaError("Tap visitor sound to allow audio playback."));
        }
        setVisitorAudio(true);
        event.track.onended = () => setVisitorAudio(false);
      };
      await pc.setRemoteDescription(data.bellMomOffer);
      await pc.setLocalDescription(await pc.createAnswer());
      if (generation !== generationRef.current || visitorPeerRef.current !== pc) return;
      await signal({ role: "mom", type: "bell-mom-answer", sdp: pc.localDescription });
    } catch (error) {
      if (mountedRef.current && generation === generationRef.current) {
        stopVisitor();
        setMediaError(error instanceof Error ? error.message : "Visitor audio could not connect.");
      }
    } finally {
      visitorConnectingRef.current = false;
    }
  }, [stopVisitor]);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const data = await readJson<{ pending: DoorEvent | null }>("/api/doorsense", { signal: controller.signal });
        if (controller.signal.aborted) return;
        setLoaded(true);
        setPollError("");
        setPending(data.pending);
        if (data.pending && seenEventRef.current !== data.pending.id) {
          seenEventRef.current = data.pending.id;
          const age = Date.now() - new Date(data.pending.at).getTime();
          if (age >= 0 && age < 120000) {
            setVisit(data.pending);
            setResponse(null);
            setMessage("");
            speak("Someone is at the door. You can choose what happens next.");
            if (!sharingRef.current) void openCamera();
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) setPollError(error instanceof Error ? error.message : "DoorSense updates are unavailable.");
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(tick, 1000);
      }
    }
    void tick();
    return () => {
      mountedRef.current = false;
      controller.abort();
      clearTimeout(timer);
      void closeMedia().catch((error: Error) => console.error("DoorSense cleanup:", error.message));
    };
  }, [closeMedia, openCamera]);

  useEffect(() => {
    if (!cameraOn) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const data = await readJson<SignalPayload>("/api/door-live", { signal: controller.signal });
        if (controller.signal.aborted) return;
        const pc = peerRef.current;
        if (pc && sharingRef.current) {
          if (data.sessionId !== sessionRef.current || !data.sharing) {
            await stopSharing();
            setResponse("ended");
            setMessage("The caregiver sharing session has ended.");
          } else {
            if (data.answer && pc.signalingState === "have-local-offer") await pc.setRemoteDescription(data.answer);
            if (pc.remoteDescription) {
              for (let i = receivedIce.current; i < data.viewIce.length; i++) await pc.addIceCandidate(data.viewIce[i]);
              receivedIce.current = data.viewIce.length;
            }
          }
        }
        if (!data.bellMomLive) {
          if (visitorPeerRef.current) stopVisitor();
        } else if (data.bellMomOffer && visitorSessionRef.current !== data.bellMomSessionId) {
          stopVisitor();
          await listenToVisitor(data);
        } else if (visitorPeerRef.current?.remoteDescription) {
          for (let i = visitorIce.current; i < data.bellMomPubIce.length; i++) await visitorPeerRef.current.addIceCandidate(data.bellMomPubIce[i]);
          visitorIce.current = data.bellMomPubIce.length;
        }
      } catch (error) {
        if (!controller.signal.aborted) setMediaError(error instanceof Error ? error.message : "The audio/video connection could not update.");
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(tick, 500);
      }
    }
    void tick();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [cameraOn, listenToVisitor, stopSharing, stopVisitor]);

  useEffect(() => {
    if (caregiverAudioRef.current) caregiverAudioRef.current.volume = caregiverVolume;
    if (visitorAudioRef.current) visitorAudioRef.current.volume = visitorVolume;
  }, [caregiverVolume, visitorVolume]);

  function toggleMic() {
    if (!connectedRef.current || !microphoneRef.current) return;
    const muted = !mutedRef.current;
    mutedRef.current = muted;
    microphoneRef.current.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    setMicMuted(muted);
  }

  async function respond(choice: DoorChoice) {
    if (busy) return;
    setBusy(true);
    setMediaError("");
    setMessage("");
    try {
      if (choice === "tell_caregiver") await startSharing();
      if (!mountedRef.current) return;
      const data = await readJson<{ response: { label: string } | null }>("/api/doorsense", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "respond", choice }),
      });
      if (!data.response) throw new Error("This visitor prompt has already ended. Waiting for the next visitor.");
      if (choice === "need_help") onHelp();
      setPending(null);
      setResponse(choice);
      if (choice === "need_help") {
        try { await startSharing(); } catch (error) {
          if (mountedRef.current) setMediaError(`Help request saved. Camera is not shared. ${error instanceof Error ? error.message : "Camera sharing could not start."}`);
        }
      }
      if (choice === "expecting") await stopSharing();
      if (choice === "dismiss") { await closeMedia(); setVisit(null); }
    } catch (error) {
      if (choice === "tell_caregiver" || choice === "need_help") await stopSharing().catch((cause: Error) => setMediaError(cause.message));
      setMediaError(error instanceof Error ? error.message : "Your response could not be sent.");
    } finally { if (mountedRef.current) setBusy(false); }
  }

  async function endSession(closeCamera: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (closeCamera) { await closeMedia(); setVisit(null); }
      else await stopSharing();
      setResponse("ended");
      setMessage(closeCamera ? "Camera, microphone and door sound are off." : "Sharing stopped. Your camera view is still open; your microphone is off.");
    } catch (error) { setMediaError(error instanceof Error ? error.message : "The session could not be ended. Local camera and microphone have been stopped."); }
    finally { if (mountedRef.current) setBusy(false); }
  }

  async function enableSound(kind: "caregiver" | "visitor") {
    const audio = kind === "caregiver" ? caregiverAudioRef.current : visitorAudioRef.current;
    if (!audio?.srcObject) return;
    const volume = kind === "caregiver" ? caregiverVolume : visitorVolume;
    if (kind === "caregiver") setCaregiverVolume(volume > 0 ? 0 : 0.5);
    else setVisitorVolume(volume > 0 ? 0 : 1);
    try { await audio.play(); } catch { setMediaError("Sound playback was blocked. Allow audio in your browser and try again."); }
  }

  return {
    videoRef, caregiverAudioRef, visitorAudioRef, pending, visit, loaded, pollError, mediaError,
    message, cameraOn, cameraOpening, sharing, connectedAt, caregiverAudio, visitorAudio,
    micMuted, caregiverVolume, visitorVolume, setCaregiverVolume, setVisitorVolume, busy,
    response, setResponse, openCamera, respond, endSession, toggleMic, enableSound,
  };
}
