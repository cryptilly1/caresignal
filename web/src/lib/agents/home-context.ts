/**
 * Home Context agent — rules only.
 * Merges Ring + Mom check-ins into plain timeline lines for caregivers.
 */

import {
  feelingLabel,
  formatWhen,
  memberById,
  now,
  todayKey,
  visitorOccursOn,
} from "@/lib/engine";
import type { HouseholdState } from "@/lib/types";

export type HomeContextKind =
  | "ring"
  | "check_in"
  | "feeling"
  | "medicine"
  | "walk"
  | "break"
  | "coming"
  | "alert";

export type HomeContextLine = {
  id: string;
  at: string;
  kind: HomeContextKind;
  /** Where the signal came from — never invents identity */
  source: string;
  text: string;
};

function ringSourceLabel(source?: string): string {
  if (source === "playground") return "Ring Playground";
  if (source === "phone") return "Phone cam stand-in";
  if (source === "webhook") return "Ring webhook";
  if (source === "fixture") return "Demo fixture";
  return "Ring";
}

function matchedLabel(matched: string): string {
  if (matched === "expected") return "expected visit window";
  if (matched === "alert") return "unusual — needs attention";
  return "logged only";
}

/** Build today's home story as ordered timeline lines (newest first). */
export function buildHomeContext(
  state: HouseholdState,
  limit = 24,
): HomeContextLine[] {
  const key = todayKey(state);
  const lines: HomeContextLine[] = [];

  for (const e of state.ringEvents) {
    if (e.at.slice(0, 10) !== key) continue;
    lines.push({
      id: `hc-ring-${e.id}`,
      at: e.at,
      kind: "ring",
      source: ringSourceLabel(e.source),
      text: `${e.label} · ${matchedLabel(e.matched)}`,
    });
  }

  for (const c of state.checkIns) {
    if (c.at.slice(0, 10) !== key) continue;
    lines.push({
      id: `hc-check-${c.id}`,
      at: c.at,
      kind: "check_in",
      source: "Mom",
      text: c.note
        ? `Checked in — I’m okay (“${c.note}”)`
        : "Checked in — I’m okay",
    });
  }

  for (const f of state.feelingLogs ?? []) {
    if (f.at.slice(0, 10) !== key) continue;
    lines.push({
      id: `hc-feel-${f.id}`,
      at: f.at,
      kind: "feeling",
      source: "Mom",
      text: `Feeling: ${feelingLabel(f.level)}`,
    });
  }

  for (const m of state.medicineLogs ?? []) {
    if (m.at.slice(0, 10) !== key) continue;
    const med = state.medicines.find((x) => x.id === m.medicineId);
    lines.push({
      id: `hc-med-${m.id}`,
      at: m.at,
      kind: "medicine",
      source: "Mom",
      text: `Medicine logged · ${med?.name ?? m.medicineId} (${m.timeSlot})`,
    });
  }

  for (const w of state.walkLogs ?? []) {
    if (w.at.slice(0, 10) !== key) continue;
    lines.push({
      id: `hc-walk-${w.id}`,
      at: w.at,
      kind: "walk",
      source: "Mom",
      text: `Walk logged · ${w.minutes} min`,
    });
  }

  for (const b of state.breakLogs ?? []) {
    if (b.at.slice(0, 10) !== key) continue;
    lines.push({
      id: `hc-break-${b.id}`,
      at: b.at,
      kind: "break",
      source: "Mom",
      text: b.active
        ? "Asked for a break — quiet-miss paused"
        : "Break cleared — check-ins on again",
    });
  }

  for (const v of state.visitors) {
    if (!visitorOccursOn(v, now(state))) continue;
    lines.push({
      id: `hc-come-${v.id}`,
      at: `${key}T${String(v.startHour).padStart(2, "0")}:00:00.000Z`,
      kind: "coming",
      source: v.oneOffDay ? "Mom" : "Care schedule",
      text: `Someone coming · ${v.label} (~${v.startHour}:00–${v.endHour}:00)`,
    });
  }

  for (const a of state.alerts) {
    if (a.createdAt.slice(0, 10) !== key) continue;
    const owner = memberById(state, a.ownerId)?.name ?? "caregiver";
    lines.push({
      id: `hc-alert-${a.id}`,
      at: a.createdAt,
      kind: "alert",
      source: "CareSignal",
      text: `${a.title} · ${a.status.replaceAll("_", " ")} · owner ${owner}`,
    });
  }

  return lines
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}

export function formatContextWhen(iso: string): string {
  return formatWhen(iso);
}
