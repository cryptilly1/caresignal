import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import { ingestRingWebhookPayload } from "@/lib/ring-server";

export const dynamic = "force-dynamic";

/**
 * Accept Ring-shaped webhook POSTs (or local test curls).
 * Playground does not push webhooks — use /api/ring/sync for history.
 * This endpoint satisfies “code calls Ring event shapes” for demo / future OAuth.
 */
export async function POST(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty
  }
  const event = ingestRingWebhookPayload(body);
  return NextResponse.json(
    {
      ok: true,
      duplicate: !event,
      event,
      source: "Ring webhook / simulator",
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
