import { NextRequest, NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";
import {
  getRingAccessToken,
  listRingDevices,
  ringConfigured,
} from "@/lib/ring-server";

export const dynamic = "force-dynamic";

const API_BASE = "https://api.amazonvision.com";

function validRingSessionUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.origin !== API_BASE ||
      !/^\/v1\/devices\/[^/]+\/media\/streaming\/whep\/sessions\/[^/]+\/?$/.test(
        url.pathname,
      ) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/** WHEP live session — caregiver watches Playground / Ring doorbell. */
export async function POST(request: NextRequest) {
  const authError = requireCaregiverSession(request);
  if (authError) return authError;
  if (!ringConfigured()) {
    return NextResponse.json(
      { error: "RING_ACCESS_TOKEN missing — live view needs a Playground token" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      sdpOffer?: string;
      deviceId?: string;
    };
    if (!body.sdpOffer) {
      return NextResponse.json({ error: "Missing sdpOffer" }, { status: 400 });
    }

    let deviceId = body.deviceId || process.env.RING_DEVICE_ID?.trim();
    if (!deviceId) {
      const devices = await listRingDevices();
      deviceId = devices[0]?.id;
    }
    if (!deviceId) {
      return NextResponse.json({ error: "No Ring device found" }, { status: 404 });
    }

    const token = getRingAccessToken()!;
    const whepUrl = `${API_BASE}/v1/devices/${encodeURIComponent(deviceId)}/media/streaming/whep/sessions`;

    const response = await fetch(whepUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp",
      },
      body: body.sdpOffer,
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `WHEP failed: ${response.status} - ${error.slice(0, 300)}` },
        { status: response.status },
      );
    }

    const sdpAnswer = await response.text();
    const location = response.headers.get("Location");
    const sessionUrl = location
      ? validRingSessionUrl(new URL(location, whepUrl).href)
      : null;
    if (!sessionUrl) {
      return NextResponse.json(
        { error: "Ring returned an invalid stream-session URL." },
        { status: 502 },
      );
    }
    return NextResponse.json({ sdpAnswer, sessionUrl: sessionUrl.href, deviceId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stream failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authError = requireCaregiverSession(request);
  if (authError) return authError;
  try {
    const { sessionUrl } = (await request.json()) as { sessionUrl?: string };
    if (!sessionUrl) {
      return NextResponse.json({ error: "Missing sessionUrl" }, { status: 400 });
    }
    const ringSessionUrl = validRingSessionUrl(sessionUrl);
    if (!ringSessionUrl) {
      return NextResponse.json(
        { error: "sessionUrl must be a Ring WHEP session URL." },
        { status: 400 },
      );
    }
    const token = getRingAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "Ring access token is not configured." },
        { status: 503 },
      );
    }
    const response = await fetch(ringSessionUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      return NextResponse.json(
        { error: `Ring session close failed: ${response.status}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to close session" }, { status: 500 });
  }
}
