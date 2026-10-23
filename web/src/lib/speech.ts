/** Browser TTS + speech recognition helpers (Chrome / Edge / Safari partial). */

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Fix words the default voices routinely mispronounce. */
export function normalizeForSpeech(text: string): string {
  return text
    .replace(/CareSignal/gi, "Care Signal")
    .replace(/DoorSense/gi, "Door Sense")
    .replace(/caregivers?/gi, (m) =>
      m.toLowerCase().endsWith("s") ? "care givers" : "care giver",
    )
    .replace(/Alexa/gi, "Alexa");
}

/** Prefer clear, natural en voices — avoid thin / robotic defaults. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferred = [
    /samantha/i, // macOS — clear American
    /karen/i, // macOS AU, still natural
    /moira/i, // macOS IE
    /google uk english female/i,
    /google us english/i,
    /microsoft aria/i,
    /microsoft jenny/i,
    /microsoft guy/i,
    /enhanced/i,
    /premium/i,
    /neural/i,
    /natural/i,
  ];

  for (const re of preferred) {
    const hit = voices.find(
      (v) => re.test(v.name) && /en(-|_)?(US|GB|AU|IE)?/i.test(v.lang),
    );
    if (hit) return hit;
  }

  // Prefer local en voices (lower latency, often clearer on Mac)
  return (
    voices.find((v) => v.lang === "en-US" && v.localService) ||
    voices.find((v) => /^en(-|_)/i.test(v.lang) && v.localService) ||
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => /^en(-|_)/i.test(v.lang)) ||
    null
  );
}

let voicesReady: Promise<void> | null = null;

function ensureVoices(): Promise<void> {
  if (!canSpeak()) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length) return Promise.resolve();
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve();
    };
    window.speechSynthesis.onvoiceschanged = done;
    window.setTimeout(done, 400);
  });
  return voicesReady;
}

/** Chrome sometimes parks the synth after cancel — keep it alive. */
function kickSpeechSynthesis(): void {
  try {
    window.speechSynthesis.resume();
  } catch {
    // ignore
  }
}

function speakNow(text: string, onEnd?: () => void): void {
  window.speechSynthesis.cancel();
  kickSpeechSynthesis();
  const u = new SpeechSynthesisUtterance(normalizeForSpeech(text));
  const voice = pickVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = "en-US";
  }
  u.volume = 1;
  // Slightly slower + neutral pitch = clearer on TV speakers
  u.rate = 0.88;
  u.pitch = 1;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onEnd?.();
  };
  u.onend = finish;
  u.onerror = finish;
  window.speechSynthesis.speak(u);
  // Safety if onend never fires (Chrome quirk)
  window.setTimeout(finish, Math.min(20000, 1200 + text.length * 70));
}

/**
 * Uses the device’s built-in Speech Synthesis (not Alexa).
 * Pronunciation-normalized; best available en system voice.
 */
export function speak(text: string): void {
  if (!canSpeak()) return;
  void ensureVoices().then(() => {
    try {
      speakNow(text);
    } catch {
      // ignore
    }
  });
}

/** Speak and resolve when the utterance finishes (or fails). */
export function speakAsync(text: string): Promise<void> {
  if (!canSpeak()) return Promise.resolve();
  return ensureVoices().then(
    () =>
      new Promise((resolve) => {
        try {
          speakNow(text, () => resolve());
        } catch {
          resolve();
        }
      }),
  );
}

/** Stop any in-flight TTS and wait briefly so the mic can open cleanly. */
export async function silenceSpeech(ms = 180): Promise<void> {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
    kickSpeechSynthesis();
  } catch {
    // ignore
  }
  await new Promise((r) => window.setTimeout(r, ms));
}

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult:
    | ((ev: {
        results: {
          [i: number]: {
            [j: number]: { transcript: string };
            isFinal?: boolean;
            length: number;
          };
          length: number;
        };
      }) => void)
    | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return getRecognitionCtor() !== null;
}

export function isSecureMediaContext(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  );
}

export type ListenResult = {
  transcript: string | null;
  error: string | null;
};

let activeRec: SpeechRec | null = null;

