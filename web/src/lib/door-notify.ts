import { speak } from "@/lib/speech";

export type DoorToastDetail = {
  label: string;
  alerted: boolean;
  source?: string;
};

const EVENT = "caresignal-door-toast";

/** Shared bus — DoorWatch listens; Ring / phone paths emit. */
export function emitDoorToast(detail: DoorToastDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

export function onDoorToast(
  handler: (detail: DoorToastDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = (e: Event) => {
    const ce = e as CustomEvent<DoorToastDetail>;
    if (ce.detail) handler(ce.detail);
  };
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** Short two-tone chime (works without user gesture after first interaction). */
export function playDoorAlertChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const beep = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + dur + 0.02);
    };
    const t0 = ctx.currentTime;
    beep(880, t0, 0.18);
    beep(1175, t0 + 0.2, 0.22);
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // ignore
  }
}

export function notifyDoorAlert(detail: DoorToastDetail): void {
  emitDoorToast(detail);
  if (!detail.alerted) return;

  playDoorAlertChime();
  speak(`Door alert. ${detail.label}`);

  try {
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  } catch {
    // ignore
  }

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("CareSignal", {
        body: detail.label,
        tag: "caresignal-door",
      });
    } catch {
      // ignore
    }
  }
}
