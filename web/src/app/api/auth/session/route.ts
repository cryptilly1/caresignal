import { NextResponse } from "next/server";
import {
  caregiverAuthStatus,
  caregiverLoginResponse,
  clearCaregiverSessionResponse,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const status = caregiverAuthStatus(request);
  return NextResponse.json(status, {
    status: status.configured ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  return caregiverLoginResponse(body.password);
}

export async function DELETE() {
  return clearCaregiverSessionResponse();
}