/** Abort any in-flight listenOnce (e.g. Stop listening). Prefer stop() — abort() often poisons the next start with a fake "network" error in Chromium. */
export function abortListen(): void {
  const rec = activeRec;
  activeRec = null;
  if (!rec) return;
  try {
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.onstart = null;
    rec.stop();
  } catch {
    // ignore
  }
}

function friendlyListenError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission blocked — allow mic for this site, then try again.";
    case "audio-capture":
      return "No microphone found. Check your input device.";
    case "network":
      // Chrome’s Web Speech API is cloud-backed; this also fires in embedded
      // browsers (Cursor preview) even when the machine is online.
      return "Voice needs Google Chrome with internet — open this page in Chrome, or use the remote arrows.";
    case "no-speech":
      return "Didn’t hear anything — hold closer and try Press to speak again.";
    case "aborted":
      return "Listening was interrupted — try Press to speak again.";
    default:
      return "Couldn’t start listening — try Press to speak again, or use the remote.";
  }
}

async function listenOnceAttempt(
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ListenResult> {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    return { transcript: null, error: "Voice isn’t supported in this browser." };
  }
  if (signal?.aborted) {
    return { transcript: null, error: "aborted" };
  }

  return new Promise((resolve) => {
    abortListen();
    const rec = new Ctor();
    activeRec = rec;
    rec.lang = "en-US";
    // continuous + interim is more reliable than one-shot in Chrome
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    let done = false;
    let best = "";
    let sawStart = false;

    const finish = (transcript: string | null, error: string | null) => {
      if (done) return;
      done = true;
      if (activeRec === rec) activeRec = null;
      signal?.removeEventListener("abort", onAbort);
      window.clearTimeout(timer);
      window.clearTimeout(startWatch);
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.onstart = null;
        rec.stop();
      } catch {
        // ignore
      }
      resolve({ transcript, error });
    };

    const onAbort = () => finish(best || null, "aborted");
    signal?.addEventListener("abort", onAbort);

    const timer = window.setTimeout(() => {
      finish(best || null, best ? null : "no-speech");
    }, timeoutMs);

    // If the engine never starts, Chromium often later emits a useless "network"
    const startWatch = window.setTimeout(() => {
      if (!done && !sawStart) {
        finish(null, friendlyListenError("network"));
      }
    }, 3500);

    rec.onstart = () => {
      sawStart = true;
      window.clearTimeout(startWatch);
    };

    rec.onresult = (ev) => {
      let interim = "";
      let finalText = "";
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i];
        const piece = row?.[0]?.transcript?.trim() ?? "";
        if (!piece) continue;
        if (row.isFinal) finalText = (finalText ? `${finalText} ` : "") + piece;
        else interim = piece;
      }
      best = (finalText || interim || best).trim();
      // End after a final phrase — continuous mode otherwise keeps going
      if (finalText) {
        finish(finalText.trim(), null);
      }
    };
    rec.onerror = (ev) => {
      const code = ev.error || "error";
      if ((code === "aborted" || code === "no-speech") && best) {
        finish(best, null);
        return;
      }
      // Ignore "aborted" that races with our own stop after a result
      if (code === "aborted" && done) return;
      finish(best || null, friendlyListenError(code));
    };
    rec.onend = () => {
      if (!done) finish(best || null, best ? null : "no-speech");
    };

    try {
      rec.start();
    } catch {
      finish(null, "Couldn’t start the microphone. Try Press to speak again.");
    }
  });
}

/**
 * One-shot listen. Cancels TTS first so Chrome doesn’t abort the mic.
 * Pass signal to abort early (Stop listening).
 */
export async function listenOnce(
  timeoutMs = 8000,
  signal?: AbortSignal,
): Promise<string | null> {
  const result = await listenOnceDetailed(timeoutMs, signal);
  return result.transcript;
}

export async function listenOnceDetailed(
  timeoutMs = 8000,
  signal?: AbortSignal,
): Promise<ListenResult> {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    return { transcript: null, error: "Voice isn’t supported in this browser." };
  }
  if (signal?.aborted) {
    return { transcript: null, error: "aborted" };
  }

  // Mic + TTS cannot overlap in Chromium
  await silenceSpeech(280);
  if (signal?.aborted) {
    return { transcript: null, error: "aborted" };
  }

  let result = await listenOnceAttempt(timeoutMs, signal);

  // One retry — Chrome often emits a spurious "network" right after stop/cancel
  const isNetwork =
    !!result.error &&
    !result.transcript &&
    /network|Chrome with internet/i.test(result.error);
  if (isNetwork && !signal?.aborted) {
    await new Promise((r) => window.setTimeout(r, 450));
    if (!signal?.aborted) {
      result = await listenOnceAttempt(timeoutMs, signal);
    }
  }

  return result;
}

