import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import {
  clearDoorSensePending,
  getDoorSensePending,
  respondDoorSense,
  setDoorSensePending,
  takeDoorSenseResponses,
} from "@/lib/doorsense-server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  return NextResponse.json(
    {
      pending: getDoorSensePending(),
      responses: takeDoorSenseResponses(since),
    },
    { headers: noStore },
  );
}

export async function POST(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  let body: {
    action?: string;
    label?: string;
    source?: string;
    choice?: "expecting" | "tell_caregiver" | "need_help" | "dismiss";
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty
  }

  if (body.action === "trigger") {
    const pending = setDoorSensePending({
      label: body.label?.trim() || "Someone is at the door",
      source: body.source ?? "Ring",
    });
    return NextResponse.json({ pending }, { headers: noStore });
  }

  if (body.action === "clear") {
    clearDoorSensePending();
    return NextResponse.json({ pending: null }, { headers: noStore });
  }

  if (body.action === "respond" && body.choice) {
    const result = respondDoorSense(body.choice);
    return NextResponse.json(result, { headers: noStore });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
