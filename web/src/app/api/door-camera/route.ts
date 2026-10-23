import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import { doorCameraSnapshot, updateDoorCamera } from "@/lib/door-camera-server";
import { DOOR_LIVE_ICE } from "@/lib/webrtc-ice";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const denied = requireCaregiverSession(request);
  if (denied) return denied;
  const query = new URL(request.url).searchParams;
  return NextResponse.json({ ...doorCameraSnapshot(query.get("viewer"), query.get("publisher")), iceServers: DOOR_LIVE_ICE }, { headers });
}

export async function POST(request: Request) {
  const denied = requireCaregiverSession(request);
  if (denied) return denied;
  const text = await request.text();
  if (text.length > 120_000) return NextResponse.json({ error: "Camera signal is too large." }, { status: 413, headers });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid signal");
  } catch {
    return NextResponse.json({ error: "Invalid camera signal." }, { status: 400, headers });
  }
  try {
    updateDoorCamera(body);
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Camera signaling failed." }, { status: 409, headers });
  }
}
