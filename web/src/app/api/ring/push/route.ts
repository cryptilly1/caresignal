import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import { setDoorSensePending } from "@/lib/doorsense-server";
import {
  getRingMemorySnapshot,
  ingestRingWebhookPayload,
  listRingDevices,
  ringConfigured,
} from "@/lib/ring-server";

export const dynamic = "force-dynamic";

/**
 * Instant CareSignal door event in Ring webhook shape.
 * Playground UI sims do not push webhooks — use this (or 2s history poll) for demo latency.
 */
export async function POST(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  let body: { kind?: string; label?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty
  }

  const kind = body.kind === "ding" || body.kind === "open" ? body.kind : "motion";
  const eventType =
    kind === "ding" ? "button_press" : kind === "open" ? "door_open" : "motion_detected";

  let deviceId = "playground-device";
  if (ringConfigured()) {
    try {
      const devices = await listRingDevices();
      deviceId = devices[0]?.id ?? deviceId;
    } catch {
      const snap = getRingMemorySnapshot();
      deviceId = snap.device?.id ?? deviceId;
    }
  }

  const label =
    body.label?.trim() ||
    (kind === "ding"
      ? "Doorbell · Ring (instant)"
      : kind === "open"
        ? "Door open · Ring (instant)"
        : "Motion · Ring (instant)");

  const event = ingestRingWebhookPayload({
    type: eventType,
    event_type: eventType,
    device_id: deviceId,
    request_id: `instant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    attributes: {
      event_type: eventType,
      sub_type: kind === "motion" ? "human" : undefined,
      start: Date.now(),
      label,
    },
  });

  // Prefer our label on the normalized event
  if (event) {
    event.label = label;
    event.kind = kind;
  }

  // Doorbell / motion → DoorSense resident prompt
  let doorsense = null;
  if (kind === "ding" || kind === "motion") {
    doorsense = setDoorSensePending({
      label:
        kind === "ding"
          ? "Someone rang the doorbell"
          : "Motion at the door",
      source: "Ring",
      id: event?.id,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      event,
      doorsense,
      source: "Ring-shaped instant push",
      note: "Real Ring devices use webhooks to this same ingest path; Playground UI has no webhook push.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
