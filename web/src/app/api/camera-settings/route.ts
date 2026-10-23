import { NextResponse } from "next/server";
import { requireCaregiverSession } from "@/lib/auth";

export type CameraSettings = {
  mode: "person" | "motion";
  sensitivity: "low" | "medium" | "high";
  alertPolicy: "pact" | "always";
};

type Store = { settings: CameraSettings };

const g = globalThis as typeof globalThis & { __porchlightCam?: Store };

const defaults: CameraSettings = {
  mode: "person",
  sensitivity: "medium",
  alertPolicy: "pact",
};

function store(): Store {
  if (!g.__porchlightCam) g.__porchlightCam = { settings: { ...defaults } };
  return g.__porchlightCam;
}

export async function GET(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  return NextResponse.json(store().settings);
}

export async function POST(req: Request) {
  const authError = requireCaregiverSession(req);
  if (authError) return authError;
  let body: Partial<CameraSettings> = {};
  try {
    body = await req.json();
  } catch {
    // empty
  }
  const cur = store().settings;
  const next: CameraSettings = {
    mode: body.mode === "motion" || body.mode === "person" ? body.mode : cur.mode,
    sensitivity:
      body.sensitivity === "low" ||
      body.sensitivity === "medium" ||
      body.sensitivity === "high"
        ? body.sensitivity
        : cur.sensitivity,
    alertPolicy:
      body.alertPolicy === "always" || body.alertPolicy === "pact"
        ? body.alertPolicy
        : cur.alertPolicy,
  };
  store().settings = next;
  return NextResponse.json(next);
}
