"use client";

import {
  buildHomeContext,
  formatContextWhen,
  type HomeContextKind,
} from "@/lib/agents";
import { useStore } from "@/lib/store";

function kindChip(kind: HomeContextKind): string {
  if (kind === "ring") return "Ring";
  if (kind === "alert") return "Alert";
  if (kind === "check_in") return "Check-in";
  if (kind === "feeling") return "Feeling";
  if (kind === "medicine") return "Meds";
  if (kind === "walk") return "Walk";
  if (kind === "break") return "Break";
  if (kind === "coming") return "Visit";
  return kind;
}

/** Home Context agent — Ring + Mom cards as one timeline. */
export function HomeContextTimeline() {
  const { state } = useStore();
  const lines = buildHomeContext(state, 12);

  return (
    <section>
      <div className="flex items-end justify-between gap-2 mb-3">
        <div>
          <h2 className="section-title">Home context</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Rules agent · Ring + Mom’s day — not face ID
          </p>
        </div>
      </div>
      <div className="glass-strong p-3 md:p-4">
        {lines.length === 0 ? (
          <p className="px-2 py-8 text-center text-white/50">
            Nothing logged yet today. Sync Ring or open Mom’s tablet cards.
          </p>
        ) : (
          <ul className="space-y-2">
            {lines.map((line) => (
              <li key={line.id} className="list-row !py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">{kindChip(line.kind)}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    {line.source}
                  </span>
                  <span className="text-xs text-white/45 ml-auto">
                    {formatContextWhen(line.at)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-white/90 leading-snug">
                  {line.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
