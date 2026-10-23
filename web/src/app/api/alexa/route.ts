import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import { verifyAlexaRequest } from "@/lib/alexa-request-auth";
import {
  parseCareActionText,
  runCareAction,
  type CareAction,
} from "@/lib/alexa-care";
import {
  handleAlexaEnvelope,
  type AlexaEnvelope,
} from "@/lib/alexa-skill";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

/**
 * Alexa Skills Kit endpoint.
 * Point the custom skill HTTPS endpoint at this URL (via Cloudflare tunnel).
 *
 * Also accepts simulator posts:
 *   { "simulate": true, "action": "tell_caregiver" }
 *   { "simulate": true, "text": "tell my caregiver" }
 */
export async function POST(req: Request) {
  let body: Partial<AlexaEnvelope> & {
    simulate?: boolean;
    action?: CareAction;
    text?: string;
    source?: "Alexa" | "MCP" | "Simulator";
  };

  let rawBody: Buffer;
  try {
    rawBody = Buffer.from(await req.arrayBuffer());
    if (rawBody.byteLength > 1_000_000) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413, headers: noStore },
      );
    }
    body = JSON.parse(rawBody.toString("utf8")) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: noStore },
    );
  }

  // Demo / judge simulator (no ASK envelope)
  if (body.simulate) {
    const authError = requireCaregiverSession(req);
    if (authError) return authError;
    let action = body.action ?? null;
    if (!action && body.text) action = parseCareActionText(body.text);
    if (!action) {
      return NextResponse.json(
        {
          ok: false,
          speech:
            "Try: I'm okay, tell my caregiver, I need help, or what's at the door.",
        },
        { headers: noStore },
      );
    }
    const result = runCareAction(action, body.source ?? "Simulator");
    return NextResponse.json(result, { headers: noStore });
  }

  if (!body.request || typeof body.request.type !== "string") {
    return NextResponse.json(
      { error: "Expected Alexa request or { simulate, action }" },
      { status: 400, headers: noStore },
    );
  }

  const expectedSkillId = process.env.ALEXA_SKILL_ID?.trim();
  if (process.env.NODE_ENV === "production" && !expectedSkillId) {
    return NextResponse.json(
      { error: "ALEXA_SKILL_ID is required in production." },
      { status: 503, headers: noStore },
    );
  }
  const skillId = body.context?.System?.application?.applicationId;
  if (expectedSkillId && skillId !== expectedSkillId) {
    return NextResponse.json(
      { error: "Alexa skill ID does not match this endpoint." },
      { status: 403, headers: noStore },
    );
  }

  let verified: boolean;
  try {
    verified = await verifyAlexaRequest(
      rawBody,
      req.headers.get("signaturecertchainurl"),
      req.headers.get("signature"),
      body.request.timestamp,
    );
  } catch (error) {
    console.error("Alexa request certificate verification failed.", error);
    return NextResponse.json(
      { error: "Could not verify the Alexa signing certificate." },
      { status: 503, headers: noStore },
    );
  }
  if (!verified) {
    return NextResponse.json(
      { error: "Invalid Alexa request signature or timestamp." },
      { status: 401, headers: noStore },
    );
  }

  return NextResponse.json(handleAlexaEnvelope(body as AlexaEnvelope), {
    headers: noStore,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      service: "CareSignal Alexa",
      skillEndpoint: "POST /api/alexa",
      mcpEndpoint: "POST /api/mcp",
      simulate: {
        method: "POST",
        body: { simulate: true, action: "tell_caregiver" },
      },
      phrases: [
        "I'm okay",
        "I took my medicine",
        "I went for a walk",
        "Tell my caregiver",
        "I need help",
        "I'm expecting someone",
        "Not now",
        "What's at the door",
      ],
    },
    { headers: noStore },
  );
}
