import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import { listAlexaCareEvents } from "@/lib/alexa-events-server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

/** Caregiver / recipient UI polls Alexa care events (check-in, meds, walk). */
export async function GET(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  const since = new URL(req.url).searchParams.get("since");
  return NextResponse.json(
    { events: listAlexaCareEvents(since) },
    { headers: noStore },
  );
}
