"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DOOR_LIVE_ICE } from "@/lib/webrtc-ice";

/**
 * Doorbell stand-in (separate browser):
 * - Plays caregiver talk-back (no video)
 * - Sends visitor mic to caregiver so you can mute DoorSense mic and still hear the door
 */
export default function DoorbellPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const momPcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const careIceSent = useRef(0);
  const momViewIceSent = useRef(0);
  const talkSessionSeen = useRef(0);
  const pollRef = useRef<number | null>(null);
  const momPollRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"idle" | "waiting" | "live" | "error">(
    "waiting",
  );
  const [hearing, setHearing] = useState(false);
  const [level, setLevel] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [speakerVolume, setSpeakerVolume] = useState(1);
  const [micMuted, setMicMuted] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [momLinked, setMomLinked] = useState(false);

  const clearPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearMomPoll = useCallback(() => {
    if (momPollRef.current != null) {
      window.clearInterval(momPollRef.current);
      momPollRef.current = null;
    }
  }, []);

  const stopMomLink = useCallback(async () => {
    clearMomPoll();
    momPcRef.current?.close();
    momPcRef.current = null;
    momViewIceSent.current = 0;
    setMomLinked(false);
    await fetch("/api/door-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "bell-mom-stop", role: "bellmom" }),
    }).catch(() => {});
  }, [clearMomPoll]);

  /** Second link: door mic → care receiver (DoorSense) */
  const publishMicToMom = useCallback(
    async (mic: MediaStream) => {
      await stopMomLink();
      const track = mic.getAudioTracks()[0];
      if (!track) return;

      const pc = new RTCPeerConnection({ iceServers: DOOR_LIVE_ICE });
      momPcRef.current = pc;
      pc.addTransceiver("audio", { direction: "sendonly" });
      const sender =
        pc.getSenders().find((s) => s.track == null) ?? pc.getSenders()[0];
      if (sender) await sender.replaceTrack(track);
      else pc.addTrack(track, mic);

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        void fetch("/api/door-live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "bellmom",
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
          role: "bellmom",
          type: "bell-mom-offer",
          sdp: pc.localDescription,
        }),
      });

      clearMomPoll();
      momPollRef.current = window.setInterval(async () => {
        try {
          const res = await fetch("/api/door-live", { cache: "no-store" });
          const data = (await res.json()) as {
            bellMomAnswer?: RTCSessionDescriptionInit | null;
            bellMomViewIce?: RTCIceCandidateInit[];
            bellMomLive?: boolean;
          };
          if (
            data.bellMomAnswer &&
            pc.signalingState === "have-local-offer" &&
            !pc.remoteDescription
          ) {
            await pc.setRemoteDescription(data.bellMomAnswer);
            setMomLinked(true);
          }
          const ices = data.bellMomViewIce ?? [];
          for (let i = momViewIceSent.current; i < ices.length; i++) {
            await pc.addIceCandidate(ices[i]).catch(() => {});
          }
          momViewIceSent.current = ices.length;
          if (data.bellMomLive === false) clearMomPoll();
        } catch {
          // ignore
        }
      }, 250);
    },
    [clearMomPoll, stopMomLink],
  );

  const hangup = useCallback(() => {
    clearPoll();
    void stopMomLink();
    pcRef.current?.close();
    pcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    careIceSent.current = 0;
    if (audioRef.current) audioRef.current.srcObject = null;
    setHearing(false);
    setLevel(0);
    setMicLevel(0);
    setMicOn(false);
    setStatus("waiting");
  }, [clearPoll, stopMomLink]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = speakerVolume;
  }, [speakerVolume]);

  useEffect(() => {
    const tracks = micRef.current?.getAudioTracks() ?? [];
    for (const t of tracks) t.enabled = !micMuted;
  }, [micMuted]);

  const joinTalk = useCallback(
    async (offer: RTCSessionDescriptionInit, talkSessionId: number) => {
      hangup();
      talkSessionSeen.current = talkSessionId;
      careIceSent.current = 0;
      setError(null);
      setStatus("waiting");

      const pc = new RTCPeerConnection({ iceServers: DOOR_LIVE_ICE });
      pcRef.current = pc;

      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        if (audioRef.current) {
          audioRef.current.srcObject = stream;
          audioRef.current.volume = speakerVolume;
          audioRef.current.muted = true;
          void audioRef.current
            .play()
            .then(() => {
              setNeedsTap(true);
              setStatus("live");
            })
            .catch(() => {
              setNeedsTap(true);
              setStatus("live");
            });
        }
        e.track.onunmute = () => setHearing(true);
        e.track.onmute = () => setHearing(false);

        try {
          const ctx = new AudioContext();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!pcRef.current) return;
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setLevel(avg);
            setHearing(avg > 8);
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        } catch {
          // meter optional
        }
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        void fetch("/api/door-live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "bell",
            type: "ice",
            candidate: ev.candidate.toJSON(),
          }),
        });
      };

      await pc.setRemoteDescription(offer);

      // Door mic → caregiver (mute DoorSense mic to isolate this path)
      try {
        const mic = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        micRef.current = mic;
        const track = mic.getAudioTracks()[0];
        if (track) {
          track.enabled = true;
          const audioTc = pc
            .getTransceivers()
            .find((t) => t.receiver.track?.kind === "audio");
          if (audioTc) {
            audioTc.direction = "sendrecv";
            await audioTc.sender.replaceTrack(track);
          } else {
            pc.addTrack(track, mic);
          }
          setMicOn(true);
          setMicMuted(false);
          // Also send this mic to care receiver (DoorSense)
          void publishMicToMom(mic);

          try {
            const ctx = new AudioContext();
            const src = ctx.createMediaStreamSource(mic);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
              if (!micRef.current) return;
              analyser.getByteFrequencyData(data);
              const avg = data.reduce((a, b) => a + b, 0) / data.length;
              setMicLevel(track.enabled ? avg : 0);
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          } catch {
            // optional
          }
        }
      } catch {
        setError("Allow microphone so the doorbell can send visitor audio.");
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await fetch("/api/door-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "bell",
          type: "talk-answer",
          sdp: pc.localDescription,
        }),
      });

      clearPoll();
      pollRef.current = window.setInterval(async () => {
        try {
          const res = await fetch("/api/door-live", { cache: "no-store" });
          const data = (await res.json()) as {
            talkSessionId?: number;
            talkOffer?: RTCSessionDescriptionInit | null;
            talkCareIce?: RTCIceCandidateInit[];
            talking?: boolean;
          };
          if (
            data.talkSessionId &&
            data.talkSessionId !== talkSessionSeen.current &&
            data.talkOffer &&
            data.talking
          ) {
            void joinTalk(data.talkOffer, data.talkSessionId);
            return;
          }
          const ices = data.talkCareIce ?? [];
          for (let i = careIceSent.current; i < ices.length; i++) {
            await pc.addIceCandidate(ices[i]).catch(() => {});
          }
          careIceSent.current = ices.length;
          if (data.talking === false) {
            hangup();
          }
        } catch {
          // ignore
        }
      }, 250);
    },
    [clearPoll, hangup, publishMicToMom],
  );

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (pcRef.current) return;
      try {
        const res = await fetch("/api/door-live", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          talking?: boolean;
          talkOffer?: RTCSessionDescriptionInit | null;
          talkSessionId?: number;
        };
        if (data.talking && data.talkOffer) {
          void joinTalk(data.talkOffer, data.talkSessionId ?? 0);
        } else {
          setStatus("waiting");
        }
      } catch {
        if (!cancelled) setStatus("waiting");
      }
    };
    void tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      hangup();
    };
  }, [hangup, joinTalk]);

  function unlockAudio() {
    if (audioRef.current) {
      audioRef.current.muted = false;
      audioRef.current.volume = speakerVolume;
      void audioRef.current.play().catch(() => {});
    }
    setNeedsTap(false);
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-8">
      <div>
        <p className="eyebrow opacity-80">Doorbell · audio only</p>
        <h2 className="display text-3xl mt-2 tracking-tight">Front door</h2>
        <p className="mt-2 text-white/60 text-base leading-snug">
          Separate browser from DoorSense. No video — plays caregiver voice and
          sends this mic to the caregiver.
        </p>
      </div>

      <section
        className={`rounded-[1.5rem] border p-8 text-center space-y-4 transition-colors backdrop-blur-md ${
          hearing
            ? "border-[var(--accent-brand)]/55 bg-[var(--accent-brand)]/20"
            : "border-white/15 bg-black/40"
        }`}
      >
        <audio ref={audioRef} autoPlay playsInline />
        <p className="eyebrow opacity-80">
          {status === "live"
            ? hearing
              ? "Hearing caregiver"
              : "Linked · waiting for speech"
            : status === "error"
              ? "Error"
              : "Waiting for caregiver mic"}
        </p>
        <p className="display text-4xl text-white tracking-tight">
          {hearing ? "Speaking…" : "Doorbell"}
        </p>
        <div>
          <p className="eyebrow mb-1.5 opacity-60">Caregiver → speaker</p>
          <div className="mx-auto h-2.5 w-full max-w-xs rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full bg-[var(--accent-brand)] transition-[width] duration-75"
              style={{ width: `${Math.min(100, level * 1.8)}%` }}
            />
          </div>
        </div>
        <div>
          <p className="eyebrow mb-1.5 opacity-60">
            Door mic → caregiver + Mom{" "}
            {micMuted
              ? "(muted)"
              : micOn
                ? momLinked
                  ? "· Mom linked"
                  : ""
                : "(off)"}
          </p>
          <div className="mx-auto h-2.5 w-full max-w-xs rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full bg-[var(--accent-ok)] transition-[width] duration-75"
              style={{ width: `${Math.min(100, micLevel * 1.8)}%` }}
            />
          </div>
        </div>
        {needsTap && (
          <button
            type="button"
            className="btn btn-primary w-full max-w-xs mx-auto"
            onClick={unlockAudio}
          >
            Tap to unmute doorbell speaker
          </button>
        )}
        {error && (
          <p className="text-sm text-[#fecaca]">{error}</p>
        )}
      </section>

      <section className="glass-strong px-4 py-3.5 space-y-3">
        <div className="flex items-center gap-3">
          <label
            className="text-xs font-semibold text-white/65 shrink-0 w-20"
            htmlFor="bell-speaker"
          >
            Speaker
          </label>
          <input
            id="bell-speaker"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={speakerVolume}
            onChange={(e) => setSpeakerVolume(Number(e.target.value))}
            className="flex-1 accent-[var(--accent-brand)]"
          />
          <span className="text-xs text-white/55 w-10 text-right">
            {Math.round(speakerVolume * 100)}%
          </span>
        </div>
        <button
          type="button"
          className={`text-xs font-semibold rounded-full px-3.5 py-1.5 border w-full ${
            micMuted
              ? "bg-[var(--accent-urgent)] text-white border-transparent"
              : "bg-white/12 text-white border-white/20"
          }`}
          onClick={() => setMicMuted((m) => !m)}
        >
          {micMuted ? "Door mic muted · tap to unmute" : "Mute door mic"}
        </button>
      </section>

      <p className="text-sm text-white/45 text-center leading-relaxed">
        Mic goes to caregiver and DoorSense. On{" "}
        <Link
          href="/doorsense"
          className="text-white/65 hover:text-white/85 transition"
        >
          DoorSense
        </Link>{" "}
        mute local mic to isolate this path.
      </p>
    </div>
  );
}
