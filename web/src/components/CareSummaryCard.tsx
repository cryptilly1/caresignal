"use client";

import Link from "next/link";
import { buildCareSummary } from "@/lib/agents";
import { useStore } from "@/lib/store";

/** Care Summary agent — template day digest. */
export function CareSummaryCard() {
  const { state } = useStore();
  const summary = buildCareSummary(state);

  return (
    <section>
      <div className="flex items-end justify-between gap-2 mb-3">
        <div>
          <h2 className="section-title">Care summary</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Template digest · not an LLM diagnosis
          </p>
        </div>
        <Link
          href="/summary"
          className="text-xs font-medium text-white/50 hover:text-white/75 transition"
        >
          Full digest →
        </Link>
      </div>
      <div className="glass-strong p-5 space-y-3">
        <p className="display text-2xl tracking-tight">{summary.headline}</p>
        <ul className="space-y-1.5 text-sm text-white/70">
          {summary.bullets.slice(0, 5).map((b) => (
            <li key={b} className="flex gap-2">
              <span className="text-white/30 shrink-0">·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        {summary.openAlertCount > 0 && (
          <Link
            href="/escalation"
            className="inline-block text-sm font-semibold text-[var(--accent-urgent)] hover:opacity-90"
          >
            Open alerts that still need accept →
          </Link>
        )}
      </div>
    </section>
  );
}
