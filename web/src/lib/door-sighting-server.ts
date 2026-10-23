export type DoorSighting = {
  id: string;
  at: string;
  label: string;
  kind: "motion" | "ding" | "open";
  /** Optional: open live assist on caregiver */
  liveAssist?: boolean;
};

type Store = { events: DoorSighting[] };

const g = globalThis as typeof globalThis & { __porchlightDoor?: Store };

function store(): Store {
  if (!g.__porchlightDoor) g.__porchlightDoor = { events: [] };
  return g.__porchlightDoor;
}

export function postDoorSighting(input: {
  label: string;
  kind?: DoorSighting["kind"];
  liveAssist?: boolean;
}): DoorSighting {
  const event: DoorSighting = {
    id: `sight-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    label: input.label.trim() || "Motion at the door",
    kind:
      input.kind === "ding" || input.kind === "open" ? input.kind : "motion",
    liveAssist: Boolean(input.liveAssist),
  };
  const s = store();
  s.events = [event, ...s.events].slice(0, 40);
  return event;
}

export function listDoorSightings(since?: string | null): DoorSighting[] {
  const all = store().events;
  if (!since) return all.slice(0, 8);
  return all.filter((e) => e.at > since);
}
