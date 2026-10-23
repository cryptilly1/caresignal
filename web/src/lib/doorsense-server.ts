/** In-memory DoorSense visitor prompt (shared across caregiver + tablet tabs). */

import { postDoorSighting } from "@/lib/door-sighting-server";

export type DoorSensePending = {
  id: string;
  at: string;
  label: string;
  source: string;
};

export type DoorSenseResponse = {
  id: string;
  at: string;
  choice: "expecting" | "tell_caregiver" | "need_help" | "dismiss";
  label: string;
  pendingLabel: string;
};

type Store = {
  pending: DoorSensePending | null;
  responses: DoorSenseResponse[];
};

const g = globalThis as typeof globalThis & { __caresignalDoorSense?: Store };

function store(): Store {
  if (!g.__caresignalDoorSense) {
    g.__caresignalDoorSense = { pending: null, responses: [] };
  }
  return g.__caresignalDoorSense;
}

export function getDoorSensePending(): DoorSensePending | null {
  return store().pending;
}

export function setDoorSensePending(input: {
  label: string;
  source?: string;
  id?: string;
}): DoorSensePending {
  const s = store();
  const pending: DoorSensePending = {
    id: input.id ?? `ds-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    label: input.label,
    source: input.source ?? "Ring",
  };
  s.pending = pending;
  // Caregiver Today (other device/tab) learns via DoorWatch poll
  postDoorSighting({
    label: `${pending.label} · waiting on DoorSense`,
    kind: "ding",
    liveAssist: false,
  });
  return pending;
}

export function clearDoorSensePending(): void {
  store().pending = null;
}

export function respondDoorSense(
  choice: DoorSenseResponse["choice"],
): { pending: DoorSensePending | null; response: DoorSenseResponse | null } {
  const s = store();
  // If nothing pending, still allow help/escalation so demo never dead-ends
  const pending =
    s.pending ??
    (choice === "tell_caregiver" || choice === "need_help"
      ? {
          id: `ds-orphan-${Date.now()}`,
          at: new Date().toISOString(),
          label: "Door help request",
          source: "DoorSense",
        }
      : null);
  if (!pending) return { pending: null, response: null };
  const response: DoorSenseResponse = {
    id: `dsr-${Date.now()}`,
    at: new Date().toISOString(),
    choice,
    label:
      choice === "expecting"
        ? "Resident: I’m expecting someone"
        : choice === "tell_caregiver"
          ? "Resident asked: Tell my caregiver"
          : choice === "need_help"
            ? "Resident asked: I need help at the door"
            : "Resident dismissed visitor prompt",
    pendingLabel: pending.label,
  };
  s.responses = [response, ...s.responses].slice(0, 30);
  s.pending = null;

  if (choice === "tell_caregiver" || choice === "need_help") {
    postDoorSighting({
      label: response.label,
      kind: "ding",
      liveAssist: true,
    });
  }

  return { pending, response };
}

export function takeDoorSenseResponses(since?: string): DoorSenseResponse[] {
  const all = store().responses;
  if (!since) return all.slice(0, 10);
  return all.filter((r) => r.at > since);
}
