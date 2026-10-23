"use client";

import Link from "next/link";
import { buildCareSummary, buildHomeContext } from "@/lib/agents";
import { formatWhen } from "@/lib/engine";
import { useStore } from "@/lib/store";

export default function CareSummaryPage() {
  const { state } = useStore();
  const summary = buildCareSummary(state);
  const lines = buildHomeContext(state, 20);

  return (
    <div className="space-y-7 max-w-2xl">
      <div>
        <p className="eyebrow opacity-75">Care Summary agent</p>
        <p className="display text-3xl sm:text-4xl mt-2 tracking-tight">
          {summary.headline}
        </p>
        <p className="mt-2 text-white/55 text-sm leading-snug">
          Day digest for {summary.dateKey} — Ring + Mom’s cards + alerts.
        </p>
      </div>

      <section className="glass-strong p-5 sm:p-6 space-y-3">
        <h2 className="section-title">Snapshot</h2>
        <ul className="space-y-2 text-white/80">
          {summary.bullets.map((b) => (
            <li key={b} className="flex gap-2 text-[15px] leading-snug">
              <span className="text-white/35">·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass-strong p-5 sm:p-6 space-y-3">
        <h2 className="section-title">Notes</h2>
        {summary.paragraphs.map((p) => (
          <p key={p} className="text-white/65 leading-relaxed">
            {p}
          </p>
        ))}
      </section>

      <section className="glass-strong p-5 sm:p-6 space-y-3">
        <h2 className="section-title">Home context</h2>
        {lines.length === 0 ? (
          <p className="text-white/50">No events yet today.</p>
        ) : (
          <ul className="space-y-3">
            {lines.map((l) => (
              <li key={l.id} className="border-b border-white/10 pb-3 last:border-0">
                <p className="text-xs text-white/40">
                  {formatWhen(l.at)} · {l.source}
                </p>
                <p className="mt-1 font-medium tracking-tight">{l.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/45 pb-4">
        <Link href="/today" className="hover:text-white/70 transition">
          ← Today
        </Link>
        <Link href="/escalation" className="hover:text-white/70 transition">
          Escalation inbox
        </Link>
      </div>
    </div>
  );
}
