"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DOOR_LIVE_ICE } from "@/lib/webrtc-ice";

type AssistEvent = {
  id: string;
  at: string;
  label: string;
  liveAssist?: boolean;
};

/**
 * Caregiver phone: watch/listen to Mom’s door cam, talk to Mom + doorbell.
 * Leave hangs up; Rejoin restores video + audio + mic.
 */
export function CaregiverDoorAssist({
  hideIdle = false,
}: {
  /** Home page draws its own door card; only surface this when a live call exists. */
  hideIdle?: boolean;
} = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const talkPcRef = useRef<RTCPeerConnection | null>(null);
  const bellAudioRef = useRef<HTMLAudioElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const viewIceSent = useRef(0);
  const talkBellIceSent = useRef(0);
  const sessionSeen = useRef(0);
  const connectingRef = useRef(false);
  const pollRef = useRef<number | null>(null);
  const talkPollRef = useRef<number | null>(null);
  const sinceRef = useRef(new Date(Date.now() - 120_000).toISOString());
  const seenRef = useRef(new Set<string>());
  const [active, setActive] = useState<AssistEvent | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [sharingHint, setSharingHint] = useState(false);
  const [connState, setConnState] = useState("");
  const [bellLinked, setBellLinked] = useState(false);
  const [hearingDoorbellMic, setHearingDoorbellMic] = useState(false);
  /** User tapped Leave — don't auto-rejoin until they hit Rejoin */
  const leftOnPurpose = useRef(false);

  const isLocalDemoHost =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

  const clearPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearTalkPoll = useCallback(() => {
    if (talkPollRef.current != null) {
      window.clearInterval(talkPollRef.current);
      talkPollRef.current = null;
    }
  }, []);

  const stopTalkToBell = useCallback(async () => {
    clearTalkPoll();
    talkPcRef.current?.close();
    talkPcRef.current = null;
    talkBellIceSent.current = 0;
    setBellLinked(false);
    setHearingDoorbellMic(false);
    if (bellAudioRef.current) bellAudioRef.current.srcObject = null;
    await fetch("/api/door-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "talk-stop", role: "care" }),
    }).catch(() => {});
  }, [clearTalkPoll]);

  const stopStream = useCallback(async () => {
    clearPoll();
    connectingRef.current = false;
    await stopTalkToBell();
    pcRef.current?.close();
    pcRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    viewIceSent.current = 0;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
    setInCall(false);
    setMicOn(false);
    setNeedsTap(false);
    setConnState("");
  }, [clearPoll, stopTalkToBell]);

  /** Publish mic to /doorbell page (audio only — no video there). */
  const startTalkToBell = useCallback(
    async (mic: MediaStream) => {
      await stopTalkToBell();
      const track = mic.getAudioTracks()[0];
      if (!track) return;

      const pc = new RTCPeerConnection({ iceServers: DOOR_LIVE_ICE });
      talkPcRef.current = pc;
      // Send caregiver mic + receive doorbell visitor mic
      pc.addTransceiver("audio", { direction: "sendrecv" });
      const sender =
        pc.getSenders().find((s) => s.track == null) ?? pc.getSenders()[0];
      if (sender) await sender.replaceTrack(track);
      else pc.addTrack(track, mic);

      pc.ontrack = (e) => {
        if (e.track.kind !== "audio") return;
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        if (bellAudioRef.current) {
          bellAudioRef.current.srcObject = stream;
          void bellAudioRef.current.play().catch(() => {});
        }
        setHearingDoorbellMic(true);
        e.track.onmute = () => setHearingDoorbellMic(false);
        e.track.onunmute = () => setHearingDoorbellMic(true);
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        void fetch("/api/door-live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "care",
            type: "ice",
            candidate: ev.candidate.toJSON(),
          }),
        });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch("/api/door-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "care",
          type: "talk-offer",
          sdp: pc.localDescription,
        }),
      });

      clearTalkPoll();
      talkPollRef.current = window.setInterval(async () => {
        try {
          const res = await fetch("/api/door-live", { cache: "no-store" });
          const data = (await res.json()) as {
            talkAnswer?: RTCSessionDescriptionInit | null;
            talkBellIce?: RTCIceCandidateInit[];
            talking?: boolean;
          };
          if (
            data.talkAnswer &&
            pc.signalingState === "have-local-offer" &&
            !pc.remoteDescription
          ) {
            await pc.setRemoteDescription(data.talkAnswer);
            setBellLinked(true);
          }
          const ices = data.talkBellIce ?? [];
          for (let i = talkBellIceSent.current; i < ices.length; i++) {
            await pc.addIceCandidate(ices[i]).catch(() => {});
          }
          talkBellIceSent.current = ices.length;
          if (data.talking === false) clearTalkPoll();
        } catch {
          // ignore
        }
      }, 250);
      window.setTimeout(() => clearTalkPoll(), 300_000);
    },
    [clearTalkPoll, stopTalkToBell],
  );

  const enablePlaybackAndMic = useCallback(
    async (pc: RTCPeerConnection) => {
      const video = videoRef.current;
      if (video) {
        video.muted = false;
        await video.play().catch(() => {});
      }
      try {
        if (!micStreamRef.current) {
          const mic = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          micStreamRef.current = mic;
        }
        const track = micStreamRef.current.getAudioTracks()[0];
        if (track) {
          track.enabled = true;
          const audioTc = pc
            .getTransceivers()
            .find((t) => t.receiver.track?.kind === "audio");
          if (audioTc) {
            audioTc.direction = "sendrecv";
            await audioTc.sender.replaceTrack(track);
          }
          setMicOn(true);
          // Also push mic to the doorbell browser (visitor hears)
          void startTalkToBell(micStreamRef.current);
        }
      } catch {
        setStreamError("Mic blocked — allow microphone to talk to the door.");
      }
      setNeedsTap(false);
    },
    [startTalkToBell],
  );

  const startDoorLiveViewer = useCallback(
    async (opts?: { withAudio?: boolean }) => {
      const withAudio = opts?.withAudio ?? false;
      if (connectingRef.current) return;
      connectingRef.current = true;
      setBusy(true);
      setStreamError(null);
      setNeedsTap(false);
      await stopStream();
      connectingRef.current = true;
      try {
        let offer: RTCSessionDescriptionInit | null = null;
        let sessionId = 0;
        for (let i = 0; i < 40; i++) {
          const res = await fetch("/api/door-live", { cache: "no-store" });
          const data = (await res.json()) as {
            offer?: RTCSessionDescriptionInit | null;
            sharing?: boolean;
            label?: string;
            sessionId?: number;
          };
          if (data.sharing) setSharingHint(true);
          if (data.offer && data.sharing) {
            offer = data.offer;
            sessionId = data.sessionId ?? 0;
            if (data.label) {
              setActive((prev) =>
                prev ?? {
                  id: `live-${Date.now()}`,
                  at: new Date().toISOString(),
                  label: data.label || "Mom is sharing the door camera",
                  liveAssist: true,
                },
              );
            }
            break;
          }
          await new Promise((r) => setTimeout(r, 400));
        }
        if (!offer) {
          throw new Error(
            "Waiting for Mom’s door camera… tap Tell my caregiver on DoorSense (Mac).",
          );
        }

        sessionSeen.current = sessionId;
        viewIceSent.current = 0;

        const pc = new RTCPeerConnection({ iceServers: DOOR_LIVE_ICE });
        pcRef.current = pc;

        const mediaStream = new MediaStream();
        pc.ontrack = (e) => {
          mediaStream.addTrack(e.track);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.muted = !withAudio;
            void videoRef.current
              .play()
              .then(() => {
                setStreaming(true);
                setInCall(true);
                if (!withAudio) setNeedsTap(true);
              })
              .catch(() => {
                setStreaming(true);
                setInCall(true);
                if (!withAudio) setNeedsTap(true);
              });
          }
        };

        pc.onicecandidate = (ev) => {
          if (!ev.candidate) return;
          void fetch("/api/door-live", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: "view",
              type: "ice",
              candidate: ev.candidate.toJSON(),
            }),
          });
        };

        pc.onconnectionstatechange = () => {
          setConnState(pc.connectionState);
          if (pc.connectionState === "connected") {
            setStreaming(true);
            setInCall(true);
            for (const receiver of pc.getReceivers()) {
              try {
                (
                  receiver as RTCRtpReceiver & { requestKeyFrame?: () => void }
                ).requestKeyFrame?.();
              } catch {
                // ignore
              }
            }
          }
        };

        await pc.setRemoteDescription(offer);

        try {
          const mic = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          micStreamRef.current = mic;
          const audioTrack = mic.getAudioTracks()[0];
          const audioTc = pc
            .getTransceivers()
            .find((t) => t.receiver.track?.kind === "audio");
          if (audioTc && audioTrack) {
            audioTc.direction = "sendrecv";
            await audioTc.sender.replaceTrack(audioTrack);
            if (withAudio) {
              setMicOn(true);
              void startTalkToBell(mic);
            }
          }
        } catch {
          // watch-only until tap / rejoin with audio
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await fetch("/api/door-live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "view",
            type: "answer",
            sdp: pc.localDescription,
          }),
        });

        clearPoll();
        pollRef.current = window.setInterval(async () => {
          try {
            const res = await fetch("/api/door-live", { cache: "no-store" });
            const data = (await res.json()) as {
              sessionId?: number;
              pubIce?: RTCIceCandidateInit[];
              sharing?: boolean;
            };
            if (data.sessionId && data.sessionId !== sessionSeen.current) {
              sessionSeen.current = data.sessionId;
              window.clearInterval(pollRef.current!);
              connectingRef.current = false;
              void startDoorLiveViewer({ withAudio });
              return;
            }
            const ices = data.pubIce ?? [];
            for (let i = viewIceSent.current; i < ices.length; i++) {
              await pc.addIceCandidate(ices[i]).catch(() => {});
            }
            viewIceSent.current = ices.length;
            if (data.sharing === false) {
              clearPoll();
              setSharingHint(false);
            }
          } catch {
            // ignore
          }
        }, 250);

        window.setTimeout(() => clearPoll(), 300_000);

        if (withAudio) {
          // Ensure playback unmuted after tracks attach
          window.setTimeout(() => {
            if (pcRef.current) void enablePlaybackAndMic(pcRef.current);
          }, 400);
        }
      } catch (e) {
        setStreamError(
          e instanceof Error
            ? e.message
            : "No live feed yet — tap Tell my caregiver on DoorSense (Mac).",
        );
        setStreaming(false);
        setInCall(false);
      } finally {
        setBusy(false);
        connectingRef.current = false;
      }
    },
    [clearPoll, enablePlaybackAndMic, startTalkToBell, stopStream],
  );

  const leaveCall = useCallback(async () => {
    leftOnPurpose.current = true;
    await stopStream();
    setInCall(false);
    setStreaming(false);
    setStreamError(null);
  }, [stopStream]);

  const rejoinCall = useCallback(async () => {
    leftOnPurpose.current = false;
    await startDoorLiveViewer({ withAudio: true });
  }, [startDoorLiveViewer]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/door-sighting?since=${encodeURIComponent(sinceRef.current)}&_=${Date.now()}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { events: AssistEvent[] };
        const batch = [...data.events].reverse();
        for (const e of batch) {
          if (seenRef.current.has(e.id)) continue;
          seenRef.current.add(e.id);
          if (e.at > sinceRef.current) sinceRef.current = e.at;
          if (e.liveAssist) {
            setActive(e);
            if (
              !isLocalDemoHost &&
              !leftOnPurpose.current &&
              !pcRef.current &&
              !connectingRef.current
            ) {
              void startDoorLiveViewer({ withAudio: false });
            }
          }
        }
      } catch {
        // ignore
      }
    };
    void tick();
    const id = window.setInterval(tick, 800);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isLocalDemoHost, startDoorLiveViewer]);

  // Keep poll deps stable — busy/inCall used to restart this every connect flicker
  const inCallRef = useRef(inCall);
  const busyRef = useRef(busy);
  inCallRef.current = inCall;
  busyRef.current = busy;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/door-live", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          sharing?: boolean;
          offer?: RTCSessionDescriptionInit | null;
          label?: string;
        };
        if (data.sharing && data.offer) {
          setSharingHint(true);
          setActive((prev) =>
            prev ?? {
              id: `share-${Date.now()}`,
              at: new Date().toISOString(),
              label: data.label || "Mom is sharing the door camera",
              liveAssist: true,
            },
          );
          if (
            !isLocalDemoHost &&
            !leftOnPurpose.current &&
            !inCallRef.current &&
            !busyRef.current &&
            !pcRef.current &&
            !connectingRef.current
          ) {
            void startDoorLiveViewer({ withAudio: false });
          }
        } else if (!data.sharing) {
          setSharingHint(false);
        }
      } catch {
        // ignore
      }
    };
    void tick();
    const id = window.setInterval(tick, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isLocalDemoHost, startDoorLiveViewer]);

  useEffect(() => {
    return () => {
      void stopStream();
    };
  }, [stopStream]);

  if (!active) {
    if (hideIdle) return null;
    return (
      <div className="rounded-[1.15rem] border border-white/12 bg-black/35 px-3.5 py-3 backdrop-blur-md">
        <p className="eyebrow opacity-70">Live door assist</p>
        <p className="text-sm text-white/75 mt-1 leading-snug">
          {sharingHint
            ? "Mom is sharing — connecting…"
            : "Listening for Mom’s “Tell my caregiver”…"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.25rem] border border-[var(--accent-urgent)]/55 bg-[var(--accent-urgent)]/14 p-3.5 space-y-3 backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow text-[#ffc0cd]">Live door assist</p>
          <p className="text-sm font-semibold text-white mt-1 tracking-tight">
            {active.label}
          </p>
          <p className="text-xs text-white/55 mt-1 leading-snug">
            {isLocalDemoHost && !streaming
              ? "Mac preview only — use the Cloudflare link on your phone."
              : !inCall
                ? "Left the call — tap Rejoin for video + sound."
                : streaming
                  ? `Live${connState ? ` · ${connState}` : ""}${micOn ? " · mic on" : ""}${bellLinked ? " · doorbell linked" : ""}${hearingDoorbellMic ? " · hearing doorbell mic" : ""}`
                  : "Connecting to door camera…"}
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-white/55 hover:text-white/80 px-2 shrink-0"
          onClick={() => {
            void stopStream();
            setActive(null);
          }}
        >
          Dismiss
        </button>
      </div>
      <audio ref={bellAudioRef} autoPlay playsInline className="hidden" />

      <div className="relative overflow-hidden rounded-[1rem] bg-black aspect-video border border-white/12">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          autoPlay
        />
        {!inCall && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white/80 bg-black/70">
            You left the live assist.
            <br />
            Rejoin to hear and speak again.
          </div>
        )}
        {inCall && !streaming && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white/65">
            {busy
              ? "Connecting…"
              : streamError || "Waiting for Mom’s camera share…"}
          </div>
        )}
        {needsTap && inCall && streaming && pcRef.current && (
          <button
            type="button"
            className="absolute inset-0 grid place-items-center bg-black/55 text-white"
            onClick={() => {
              if (pcRef.current) void enablePlaybackAndMic(pcRef.current);
            }}
          >
            <span className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">
              Tap for sound + talk to the door
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {inCall ? (
          <button
            type="button"
            className="text-xs font-semibold rounded-full px-3.5 py-1.5 bg-[var(--accent-urgent)] text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void leaveCall()}
          >
            Leave
          </button>
        ) : (
          <button
            type="button"
            className="text-xs font-semibold rounded-full px-3.5 py-1.5 bg-white text-black disabled:opacity-50"
            disabled={busy}
            onClick={() => void rejoinCall()}
          >
            Rejoin
          </button>
        )}
        {inCall && (
          <button
            type="button"
            className={`text-xs font-semibold rounded-full px-3.5 py-1.5 border ${
              micOn
                ? "bg-[var(--accent-brand)] text-[#06210c] border-transparent"
                : "bg-white/12 text-white border-white/20"
            }`}
            disabled={busy || !pcRef.current}
            onClick={() => {
              if (!pcRef.current) return;
              if (micOn && micStreamRef.current) {
                micStreamRef.current.getAudioTracks().forEach((t) => {
                  t.enabled = !t.enabled;
                });
                const on = micStreamRef.current
                  .getAudioTracks()
                  .some((t) => t.enabled);
                setMicOn(on);
                return;
              }
              void enablePlaybackAndMic(pcRef.current);
            }}
          >
            {micOn ? "Mic on · mute" : "Enable mic"}
          </button>
        )}
        <Link
          href="/escalation"
          className="text-xs font-semibold rounded-full px-3.5 py-1.5 bg-white/12 text-white border border-white/20"
        >
          Open alerts
        </Link>
      </div>
    </div>
  );
}
