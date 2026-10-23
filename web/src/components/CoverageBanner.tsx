"use client";

import Link from "next/link";
import { coverageGapMessage, awaitingAccept } from "@/lib/engine";
import { useStore } from "@/lib/store";

/** Coverage gap — open alerts still need “I’m on it” / accept. */
export function CoverageBanner() {
  const { state } = useStore();
  const msg = coverageGapMessage(state);
  const open = awaitingAccept(state);
  if (!msg || open.length === 0) return null;
  const first = open[0];

  return (
    <div className="rounded-[1.25rem] border border-[var(--accent-warn)]/45 bg-[var(--accent-warn)]/12 px-4 py-3.5 text-white backdrop-blur-md">
      <p className="eyebrow text-[var(--accent-warn)]">
        Coverage gap · accept responsibility
      </p>
      <p className="text-sm font-semibold mt-1.5 leading-snug">{msg}</p>
      <Link
        href={`/alerts/${first.id}`}
        className="inline-flex mt-3.5 text-sm font-semibold rounded-full px-4 py-2 bg-[var(--scene-active)] text-[var(--scene-active-ink)]"
      >
        Accept — I’m on it →
      </Link>
    </div>
  );
}
