"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  canListen,
  createHoldToTalk,
  isSecureMediaContext,
  speak,
} from "@/lib/speech";

type SimResult = {
  ok?: boolean;
  speech?: string;
  action?: string;
};

const ACTIONS: { action: string; label: string; hint: string }[] = [
  { action: "im_okay", label: "I’m okay", hint: "Check-in" },
  { action: "medicine", label: "I took my medicine", hint: "Log meds" },
  { action: "walk", label: "I went for a walk", hint: "Log walk" },
  { action: "tell_caregiver", label: "Tell my caregiver", hint: "DoorSense" },
  { action: "need_help", label: "I need help", hint: "Urgent door" },
  { action: "expecting", label: "I’m expecting someone", hint: "DoorSense" },
  { action: "dismiss", label: "Not now", hint: "Dismiss door" },
  { action: "door_status", label: "What’s at the door?", hint: "Status" },
];

/**
 * Alexa bridge — hold-to-talk mic (Echo stand-in) + tap phrases.
 */
export default function AlexaPage() {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [micOk, setMicOk] = useState(false);
  const holdRef = useRef<ReturnType<typeof createHoldToTalk>>(null);
  const pressingRef = useRef(false);

  useEffect(() => {
    setMicOk(canListen() && isSecureMediaContext());
  }, []);

  const runSpeech = useCallback(async (speech: string) => {
    setLast(speech);
    speak(speech);
  }, []);

  const simulate = useCallback(
    async (action: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/alexa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            simulate: true,
            action,
            source: "Simulator",
          }),
        });
        const data = (await res.json()) as SimResult;
        await runSpeech(data.speech ?? "Done.");
      } catch {
        await runSpeech("Could not reach CareSignal.");
      } finally {
        setBusy(false);
      }
    },
    [runSpeech],
  );

  const submitTranscript = useCallback(
    async (text: string) => {
      setBusy(true);
      setHeard(text);
      try {
        const res = await fetch("/api/alexa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            simulate: true,
            text,
            source: "Simulator",
          }),
        });
        const data = (await res.json()) as SimResult;
        await runSpeech(data.speech ?? "Done.");
      } catch {
        await runSpeech("Could not reach CareSignal.");
      } finally {
        setBusy(false);
      }
    },
    [runSpeech],
  );

  const onPressStart = useCallback(
    (e: React.PointerEvent | React.TouchEvent) => {
      e.preventDefault();
      if (pressingRef.current || busy) return;
      if (!canListen() || !isSecureMediaContext()) {
        void runSpeech("Microphone needs Chrome on localhost or HTTPS.");
        return;
      }
      const hold = createHoldToTalk();
      if (!hold) {
        void runSpeech("Voice listen isn’t supported in this browser.");
        return;
      }
      pressingRef.current = true;
      setHolding(true);
      setHeard(null);
      holdRef.current = hold;
      hold.start();
    },
    [busy, runSpeech],
  );

  const onPressEnd = useCallback(async () => {
    if (!pressingRef.current) return;
    pressingRef.current = false;
    setHolding(false);
    const hold = holdRef.current;
    holdRef.current = null;
    if (!hold) return;
    const text = await hold.stop();
    if (text?.trim()) {
      await submitTranscript(text.trim());
    } else {
      await runSpeech("I didn’t catch that. Try again.");
    }
  }, [runSpeech, submitTranscript]);

  useEffect(() => {
    const up = () => {
      if (pressingRef.current) void onPressEnd();
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [onPressEnd]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 space-y-6 text-white">
      <div>
        <p className="eyebrow text-[#38bdf8]">Care receiver · Alexa</p>
        <h1 className="display text-[2.65rem] sm:text-5xl mt-3 tracking-tight">
          Alexa listens
        </h1>
        <p className="mt-3 text-white/60 leading-relaxed max-w-lg">
          No Echo needed — hold the mic and speak (same actions as “Alexa, open
          Care Signal…”).
        </p>
      </div>

      {last && (
        <div className="glass-light px-5 py-4 font-semibold">Alexa: {last}</div>
      )}

      <section className="rounded-[1.45rem] border border-[#38bdf8]/30 bg-[#1c2633]/92 p-7 flex flex-col items-center gap-4 backdrop-blur-md">
        <p className="eyebrow text-[#38bdf8]">Echo mic · hold to speak</p>
        <button
          type="button"
          disabled={busy && !holding}
          aria-pressed={holding}
          aria-label={holding ? "Listening — release to send" : "Hold to speak"}
          className={`relative size-28 rounded-full select-none touch-none transition shadow-lg ${
            holding
              ? "bg-[#38bdf8] scale-110 ring-8 ring-[#38bdf8]/35"
              : "bg-white/12 border-2 border-white/35 hover:bg-white/20"
          } disabled:opacity-50`}
          onPointerDown={onPressStart}
          onPointerUp={() => void onPressEnd()}
          onPointerLeave={() => {
            if (pressingRef.current) void onPressEnd();
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="sr-only">Hold to speak</span>
          <MicIcon listening={holding} />
        </button>
        <p className="text-center text-sm text-white/65 max-w-xs leading-snug">
          {holding
            ? "Listening… release when done"
            : micOk
              ? "Press & hold · say “tell my caregiver” or “I’m okay”"
              : "Mic needs Chrome (or Edge) on localhost / HTTPS"}
        </p>
        {heard && (
          <p className="text-sm text-[var(--accent-warn)] text-center">
            Heard: “{heard}”
          </p>
        )}
      </section>

      <section className="glass-strong p-5 sm:p-6 space-y-3">
        <p className="section-title">Or tap a phrase</p>
        <p className="text-sm text-white/50">
          Same CareSignal actions — caregiver Today sees check-ins and door
          alerts.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {ACTIONS.map((a) => (
            <button
              key={a.action}
              type="button"
              disabled={busy || holding}
              className="list-row text-left disabled:opacity-50"
              onClick={() => void simulate(a.action)}
            >
              <span className="block font-semibold tracking-tight">
                {a.label}
              </span>
              <span className="text-xs text-white/45 mt-0.5 block">{a.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/45 pb-8">
        <a href="/tv" className="hover:text-white/70 transition">
          TV DoorSense
        </a>
        <a href="/doorsense" className="hover:text-white/70 transition">
          Tablet DoorSense
        </a>
        <a href="/recipient" className="hover:text-white/70 transition">
          Check-in cards
        </a>
        <a href="/" className="hover:text-white/70 transition">
          Enter chooser
        </a>
      </div>
    </main>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`absolute inset-0 m-auto size-12 ${
        listening ? "text-[#0b1a24]" : "text-white"
      }`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
    </svg>
  );
}
