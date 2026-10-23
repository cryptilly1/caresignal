/**
 * Ring Partner API helpers (Playground access token or future OAuth).
 * Base: https://api.amazonvision.com — JSON:API shapes.
 */

import { setDoorSensePending } from "@/lib/doorsense-server";

export const RING_API_BASE = "https://api.amazonvision.com";

export type RingApiDevice = {
  id: string;
  name: string;
  imageUrl?: string;
};

export type RingNormalizedEvent = {
  id: string;
  at: string;
  kind: "motion" | "ding" | "open";
  label: string;
  eventType: string;
  deviceId: string;
  deviceName?: string;
  raw?: unknown;
};

type RingMemory = {
  seenIds: Set<string>;
  events: RingNormalizedEvent[];
  lastSyncAt: string | null;
  lastError: string | null;
  device: RingApiDevice | null;
};

/** Runtime paste + in-memory Ring sync — survive HMR without remounting twice. */
const ringGlobal = globalThis as typeof globalThis & {
  __caresignalRingToken?: string | null;
  __caresignalRing?: RingMemory;
};

export function getRingAccessToken(): string | null {
  const runtime = ringGlobal.__caresignalRingToken?.trim();
  if (runtime) return runtime;
  const t = process.env.RING_ACCESS_TOKEN?.trim();
  return t || null;
}

/** Paste a fresh Playground token without restarting Next. */
export function setRingAccessToken(token: string | null): void {
  const t = token?.trim() || null;
  ringGlobal.__caresignalRingToken = t;
}

export function ringTokenSource(): "runtime" | "env" | "none" {
  if (ringGlobal.__caresignalRingToken?.trim()) return "runtime";
  if (process.env.RING_ACCESS_TOKEN?.trim()) return "env";
  return "none";
}

export function ringTokenHint(): string | null {
  const t = getRingAccessToken();
  if (!t) return null;
  if (t.length <= 8) return "••••";
  return `••••${t.slice(-4)}`;
}

export function ringConfigured(): boolean {
  return Boolean(getRingAccessToken());
}

