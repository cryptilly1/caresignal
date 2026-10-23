"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  abortListen,
  canListen,
  isSecureMediaContext,
  listenOnceDetailed,
  parseDoorSenseIntent,
  silenceSpeech,
  speakAsync,
} from "@/lib/speech";
import { useStore } from "@/lib/store";

type Pending = {
  id: string;
  at: string;
  label: string;
  source: string;
} | null;

type Choice = "expecting" | "tell_caregiver" | "need_help" | "dismiss";

const CHOICES: {
  id: Choice;
  label: string;
  hint: string;
  tone: "default" | "help";
}[] = [
  {
    id: "expecting",
    label: "I’m expecting someone",
    hint: "No caregiver alert",
    tone: "default",
  },
  {
    id: "tell_caregiver",
    label: "Tell my caregiver",
    hint: "Share the door view with Elias",
    tone: "default",
  },
  {
    id: "need_help",
    label: "I need help",
    hint: "Urgent · escalate if needed",
    tone: "help",
  },
  {
    id: "dismiss",
    label: "Not now",
    hint: "Dismiss for now",
    tone: "default",
  },
];

function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconPerson({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 19c1.2-3.2 3.4-4.8 6.5-4.8s5.3 1.6 6.5 4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconShare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.2 10.8 15.8 6.4M8.2 13.2l7.6 4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5a5 5 0 0 0-5 5v2.2c0 .7-.2 1.3-.6 1.9L5 15h14l-1.4-2.4c-.4-.6-.6-1.2-.6-1.9V8.5a5 5 0 0 0-5-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 18a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15.5 4.2A7.5 7.5 0 1 0 19.8 14 6.2 6.2 0 0 1 15.5 4.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMic({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="3.5"
        width="6"
        height="11"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMicOff({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 9.2V8.5a3 3 0 0 1 5.7-1.3M15 11.2V14.5a3 3 0 0 1-4.6 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.5 11.5a5.5 5.5 0 0 0 8.7 4.5M12 17v3.5M4 4l16 16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function choiceIcon(id: Choice, className: string) {
  switch (id) {
    case "expecting":
      return <IconPerson className={className} />;
    case "tell_caregiver":
      return <IconShare className={className} />;
    case "need_help":
      return <IconBell className={className} />;
    case "dismiss":
      return <IconMoon className={className} />;
  }
}

/**
 * Living-room TV surface: DoorSense as a corner/side overlay while
 * “watching.” Remote D-pad + mic (speech). Open full-screen on Fire TV /
 * smart TV browser — not a native Fire TV app.
 */
export default function TvDoorSensePage() {
  const { setCurrentUser } = useStore();
  const [pending, setPending] = useState<Pending>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const announcedRef = useRef<string | null>(null);
  const pendingRef = useRef<Pending>(null);
  const listeningRef = useRef(false);
  const listenAbortRef = useRef<AbortController | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const micRef = useRef<HTMLButtonElement | null>(null);
  const voiceSupported = canListen() && isSecureMediaContext();

  pendingRef.current = pending;
  listeningRef.current = listening;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/doorsense", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { pending: Pending };
      setPending(data.pending);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setCurrentUser("mom");
    void refresh();
    const id = window.setInterval(() => void refresh(), 900);
    return () => window.clearInterval(id);
  }, [refresh, setCurrentUser]);

  const stopListen = useCallback(() => {
    listenAbortRef.current?.abort();
    listenAbortRef.current = null;
    abortListen();
    setListening(false);
  }, []);

  const respond = useCallback(async (choice: Choice) => {
    try {
      stopListen();
      await silenceSpeech(80);
      const res = await fetch("/api/doorsense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "respond", choice }),
      });
      const data = (await res.json()) as {
        response?: { label: string } | null;
      };
      setPending(null);
      setHeard(null);
      if (!data.response) {
        setFlash("Nothing pending.");
        void speakAsync("Nothing pending right now.");
        return;
      }
      const messages: Record<Choice, string> = {
        expecting: "Okay. You’re expecting someone.",
        tell_caregiver:
          "Your care giver has been notified. Open Door Sense on the tablet if they need the camera.",
        need_help: "Help request sent to your care giver.",
        dismiss: "Okay. Dismissed.",
      };
      setFlash(
        choice === "tell_caregiver"
          ? "Your caregiver has been notified. Open DoorSense on the tablet if they need the camera."
          : choice === "need_help"
            ? "Help request sent to your caregiver."
            : messages[choice],
      );
      void speakAsync(messages[choice]);
      window.setTimeout(() => setFlash(null), 5000);
    } catch {
      setFlash("Could not send. Check the server.");
      void speakAsync("Could not send.");
    }
  }, [stopListen]);

  const startListen = useCallback(
    async (opts?: { prompt?: boolean }) => {
      const current = pendingRef.current;
      if (!current || listeningRef.current) return;

      if (!canListen()) {
        setFlash("Voice isn’t supported in this browser. Use the remote arrows.");
        void speakAsync("Voice isn’t supported here. Use the remote arrows.");
        window.setTimeout(() => setFlash(null), 4000);
        return;
      }
      if (!isSecureMediaContext()) {
        setFlash("Microphone needs HTTPS or localhost.");
        void speakAsync("Microphone needs a secure connection.");
        window.setTimeout(() => setFlash(null), 4000);
        return;
      }

      const ac = new AbortController();
      listenAbortRef.current?.abort();
      listenAbortRef.current = ac;

      setListening(true);
      setHeard(null);
      setFlash(null);

      try {
        // User-gesture path: unlock mic permission before TTS (Chrome)
        if (opts?.prompt !== false && navigator.mediaDevices?.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            stream.getTracks().forEach((t) => t.stop());
          } catch {
            setListening(false);
            setFlash(
              "Microphone permission blocked — allow mic for this site, then try again.",
            );
            void speakAsync(
              "Microphone permission is blocked. Allow the mic for this site, then try again.",
            );
            window.setTimeout(() => setFlash(null), 5000);
            return;
          }
        }

        if (opts?.prompt !== false) {
          await speakAsync(
            "I'm listening. Say tell my care giver, I need help, I'm expecting someone, or not now.",
          );
        } else {
          await silenceSpeech(200);
        }

        if (ac.signal.aborted || pendingRef.current?.id !== current.id) {
          setListening(false);
          return;
        }

        const { transcript, error } = await listenOnceDetailed(10000, ac.signal);
        if (ac.signal.aborted || pendingRef.current?.id !== current.id) {
          setListening(false);
          return;
        }
        setListening(false);

        if (!transcript) {
          setHeard(null);
          const networkFail =
            !!error && /Chrome with internet|network/i.test(error);
          const msg =
            error && error !== "aborted" && error !== "no-speech"
              ? error
              : "Didn’t catch that — try Press to speak again, or use the remote.";
          setFlash(msg);
          void speakAsync(
            networkFail
              ? "Voice isn’t available in this window. Use the remote arrows, or open this page in Google Chrome."
              : error && error !== "aborted" && error !== "no-speech"
                ? "I couldn’t listen just then. Try Press to speak again, or use the remote."
                : "I didn’t catch that. Press to speak and try again, or use the remote.",
          );
          window.setTimeout(() => setFlash(null), networkFail ? 7000 : 5000);
          return;
        }

        setHeard(transcript);
        const intent = parseDoorSenseIntent(transcript);
        if (intent) {
          const idx = CHOICES.findIndex((c) => c.id === intent);
          if (idx >= 0) setFocusIdx(idx);
          await respond(intent);
          return;
        }

        setFlash(
          `Heard “${transcript}”. Try: tell my caregiver, I need help, expecting, or not now.`,
        );
        void speakAsync(
          `I heard ${transcript}. Try saying tell my care giver, I need help, I'm expecting someone, or not now.`,
        );
        window.setTimeout(() => setFlash(null), 5500);
      } catch {
        setListening(false);
        setFlash("Couldn’t start listening — try Press to speak again.");
        window.setTimeout(() => setFlash(null), 4000);
      } finally {
        if (listenAbortRef.current === ac) listenAbortRef.current = null;
      }
    },
    [respond],
  );

  useEffect(() => {
    if (!pending) {
      stopListen();
      return;
    }
    if (announcedRef.current === pending.id) return;
    announcedRef.current = pending.id;
    setFocusIdx(0);
    setHeard(null);

    // Don’t auto-open the mic — Chrome’s cloud speech often fails with a fake
    // "network" error unless the user presses Press to speak (user gesture).
    const voiceHint = voiceSupported
      ? " Press to speak when you’re ready, or use the remote arrows."
      : " Use the remote arrows to choose.";

    void speakAsync(
      `${pending.label}. Use the remote to choose, or say tell your care giver, ask for help, or dismiss.${voiceHint}`,
    );
  }, [pending, voiceSupported, stopListen]);

  useEffect(() => {
    if (!pending) return;
    if (listening) {
      micRef.current?.focus();
      return;
    }
    btnRefs.current[focusIdx]?.focus();
  }, [focusIdx, pending, listening]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (listening) {
        if (e.key === "Escape" || e.key === "Backspace") {
          e.preventDefault();
          stopListen();
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setFocusIdx((i) => (i + 1) % CHOICES.length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusIdx((i) => (i - 1 + CHOICES.length) % CHOICES.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        btnRefs.current[focusIdx]?.click();
      } else if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        void respond("dismiss");
      } else if (e.key === "m" || e.key === "M" || e.key === "Microphone") {
        e.preventDefault();
        void startListen({ prompt: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, focusIdx, respond, startListen, listening, stopListen]);

  async function demoRing() {
    await fetch("/api/ring/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "ding",
        label: "Doorbell · TV DoorSense demo",
      }),
    });
    await refresh();
  }

  return (
    <div className="tv-stage relative min-h-screen overflow-hidden text-white">
      <div
        className="absolute inset-0 bg-[#102D2C]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/tv/field-kitchen-garden.jpg)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[230px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(16,45,44,0.4) 0%, rgba(16,45,44,0) 100%)",
        }}
        aria-hidden
      />

      <div className="absolute left-8 top-8 z-10 sm:left-12 sm:top-10">
        <p className="text-[15px] font-semibold tracking-[0.04em] text-white/90">
          <span className="font-bold">FIELD</span>
          <span className="mx-2 text-white/45">|</span>
          <span className="font-normal text-white/80">The kitchen garden</span>
        </p>
      </div>

      {flash && (
        <div className="absolute left-1/2 top-8 z-40 max-w-xl -translate-x-1/2 rounded-2xl border border-white/25 bg-[#24695E] px-6 py-3 text-center text-lg font-semibold text-white shadow-xl">
          {flash}
        </div>
      )}

      {!pending && (
        <div className="absolute bottom-8 right-8 z-20 flex flex-col items-end gap-3 sm:bottom-10 sm:right-10">
          <div className="flex items-center gap-3 rounded-[20px] border border-white/15 bg-[#102D2C]/82 px-4 py-3 shadow-2xl backdrop-blur-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
              <IconBell className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-tight text-white">
                Listening for the door
              </p>
              <p className="text-[12px] text-white/55">
                DoorSense · Room mic off
              </p>
            </div>
          </div>
          <button
            type="button"
            className="tv-btn rounded-xl border border-white/20 bg-black/45 px-4 py-2.5 text-sm font-semibold text-white/85 backdrop-blur-sm transition hover:bg-black/55"
            onClick={() => void demoRing()}
          >
            Demo: ring the doorbell
          </button>
          <Link
            href="/doorsense"
            className="text-xs text-white/35 transition hover:text-white/55"
          >
            Full DoorSense (tablet) →
          </Link>
        </div>
      )}

      {pending && (
        <aside
          className="tv-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Someone at the door"
        >
          <div className="tv-drawer__glass" aria-hidden />
          <div className="tv-drawer__wash" aria-hidden />

          <div className="tv-drawer__body">
            <div className="tv-drawer__brand">
              <span className="tv-drawer__mark">
                <IconHeart className="h-[18px] w-[18px]" />
              </span>
              <p className="tv-drawer__brand-text">
                <span className="font-bold">DoorSense</span>
                <span className="tv-drawer__brand-by"> by CareSignal</span>
              </p>
            </div>

            <h1 className="tv-drawer__title">
              {listening ? "How can we help?" : "Someone is at the door"}
            </h1>

            <div className="tv-drawer__cam">
              <div
                className="tv-drawer__cam-img"
                style={{
                  backgroundImage: "url(/tv/front-door-visitor.jpg)",
                }}
                role="img"
                aria-label="Live front door camera"
              />
              <div className="tv-drawer__cam-fade" aria-hidden />
              <div className="tv-drawer__live">
                <span className="tv-drawer__live-dot" />
                Live · Front door
              </div>
              <p className="tv-drawer__viewing">Only you are viewing</p>
            </div>
            <p className="tv-drawer__caption">A person holding a parcel.</p>

            {listening ? (
              <div className="tv-drawer__listen">
                <div className="tv-drawer__listen-card">
                  <IconMic className="mt-0.5 h-6 w-6 shrink-0 text-[#24695E]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-bold text-[#102D2C]">
                      Listening to you…
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#183D3B]/65">
                      {heard
                        ? `Heard “${heard}”`
                        : "Say a choice, like “Tell my caregiver.”"}
                    </p>
                  </div>
                  <div className="tv-wave" aria-hidden>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </div>
                </div>
                <p className="tv-drawer__mic-note">
                  Mic on for DoorSense only. Neither Elias nor the visitor can
                  hear you.
                </p>
                <button
                  ref={micRef}
                  type="button"
                  className="tv-btn tv-drawer__choice tv-drawer__choice--focus tv-drawer__stop"
                  onClick={() => stopListen()}
                >
                  <span className="tv-drawer__choice-icon">
                    <IconMicOff className="h-5 w-5" />
                  </span>
                  <span className="tv-drawer__choice-label">Stop listening</span>
                  <span className="tv-drawer__ok">OK</span>
                </button>
                <p className="tv-drawer__footer-note">
                  Mic turns off when you finish.
                </p>
              </div>
            ) : (
              <>
                <div className="tv-drawer__choices">
                  {CHOICES.map((c, i) => {
                    const focused = focusIdx === i;
                    const help = c.tone === "help";
                    return (
                      <button
                        key={c.id}
                        ref={(el) => {
                          btnRefs.current[i] = el;
                        }}
                        type="button"
                        className={`tv-btn tv-drawer__choice${
                          focused
                            ? " tv-drawer__choice--focus"
                            : help
                              ? " tv-drawer__choice--help"
                              : ""
                        }`}
                        onFocus={() => setFocusIdx(i)}
                        onMouseEnter={() => setFocusIdx(i)}
                        onClick={() => void respond(c.id)}
                      >
                        <span className="tv-drawer__choice-icon">
                          {choiceIcon(c.id, "h-5 w-5")}
                        </span>
                        <span className="tv-drawer__choice-text">
                          <span className="tv-drawer__choice-label">
                            {c.label}
                          </span>
                          {focused && (
                            <span className="tv-drawer__choice-hint">
                              {c.hint}
                            </span>
                          )}
                        </span>
                        {focused && <span className="tv-drawer__ok">OK</span>}
                      </button>
                    );
                  })}
                </div>

                <button
                  ref={micRef}
                  type="button"
                  className="tv-btn tv-drawer__speak"
                  onClick={() => void startListen({ prompt: true })}
                  aria-pressed={false}
                >
                  <IconMic className="h-5 w-5 shrink-0 text-[#24695E]" />
                  <span>Press to speak</span>
                </button>
                <p className="tv-drawer__footer-note">
                  Room mic off · Visitor cannot hear you
                </p>
              </>
            )}
          </div>
        </aside>
      )}

      <style jsx global>{`
        /* Figma TV DoorSense drawer — 648×972 @ 1920×1080 */
        .tv-drawer {
          --tv-ink: #102d2c;
          --tv-ink-soft: #183d3b;
          --tv-teal: #24695e;
          --tv-help: #a3352e;
          --tv-help-bg: rgba(249, 236, 232, 0.8);
          --tv-cream: rgba(247, 246, 239, 0.72);
          --tv-speak: rgba(237, 235, 244, 0.8);
          --tv-stroke: #cbd8d0;
          position: absolute;
          top: 54px;
          right: 64px;
          z-index: 30;
          display: flex;
          width: 648px;
          height: 972px;
          max-width: calc(100vw - 48px);
          max-height: calc(100vh - 48px);
          flex-direction: column;
          overflow: hidden;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.502);
          box-shadow: -8px 8px 40px rgba(16, 45, 44, 0.251);
          color: var(--tv-ink);
        }
        .tv-drawer__glass {
          pointer-events: none;
          position: absolute;
          inset: 0;
          border-radius: 28px;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.4) 0%,
              rgba(255, 255, 255, 0) 100%
            ),
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.12) 0%,
              rgba(255, 255, 255, 0.12) 100%
            ),
            var(--tv-cream);
          backdrop-filter: blur(28px) saturate(1.2);
          -webkit-backdrop-filter: blur(28px) saturate(1.2);
        }
        .tv-drawer__wash {
          pointer-events: none;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 210px;
          border-radius: 28px 28px 0 0;
          background: linear-gradient(
            180deg,
            #f5e8d9 0%,
            #e7ebe7 50%,
            rgba(237, 235, 244, 0) 100%
          );
          opacity: 0.85;
        }
        .tv-drawer__body {
          position: relative;
          z-index: 10;
          display: flex;
          height: 100%;
          flex-direction: column;
          padding: 32px 32px 28px;
          box-sizing: border-box;
        }
        .tv-drawer__brand {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 38px;
        }
        .tv-drawer__mark {
          display: flex;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: var(--tv-teal);
          color: #fff;
        }
        .tv-drawer__brand-text {
          margin: 0;
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--tv-ink-soft);
        }
        .tv-drawer__brand-by {
          font-weight: 500;
          color: rgba(24, 61, 59, 0.72);
        }
        .tv-drawer__title {
          margin: 18px 0 0;
          font-family:
            "SF Pro Display",
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            system-ui,
            sans-serif;
          font-size: 36px;
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.03em;
          color: var(--tv-ink);
        }
        .tv-drawer__cam {
          position: relative;
          margin-top: 28px;
          width: 100%;
          height: 224px;
          flex-shrink: 0;
          overflow: hidden;
          border-radius: 16px;
          background: var(--tv-ink);
        }
        .tv-drawer__cam-img {
          width: 100%;
          height: 100%;
          background-size: cover;
          background-position: center;
        }
        .tv-drawer__cam-fade {
          pointer-events: none;
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(16, 45, 44, 0) 45%,
            rgba(16, 45, 44, 0.9) 100%
          );
        }
        .tv-drawer__live {
          position: absolute;
          top: 14px;
          left: 14px;
          display: inline-flex;
          height: 43px;
          align-items: center;
          gap: 8px;
          border-radius: 10px;
          background: var(--tv-ink);
          padding: 0 14px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #fff;
        }
        .tv-drawer__live-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #3dd68c;
          box-shadow: 0 0 0 3px rgba(61, 214, 140, 0.25);
        }
        .tv-drawer__viewing {
          position: absolute;
          bottom: 14px;
          left: 14px;
          margin: 0;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }
        .tv-drawer__caption {
          margin: 14px 0 0;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.25;
          color: rgba(24, 61, 59, 0.82);
        }
        .tv-drawer__choices {
          display: flex;
          flex: 1;
          flex-direction: column;
          justify-content: flex-end;
          gap: 10.5px;
          margin-top: 22px;
          min-height: 0;
        }
        .tv-drawer__choice {
          display: flex;
          width: 100%;
          min-height: 69px;
          align-items: center;
          gap: 14px;
          border-radius: 15.5px;
          border: 1px solid var(--tv-stroke);
          background: rgba(255, 255, 255, 0.8);
          padding: 0 18px;
          text-align: left;
          color: var(--tv-ink);
          backdrop-filter: blur(9px);
          -webkit-backdrop-filter: blur(9px);
          transition:
            background 120ms ease,
            color 120ms ease,
            border-color 120ms ease,
            min-height 120ms ease;
        }
        .tv-drawer__choice--help {
          border-color: var(--tv-stroke);
          background: var(--tv-help-bg);
          color: var(--tv-help);
        }
        .tv-drawer__choice--focus {
          min-height: 97px;
          border: 4px solid var(--tv-ink-soft);
          background: var(--tv-teal);
          color: #fff;
          box-shadow: none;
        }
        .tv-drawer__choice-icon {
          display: flex;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(36, 105, 94, 0.1);
          color: var(--tv-teal);
        }
        .tv-drawer__choice--help .tv-drawer__choice-icon {
          background: rgba(163, 53, 46, 0.1);
          color: var(--tv-help);
        }
        .tv-drawer__choice--focus .tv-drawer__choice-icon {
          background: rgba(255, 255, 255, 0.16);
          color: #fff;
        }
        .tv-drawer__choice-text {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          gap: 2px;
        }
        .tv-drawer__choice-label {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 1.15;
        }
        .tv-drawer__choice-hint {
          font-size: 14px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.78);
        }
        .tv-drawer__ok {
          display: inline-flex;
          width: 40px;
          height: 34px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          border: 2px solid #fff;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #fff;
        }
        .tv-drawer__speak {
          display: flex;
          width: 100%;
          height: 64px;
          flex-shrink: 0;
          align-items: center;
          gap: 12px;
          margin-top: 31px;
          border: none;
          border-radius: 16px;
          background: var(--tv-speak);
          padding: 0 20px;
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: var(--tv-ink);
          backdrop-filter: blur(9px);
          -webkit-backdrop-filter: blur(9px);
        }
        .tv-drawer__footer-note {
          margin: 10px 0 0;
          text-align: center;
          font-size: 13px;
          font-weight: 500;
          color: rgba(24, 61, 59, 0.48);
        }
        .tv-drawer__listen {
          display: flex;
          flex: 1;
          flex-direction: column;
          margin-top: 22px;
          min-height: 0;
        }
        .tv-drawer__listen-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          border-radius: 16px;
          border: 1px solid rgba(201, 212, 232, 0.8);
          background: rgba(232, 234, 245, 0.75);
          padding: 18px 20px;
        }
        .tv-drawer__mic-note {
          margin: 12px 0 0;
          font-size: 13px;
          line-height: 1.35;
          color: rgba(24, 61, 59, 0.55);
        }
        .tv-drawer__stop {
          margin-top: auto;
        }
        .tv-btn:focus-visible {
          outline: none;
        }
        .tv-wave {
          display: flex;
          height: 32px;
          align-items: flex-end;
          gap: 3px;
        }
        .tv-wave span {
          display: block;
          width: 3px;
          border-radius: 999px;
          background: #24695e;
          height: 30%;
          animation: tv-wave 0.9s ease-in-out infinite;
        }
        .tv-wave span:nth-child(2),
        .tv-wave span:nth-child(8) {
          height: 55%;
        }
        .tv-wave span:nth-child(3),
        .tv-wave span:nth-child(7) {
          height: 80%;
        }
        .tv-wave span:nth-child(4),
        .tv-wave span:nth-child(6) {
          height: 100%;
        }
        .tv-wave span:nth-child(5) {
          height: 70%;
        }
        @keyframes tv-wave {
          0%,
          100% {
            transform: scaleY(0.45);
            opacity: 0.7;
          }
          50% {
            transform: scaleY(1);
            opacity: 1;
          }
        }
        @media (max-width: 1100px), (max-height: 980px) {
          .tv-drawer {
            top: max(16px, 3vh);
            right: max(16px, 2vw);
            width: min(648px, 42vw, calc(100vw - 32px));
            height: min(972px, calc(100vh - 32px));
          }
          .tv-drawer__title {
            font-size: clamp(28px, 3.2vw, 36px);
          }
          .tv-drawer__cam {
            height: clamp(160px, 22vh, 224px);
            margin-top: 18px;
          }
          .tv-drawer__live {
            height: 36px;
            font-size: 12px;
          }
          .tv-drawer__choice {
            min-height: 58px;
          }
          .tv-drawer__choice--focus {
            min-height: 78px;
          }
          .tv-drawer__speak {
            height: 56px;
            margin-top: 18px;
          }
        }
        @media (max-width: 900px) {
          .tv-drawer {
            top: 0;
            right: 0;
            bottom: 0;
            width: min(100%, 420px);
            height: 100%;
            max-width: none;
            max-height: none;
            border-radius: 0;
            border-right: none;
            border-top: none;
            border-bottom: none;
          }
        }
      `}</style>
    </div>
  );
}