/** Hold-to-speak (Echo-style). Call start on press, stop on release. */
export function createHoldToTalk(opts?: {
  onInterim?: (text: string) => void;
}): { start: () => void; stop: () => Promise<string | null> } | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  let rec: SpeechRec | null = null;
  let finalText = "";
  let interimText = "";
  let done = false;
  let resolveStop: ((v: string | null) => void) | null = null;

  const finish = (value: string | null) => {
    if (done) return;
    done = true;
    resolveStop?.(value);
    resolveStop = null;
  };

  return {
    start() {
      if (rec) return;
      done = false;
      finalText = "";
      interimText = "";
      void silenceSpeech(120).then(() => {
        if (done) return;
        const r = new Ctor();
        rec = r;
        r.lang = "en-US";
        r.continuous = true;
        r.interimResults = true;

        r.onresult = (ev) => {
          let finals = "";
          let interim = "";
          for (let i = 0; i < ev.results.length; i++) {
            const row = ev.results[i];
            const piece = row?.[0]?.transcript ?? "";
            if (row.isFinal) finals += piece;
            else interim += piece;
          }
          if (finals.trim()) finalText = finals.trim();
          interimText = interim.trim();
          const live = (finalText || interimText).trim();
          if (live) opts?.onInterim?.(live);
        };
        r.onerror = () => {
          finish(finalText || interimText || null);
          rec = null;
        };
        r.onend = () => {
          finish(finalText || interimText || null);
          rec = null;
        };

        try {
          r.start();
        } catch {
          finish(null);
          rec = null;
        }
      });
    },
    stop() {
      return new Promise((resolve) => {
        if (done) {
          resolve(finalText || interimText || null);
          return;
        }
        resolveStop = resolve;
        try {
          rec?.stop();
        } catch {
          finish(finalText || interimText || null);
        }
        window.setTimeout(() => {
          finish(finalText || interimText || null);
        }, 1200);
      });
    },
  };
}

/** Map free speech to a recipient action. */
export function parseRecipientIntent(
  transcript: string,
): "okay" | "medicine" | "walk" | null {
  const t = transcript.toLowerCase();
  if (
    /\b(i'?m okay|i am okay|i'?m fine|check[\s-]?in|good morning|doing fine)\b/.test(
      t,
    )
  ) {
    return "okay";
  }
  if (
    /\b(medicine|medication|pills?|took my|i took|blood pressure|vitamin)\b/.test(
      t,
    )
  ) {
    return "medicine";
  }
  if (/\b(walk|walking|went for a|stroll|exercise)\b/.test(t)) {
    return "walk";
  }
  return null;
}

/** Map free speech to a DoorSense / TV choice (remote mic). */
export function parseDoorSenseIntent(
  transcript: string,
): "expecting" | "tell_caregiver" | "need_help" | "dismiss" | null {
  const t = transcript.toLowerCase();
  if (
    /\b(need help|help me|emergency|urgent|i'?m scared|scared|send help)\b/.test(
      t,
    )
  ) {
    return "need_help";
  }
  if (
    /\b(tell (my )?(care\s*giver|caregiver|family|daughter|son|kids?)|call (my )?(care\s*giver|caregiver|family)|notify|alert (them|family|care\s*giver|caregiver)|get (my )?(care\s*giver|caregiver))\b/.test(
      t,
    )
  ) {
    return "tell_caregiver";
  }
  if (
    /\b(expecting|i'?m expecting|expecting someone|i know|know who|it'?s (the )?nurse|it'?s (the )?doctor|package|delivery|amazon|expected)\b/.test(
      t,
    )
  ) {
    return "expecting";
  }
  if (
    /\b(not now|dismiss|ignore|never mind|no thanks|go away|cancel|skip)\b/.test(
      t,
    )
  ) {
    return "dismiss";
  }
  return null;
}
