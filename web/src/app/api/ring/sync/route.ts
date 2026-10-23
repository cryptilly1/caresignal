import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import { syncRingPlayground } from "@/lib/ring-server";

export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

/** Pull event history from Ring Playground device → new CareSignal events */
export async function POST(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  const result = await syncRingPlayground();
  const status = !result.configured ? 503 : result.error ? 502 : 200;
  return NextResponse.json(
    {
      ...result,
      source: "Ring Playground",
    },
    { status, headers: noStore },
  );
}

export async function GET(req: Request) {
  return POST(req);
}
