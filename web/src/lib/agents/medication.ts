/**
 * Medication agent — rules only.
 * Tracks due / overdue / taken slots and nudges Mom + caregiver.
 * Does not diagnose or invent doses.
 */

import { medsDueToday, now, todayKey } from "@/lib/engine";
import type { HouseholdState, Medicine } from "@/lib/types";

export type MedSlotStatus = "upcoming" | "due_now" | "overdue" | "taken";

export type MedSlotView = {
  medicineId: string;
  name: string;
  dose: string;
  timeSlot: string;
  status: MedSlotStatus;
  /** Minutes past scheduled time (0 if not yet / taken) */
  minutesPast: number;
};

export type MedicationBrief = {
  slots: MedSlotView[];
  takenCount: number;
  totalCount: number;
  /** Next thing Mom should take (due_now or overdue preferred) */
  nextForMom: MedSlotView | null;
  overdueCount: number;
  headline: string;
  caregiverNote: string;
};

function parseSlotMinutes(timeSlot: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeSlot.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Grace: due_now within ±30 min of slot; overdue after +30 min. */
const DUE_WINDOW = 30;
const OVERDUE_AFTER = 30;

function statusForSlot(
  timeSlot: string,
  taken: boolean,
  at: Date,
): { status: MedSlotStatus; minutesPast: number } {
  if (taken) return { status: "taken", minutesPast: 0 };
  const slotMin = parseSlotMinutes(timeSlot);
  if (slotMin == null) return { status: "upcoming", minutesPast: 0 };

  const nowMin = at.getHours() * 60 + at.getMinutes();
  const delta = nowMin - slotMin;

  if (delta < -DUE_WINDOW) {
    return { status: "upcoming", minutesPast: 0 };
  }
  if (delta <= OVERDUE_AFTER) {
    return { status: "due_now", minutesPast: Math.max(0, delta) };
  }
  return { status: "overdue", minutesPast: delta };
}

export function buildMedicationBrief(state: HouseholdState): MedicationBrief {
  const at = now(state);
  const due = medsDueToday(state);
  const slots: MedSlotView[] = due.map(({ med, timeSlot, taken }) => {
    const { status, minutesPast } = statusForSlot(timeSlot, taken, at);
    return {
      medicineId: med.id,
      name: med.name,
      dose: med.dose,
      timeSlot,
      status,
      minutesPast,
    };
  });

  const takenCount = slots.filter((s) => s.status === "taken").length;
  const overdue = slots.filter((s) => s.status === "overdue");
  const dueNow = slots.filter((s) => s.status === "due_now");

  const nextForMom =
    overdue[0] ??
    dueNow[0] ??
    slots.find((s) => s.status === "upcoming") ??
    null;

  let headline: string;
  if (slots.length === 0) {
    headline = "No medicines on today’s list";
  } else if (takenCount === slots.length) {
    headline = "All of today’s medicine logged";
  } else if (overdue.length > 0) {
    headline = `${overdue.length} overdue · needs a tap`;
  } else if (dueNow.length > 0) {
    headline = `${dueNow.length} due now`;
  } else {
    headline = `Next: ${nextForMom?.name ?? "—"} at ${nextForMom?.timeSlot ?? "—"}`;
  }

  const caregiverNote =
    overdue.length > 0
      ? `Mom has ${overdue.length} overdue slot${overdue.length === 1 ? "" : "s"} (${overdue
          .map((s) => `${s.name} ${s.timeSlot}`)
          .join(", ")}). Ask her to log or check in.`
      : dueNow.length > 0
        ? `Medicine window open: ${dueNow.map((s) => s.name).join(", ")}.`
        : takenCount === slots.length && slots.length > 0
          ? "Medicine complete for today."
          : "No overdue medicine right now.";

  return {
    slots,
    takenCount,
    totalCount: slots.length,
    nextForMom,
    overdueCount: overdue.length,
    headline,
    caregiverNote,
  };
}

export function medicationMomPrompt(brief: MedicationBrief): string {
  const next = brief.nextForMom;
  if (!next || next.status === "taken") {
    return "All set on medicine for now.";
  }
  if (next.status === "overdue") {
    return `Overdue: ${next.name} (${next.dose}) was due at ${next.timeSlot}. Tap when taken.`;
  }
  if (next.status === "due_now") {
    return `Time for ${next.name} (${next.dose}) · ${next.timeSlot}.`;
  }
  return `Next up: ${next.name} at ${next.timeSlot}.`;
}

/** Slot still open today for a given medicine (for logging). */
export function findOpenSlot(
  state: HouseholdState,
  medicineId: string,
): { med: Medicine; timeSlot: string } | null {
  const key = todayKey(state);
  const med = state.medicines.find((m) => m.id === medicineId);
  if (!med) return null;
  const logs = state.medicineLogs ?? [];
  for (const timeSlot of med.times) {
    const taken = logs.some(
      (l) =>
        l.medicineId === med.id &&
        l.timeSlot === timeSlot &&
        l.at.slice(0, 10) === key,
    );
    if (!taken) return { med, timeSlot };
  }
  return null;
}
