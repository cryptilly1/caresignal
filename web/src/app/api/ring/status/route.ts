import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import {
  getRingMemorySnapshot,
  listRingDevices,
  ringConfigured,
  getRingDeviceStatus,
} from "@/lib/ring-server";

export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  if (!ringConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        message:
          "Paste a Playground token in You → Setup (or set RING_ACCESS_TOKEN in .env.local).",
      },
      { headers: noStore },
    );
  }

  try {
    const devices = await listRingDevices();
    const preferred = process.env.RING_DEVICE_ID?.trim();
    const device =
      (preferred && devices.find((d) => d.id === preferred)) ||
      devices[0] ||
      null;
    let online: boolean | undefined;
    if (device) {
      try {
        online = (await getRingDeviceStatus(device.id)).online;
      } catch {
        // optional
      }
    }
    const snap = getRingMemorySnapshot();
    return NextResponse.json(
      {
        configured: true,
        device,
        devices,
        online,
        lastSyncAt: snap.lastSyncAt,
        lastError: snap.lastError,
        source: "Ring Playground",
      },
      { headers: noStore },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { configured: true, error: message, source: "Ring Playground" },
      { status: 502, headers: noStore },
    );
  }
}
