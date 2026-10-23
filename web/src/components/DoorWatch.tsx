"use client";

import { BellRing, ChevronRight, DoorOpen, X } from "lucide-react";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  notifyDoorAlert,
  onDoorToast,
  type DoorToastDetail,
} from "@/lib/door-notify";
import { useStore } from "@/lib/store";

type Sighting = {
  id: string;
  at: string;
  label: string;
  kind: "motion" | "ding" | "open";
  liveAssist?: boolean;
};

/**
 * Polls phone-camera sightings → caregiver alert banner + sound.
 * Also displays toasts emitted by RingBridge (same red box).
 */
export function DoorWatch() {
  const { ingestPhoneSighting } = useStore();
  const sinceRef = useRef("");
  const seenRef = useRef(new Set<string>());
  const [toast, setToast] = useState<DoorToastDetail | null>(null);

  // Shared toast bus (Ring instant / poll, and phone path below)
  useEffect(() => {
    return onDoorToast((detail) => {
      setToast(detail);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!sinceRef.current) sinceRef.current = new Date(Date.now() - 20_000).toISOString();

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/door-sighting?since=${encodeURIComponent(sinceRef.current)}&_=${Date.now()}`,
          {
            cache: "no-store",
            headers: { Accept: "application/json" },
          },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { events: Sighting[] };
        const batch = [...data.events].reverse();
        for (const e of batch) {
          if (seenRef.current.has(e.id)) continue;
          seenRef.current.add(e.id);
          if (e.at > sinceRef.current) sinceRef.current = e.at;
          const alerted = !e.label.startsWith("Test ·") && ingestPhoneSighting(e.label);
          // Sound + red banner (same as Ring)
          notifyDoorAlert({
            label: e.label,
            alerted,
            source: e.liveAssist
              ? "DoorSense"
              : e.label.includes("DoorSense") || e.label.includes("waiting on")
                ? "Door"
                : "phone",
          });
        }
      } catch {
        // tunnel blips — keep polling
      }
    };

    void tick();
    const id = window.setInterval(tick, 800);

    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [ingestPhoneSighting]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 12000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  const alerted = toast.alerted;

  return (
    <div className="door-toast-layer">
      <div
        className={`door-toast${alerted ? " door-toast--alert" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="door-toast__icon">{alerted ? <BellRing aria-hidden="true" size={24} /> : <DoorOpen aria-hidden="true" size={24} />}</span>
        <div className="door-toast__copy">
            <div className="door-toast__meta">            <span className={`care-chip${alerted ? " care-chip--pending" : " care-chip--blue"}`}>{toast.label.startsWith("Test ·") ? "Test" : alerted ? "Door alert" : "Door activity"}</span>{toast.source && <span>{toast.source === "phone" ? "Camera stand-in" : toast.source}</span>}</div>
            <p className="door-toast__title">{toast.label}</p>
            {alerted && (
              <Link
                href="/escalation"
                className="door-toast__action"
              >
                Open Alerts <ChevronRight aria-hidden="true" size={18} />
              </Link>
            )}
        </div>
          <button
            type="button"
            className="door-toast__close"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
          >
            <X aria-hidden="true" size={18} strokeWidth={2} />
          </button>
      </div>
    </div>
  );
}
