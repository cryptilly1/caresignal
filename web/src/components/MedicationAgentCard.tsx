"use client";

import Link from "next/link";
import { buildMedicationBrief } from "@/lib/agents";
import { useStore } from "@/lib/store";

/** Medication agent — caregiver view of due / overdue / taken. */
export function MedicationAgentCard() {
  const { state } = useStore();
  const brief = buildMedicationBrief(state);

  return (
    <section>
      <div className="flex items-end justify-between gap-2 mb-3">
        <div>
          <h2 className="section-title">Medicine agent</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Rules · schedule vs logs — not a clinical diagnosis
          </p>
        </div>
        <Link
          href="/recipient"
          className="text-xs font-medium text-white/50 hover:text-white/75 transition"
        >
          Mom’s cards →
        </Link>
      </div>
      <div
        className={`glass-strong p-5 space-y-3 ${
          brief.overdueCount > 0
            ? "border-[var(--accent-warn)]/40"
            : ""
        }`}
      >
        <p className="display text-2xl tracking-tight">{brief.headline}</p>
        <p className="text-sm text-white/70 leading-snug">
          {brief.caregiverNote}
        </p>
        {brief.slots.length > 0 && (
          <ul className="space-y-2 pt-1">
            {brief.slots.map((s) => (
              <li
                key={`${s.medicineId}-${s.timeSlot}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/25 px-3 py-2.5 border border-white/10"
              >
                <div>
                  <p className="font-semibold text-sm">
                    {s.name}{" "}
                    <span className="text-white/45 font-normal">
                      · {s.timeSlot}
                    </span>
                  </p>
                  <p className="text-xs text-white/50">{s.dose}</p>
                </div>
                <span
                  className={`chip text-[11px] ${
                    s.status === "taken"
                      ? "chip-ok"
                      : s.status === "overdue"
                        ? "chip-urgent"
                        : s.status === "due_now"
                          ? "chip-warn"
                          : ""
                  }`}
                >
                  {s.status === "taken"
                    ? "Taken"
                    : s.status === "overdue"
                      ? "Overdue"
                      : s.status === "due_now"
                        ? "Due now"
                        : "Later"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
