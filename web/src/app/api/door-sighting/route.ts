import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import {
  listDoorSightings,
  postDoorSighting,
} from "@/lib/door-sighting-server";
import { setDoorSensePending } from "@/lib/doorsense-server";

export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function POST(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  let body: {
    label?: string;
    kind?: "motion" | "ding" | "open";
    liveAssist?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty
  }
  const event = postDoorSighting({
    label: body.label?.trim() || "Motion at the door",
    kind: body.kind,
    liveAssist: body.liveAssist,
  });
  if (!body.liveAssist && !event.label.startsWith("Test ·")) {
    setDoorSensePending({ label: event.label, source: "Phone camera", id: event.id, announce: false });
  }
  return NextResponse.json(event, { headers: noStore });
}

export async function GET(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  const since = new URL(req.url).searchParams.get("since");
  return NextResponse.json(
    { events: listDoorSightings(since) },
    { headers: noStore },
  );
}
