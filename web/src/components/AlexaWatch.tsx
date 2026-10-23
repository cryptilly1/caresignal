"use client";

import { useEffect, useRef } from "react";
import { notifyDoorAlert } from "@/lib/door-notify";
import { medsDueToday } from "@/lib/engine";
import { useStore } from "@/lib/store";

type AlexaEvent = {
  id: string;
  at: string;
  kind: "check_in" | "medicine" | "walk" | "doorsense" | "status";
  label: string;
  source: string;
};

/**
 * Polls Alexa / MCP care events → household check-ins + caregiver toast.
 * DoorSense tell_caregiver/need_help also arrive via DoorWatch sightings.
 */
export function AlexaWatch() {
  const { imOkay, logMedicine, logWalk, state } = useStore();
  // Start at "now" so remounts don't replay recent events into the store/toasts
  const sinceRef = useRef(new Date().toISOString());
  const seenRef = useRef(new Set<string>());
  const stateRef = useRef(state);
  const applyingRef = useRef(false);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (applyingRef.current) return;
      try {
        const res = await fetch(
          `/api/alexa/events?since=${encodeURIComponent(sinceRef.current)}&_=${Date.now()}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { events: AlexaEvent[] };
        const batch = [...data.events].reverse();
        for (const e of batch) {
          if (seenRef.current.has(e.id)) continue;
          seenRef.current.add(e.id);
          if (e.at > sinceRef.current) sinceRef.current = e.at;

          applyingRef.current = true;
          try {
            if (e.kind === "check_in") {
              imOkay(`Alexa: ${e.label}`);
            } else if (e.kind === "walk") {
              logWalk(15, `Alexa: ${e.label}`);
            } else if (e.kind === "medicine") {
              const due = medsDueToday(stateRef.current);
              const next = due.find((d) => !d.taken);
              if (next) {
                logMedicine(next.med.id, next.timeSlot);
              }
            }

            if (e.kind !== "doorsense") {
              notifyDoorAlert({
                label: e.label,
                alerted: false,
                source: e.source || "Alexa",
              });
            }
          } finally {
            applyingRef.current = false;
          }
        }
      } catch {
        applyingRef.current = false;
      }
    };

    void tick();
    const id = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [imOkay, logMedicine, logWalk]);

  return null;
}
