import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import {
  getHousehold,
  putHousehold,
  resetHousehold,
} from "@/lib/household-server";
import type { HouseholdState } from "@/lib/types";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? "0");
  const env = getHousehold();
  if (since > 0 && env.version <= since) {
    return new NextResponse(null, { status: 204, headers: noStore });
  }
  return NextResponse.json(env, { headers: noStore });
}

export async function PUT(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  let body: { state?: HouseholdState } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.state || typeof body.state !== "object") {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }
  const env = putHousehold(body.state);
  return NextResponse.json(env, { headers: noStore });
}

export async function POST(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  let body: { action?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // empty
  }
  if (body.action === "reset") {
    const env = resetHousehold();
    return NextResponse.json(env, { headers: noStore });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
