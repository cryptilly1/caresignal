/** Server-side care events from Alexa / MCP — caregiver UI polls these. */

export type AlexaCareKind =
  | "check_in"
  | "medicine"
  | "walk"
  | "doorsense"
  | "status";

export type AlexaCareEvent = {
  id: string;
  at: string;
  kind: AlexaCareKind;
  label: string;
  /** DoorSense choice when kind is doorsense */
  choice?: "expecting" | "tell_caregiver" | "need_help" | "dismiss";
  source: "Alexa" | "MCP" | "Simulator";
};

type Store = { events: AlexaCareEvent[] };

const g = globalThis as typeof globalThis & { __caresignalAlexa?: Store };

function store(): Store {
  if (!g.__caresignalAlexa) g.__caresignalAlexa = { events: [] };
  return g.__caresignalAlexa;
}

export function postAlexaCareEvent(
  input: Omit<AlexaCareEvent, "id" | "at"> & { id?: string; at?: string },
): AlexaCareEvent {
  const event: AlexaCareEvent = {
    id: input.id ?? `alexa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: input.at ?? new Date().toISOString(),
    kind: input.kind,
    label: input.label,
    choice: input.choice,
    source: input.source,
  };
  const s = store();
  s.events = [event, ...s.events].slice(0, 50);
  return event;
}

export function listAlexaCareEvents(since?: string | null): AlexaCareEvent[] {
  const all = store().events;
  if (!since) return all.slice(0, 12);
  return all.filter((e) => e.at > since);
}
