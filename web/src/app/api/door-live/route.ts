import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import {
  applyDoorLiveSignal,
  getDoorLive,
  resetDoorLive,
} from "@/lib/door-live-server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  return NextResponse.json(getDoorLive(), { headers: noStore });
}

export async function POST(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty
  }
  if (body.type === "reset") {
    return NextResponse.json(resetDoorLive(), { headers: noStore });
  }
  const next = applyDoorLiveSignal(body as Parameters<typeof applyDoorLiveSignal>[0]);
  return NextResponse.json(next, { headers: noStore });
}
