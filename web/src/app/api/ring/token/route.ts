import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import {
  getRingAccessToken,
  listRingDevices,
  ringTokenHint,
  ringTokenSource,
  setRingAccessToken,
} from "@/lib/ring-server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

/** Status only — never returns the raw token. */
export async function GET(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  const source = ringTokenSource();
  return NextResponse.json(
    {
      configured: Boolean(getRingAccessToken()),
      source,
      hint: ringTokenHint(),
      message:
        source === "none"
          ? "Paste a Ring Playground token below (or set RING_ACCESS_TOKEN in .env.local)."
          : source === "runtime"
            ? "Using token pasted in Setup (memory). Survives until Next restarts."
            : "Using RING_ACCESS_TOKEN from .env.local.",
    },
    { headers: noStore },
  );
}

/**
 * Body: { token: string } — set runtime token
 * Body: { token: null } or { clear: true } — clear runtime (falls back to .env)
 */
export async function POST(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  let body: { token?: string | null; clear?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.clear || body.token === null || body.token === "") {
    setRingAccessToken(null);
    return NextResponse.json(
      {
        ok: true,
        configured: Boolean(getRingAccessToken()),
        source: ringTokenSource(),
        hint: ringTokenHint(),
        message: "Runtime token cleared. Using .env if set.",
      },
      { headers: noStore },
    );
  }

  const token = String(body.token ?? "").trim();
  if (token.length < 10) {
    return NextResponse.json(
      { error: "Token looks too short — paste the full Playground access token." },
      { status: 400, headers: noStore },
    );
  }

  setRingAccessToken(token);

  // Quick validate against Ring API
  try {
    const devices = await listRingDevices();
    return NextResponse.json(
      {
        ok: true,
        configured: true,
        source: ringTokenSource(),
        hint: ringTokenHint(),
        deviceCount: devices.length,
        message: `Token accepted · ${devices.length} device${devices.length === 1 ? "" : "s"} visible.`,
      },
      { headers: noStore },
    );
  } catch (e) {
    // Keep token anyway — Playground can be flaky; user can retry Pull
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: true,
        configured: true,
        source: ringTokenSource(),
        hint: ringTokenHint(),
        warning: message,
        message:
          "Token saved in memory. Ring API check failed — try Pull on Today.",
      },
      { headers: noStore },
    );
  }
}