async function ringFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = getRingAccessToken();
  if (!token) {
    throw new Error(
      "RING_ACCESS_TOKEN not set — paste a Playground token in Setup (You) or .env.local",
    );
  }
  return fetch(`${RING_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function listRingDevices(): Promise<RingApiDevice[]> {
  const res = await ringFetch("/v1/devices");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ring devices ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      attributes?: { name?: string; image_url?: string };
    }>;
  };
  return (json.data ?? []).map((d) => ({
    id: d.id,
    name: d.attributes?.name ?? "Ring device",
    imageUrl: d.attributes?.image_url,
  }));
}

export async function getRingDeviceStatus(deviceId: string): Promise<{
  online?: boolean;
  raw: unknown;
}> {
  const res = await ringFetch(
    `/v1/devices/${encodeURIComponent(deviceId)}/status`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ring status ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: { attributes?: Record<string, unknown> };
  };
  const attrs = json.data?.attributes ?? {};
  const online =
    typeof attrs.online === "boolean"
      ? attrs.online
      : typeof attrs.status === "string"
        ? String(attrs.status).toLowerCase() === "online"
        : undefined;
  return { online, raw: json };
}

/** Ring history often uses epoch ms (number or numeric string), not ISO. */
export function parseRingTimestamp(value: unknown): string {
  if (value == null || value === "") return new Date().toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  const s = String(value).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Map Ring history / webhook event type → CareSignal door kind + label */
export function normalizeRingEventType(
  eventType: string,
  attrs: Record<string, unknown> = {},
): { kind: "motion" | "ding" | "open"; label: string } {
  const t = eventType.toLowerCase();
  const sub = String(attrs.sub_type ?? attrs.subType ?? "").toLowerCase();

  if (
    t.includes("button") ||
    t.includes("ding") ||
    t === "button_press" ||
    t.includes("doorbell")
  ) {
    return {
      kind: "ding",
      label: "Doorbell · Ring Playground",
    };
  }
  if (t.includes("open") || t.includes("door_open")) {
    return {
      kind: "open",
      label: "Door open · Ring Playground",
    };
  }
  // Playground Package / Motion / Vehicle sims show up as live-view (on_demand)
  if (
    t === "on_demand" ||
    t.includes("live_view") ||
    t.includes("liveview") ||
    t.includes("livestream")
  ) {
    return {
      kind: "motion",
      label: "Live view / package sim · Ring Playground",
    };
  }
  // motion.human, motion_detected, motion, etc.
  const who = sub === "human" || t.includes("human") ? " (person-like)" : "";
  return {
    kind: "motion",
    label: `Motion${who} · Ring Playground`,
  };
}

export async function fetchRingEventHistory(
  deviceId: string,
  deviceName?: string,
): Promise<RingNormalizedEvent[]> {
  const res = await ringFetch(
    `/v1/history/devices/${encodeURIComponent(deviceId)}/events`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ring event history ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: Array<{
      id?: string;
      type?: string;
      attributes?: Record<string, unknown>;
    }>;
  };

  const out: RingNormalizedEvent[] = [];
  for (const item of json.data ?? []) {
    const attrs = item.attributes ?? {};
    const eventType = String(
      attrs.event_type ?? attrs.eventType ?? item.type ?? "motion",
    );
    const at = parseRingTimestamp(
      attrs.start ?? attrs.started_at ?? attrs.timestamp ?? attrs.created_at,
    );
    const id =
      item.id ??
      String(attrs.request_id ?? attrs.id ?? `${eventType}-${at}`);
    const { kind, label } = normalizeRingEventType(eventType, attrs);
    out.push({
      id,
      at,
      kind,
      label,
      eventType,
      deviceId,
      deviceName,
      raw: item,
    });
  }
  // Newest first
  out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return out;
}

function memory(): RingMemory {
  if (!ringGlobal.__caresignalRing) {
    ringGlobal.__caresignalRing = {
      seenIds: new Set(),
      events: [],
      lastSyncAt: null,
      lastError: null,
      device: null,
    };
  }
  return ringGlobal.__caresignalRing;
}

export async function syncRingPlayground(): Promise<{
  configured: boolean;
  device: RingApiDevice | null;
  online?: boolean;
  newEvents: RingNormalizedEvent[];
  lastSyncAt: string | null;
  error: string | null;
}> {
  const mem = memory();
  if (!ringConfigured()) {
    return {
      configured: false,
      device: null,
      newEvents: [],
      lastSyncAt: mem.lastSyncAt,
      error: "RING_ACCESS_TOKEN missing in .env.local",
    };
  }

  try {
    const devices = await listRingDevices();
    const preferred = process.env.RING_DEVICE_ID?.trim();
    const device =
      (preferred && devices.find((d) => d.id === preferred)) ||
      devices[0] ||
      null;
    mem.device = device;

    let online: boolean | undefined;
    if (device) {
      try {
        const st = await getRingDeviceStatus(device.id);
        online = st.online;
      } catch {
        // status optional
      }
    }

    let newEvents: RingNormalizedEvent[] = [];
    if (device) {
      const history = await fetchRingEventHistory(device.id, device.name);
      const fresh: RingNormalizedEvent[] = [];
      for (const ev of history) {
        if (mem.seenIds.has(ev.id)) continue;
        mem.seenIds.add(ev.id);
        fresh.push(ev);
      }
      // First sync can be huge — only surface newest 3 into CareSignal
      const firstSync = mem.events.length === 0;
      newEvents = firstSync ? fresh.slice(0, 3) : fresh;
      if (newEvents.length) {
        mem.events = [...newEvents, ...mem.events].slice(0, 50);
        // Newest door-like event → DoorSense resident prompt
        const doorish = newEvents.find(
          (e) => e.kind === "ding" || e.kind === "motion",
        );
        if (doorish) {
          setDoorSensePending({
            label:
              doorish.kind === "ding"
                ? "Someone rang the doorbell"
                : doorish.label,
            source: "Ring Playground",
            id: doorish.id,
          });
        }
      }
    }

    mem.lastSyncAt = new Date().toISOString();
    mem.lastError = null;
    return {
      configured: true,
      device,
      online,
      newEvents,
      lastSyncAt: mem.lastSyncAt,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mem.lastError = msg;
    return {
      configured: true,
      device: mem.device,
      newEvents: [],
      lastSyncAt: mem.lastSyncAt,
      error: msg,
    };
  }
}

export function getRingMemorySnapshot() {
  const mem = memory();
  return {
    configured: ringConfigured(),
    device: mem.device,
    lastSyncAt: mem.lastSyncAt,
    lastError: mem.lastError,
    eventCount: mem.events.length,
    events: mem.events.slice(0, 20),
  };
}

/** Accept a webhook or manual POST shaped like Ring notifications */
export function ingestRingWebhookPayload(body: unknown): RingNormalizedEvent | null {
  const mem = memory();
  const b = body as Record<string, unknown>;
  const data = (b.data as Record<string, unknown>) ?? b;
  const attrs =
    (data.attributes as Record<string, unknown>) ??
    (b.attributes as Record<string, unknown>) ??
    {};
  const eventType = String(
    b.type ??
      b.event_type ??
      data.type ??
      attrs.event_type ??
      attrs.eventType ??
      "motion_detected",
  );
  const deviceId = String(
    b.device_id ??
      attrs.device_id ??
      (data.relationships as { device?: { data?: { id?: string } } })?.device
        ?.data?.id ??
      mem.device?.id ??
      "unknown",
  );
  const id = String(
    b.request_id ??
      (b.meta as { request_id?: string })?.request_id ??
      data.id ??
      `${eventType}-${Date.now()}`,
  );
  if (mem.seenIds.has(id)) return null;
  const { kind, label } = normalizeRingEventType(eventType, attrs);
  const at = parseRingTimestamp(attrs.start ?? attrs.timestamp);
  const ev: RingNormalizedEvent = {
    id,
    at,
    kind,
    label,
    eventType,
    deviceId,
    deviceName: mem.device?.name,
    raw: body,
  };
  mem.seenIds.add(id);
  mem.events = [ev, ...mem.events].slice(0, 50);
  mem.lastSyncAt = new Date().toISOString();
  return ev;
}
