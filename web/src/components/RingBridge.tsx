"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notifyDoorAlert } from "@/lib/door-notify";
import { useStore } from "@/lib/store";

type StatusPayload = {
  configured?: boolean;
  device?: { id: string; name: string } | null;
  online?: boolean;
  error?: string;
  message?: string;
  lastSyncAt?: string | null;
  source?: string;
};

type SyncEvent = {
  id: string;
  at: string;
  kind: "motion" | "ding" | "open";
  label: string;
  eventType: string;
};

type SyncPayload = {
  configured?: boolean;
  device?: { id: string; name: string } | null;
  online?: boolean;
  newEvents?: SyncEvent[];
  error?: string | null;
  lastSyncAt?: string | null;
};

/**
 * Ring → CareSignal bridge.
 * - Instant buttons: Ring-shaped events right now (demo / DoorSense path)
 * - Fast history poll (~2s): catches Playground Package/Motion sims (no webhooks there)
 */
export function RingBridge({ headless = false }: { headless?: boolean } = {}) {
  const { ingestRingApiEvent } = useStore();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const applyEvents = useCallback(
    (events: SyncEvent[], source: "playground" | "webhook" = "playground") => {
      let alerted = 0;
      let last: SyncEvent | null = null;
      let lastAlerted = false;
      for (const ev of events) {
        const did = ingestRingApiEvent({
          id: ev.id,
          kind: ev.kind,
          label: ev.label,
          at: ev.at,
          source,
        });
        if (did) alerted += 1;
        last = ev;
        lastAlerted = did;
      }
      // Same red banner + chime as phone cam
      if (last) {
        notifyDoorAlert({
          label: last.label,
          alerted: lastAlerted,
          source: source === "webhook" ? "Ring" : "Ring Playground",
        });
      }
      return { n: events.length, alerted };
    },
    [ingestRingApiEvent],
  );

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ring/status", { cache: "no-store" });
      const data = (await res.json()) as StatusPayload;
      setStatus(data);
    } catch {
      setStatus({
        configured: false,
        message: "Could not reach Ring status API",
      });
    }
  }, []);

  const sync = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (syncingRef.current) return;
      syncingRef.current = true;
      if (!silent) {
        setBusy(true);
        setNote(null);
      }
      try {
        const res = await fetch("/api/ring/sync", {
          method: "POST",
          cache: "no-store",
        });
        const data = (await res.json()) as SyncPayload;
        if (data.error) {
          if (!silent) setNote(data.error);
        } else {
          const { n, alerted } = applyEvents(data.newEvents ?? [], "playground");
          if (!silent) {
            setNote(
              n === 0
                ? "Listening… (Playground sims appear within ~2s, or use Instant below)"
                : `Pulled ${n} Ring event${n === 1 ? "" : "s"}${
                    alerted ? ` · ${alerted} alert${alerted === 1 ? "" : "s"}` : ""
                  }`,
            );
          } else if (n > 0) {
            setNote(
              `Live · ${n} new Ring event${n === 1 ? "" : "s"}${
                alerted ? ` · alerted` : ""
              }`,
            );
          }
        }
        if (!silent) await refreshStatus();
      } catch (e) {
        if (!silent) setNote(e instanceof Error ? e.message : "Sync failed");
      } finally {
        syncingRef.current = false;
        if (!silent) setBusy(false);
      }
    },
    [applyEvents, refreshStatus],
  );

  const pushInstant = useCallback(
    async (kind: "motion" | "ding") => {
      setBusy(true);
      setNote(null);
      try {
        const res = await fetch("/api/ring/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            label:
              kind === "ding"
                ? "Doorbell · Ring (instant)"
                : "Motion · Ring (instant)",
          }),
        });
        const data = (await res.json()) as {
          event?: SyncEvent | null;
          error?: string;
        };
        if (!data.event) {
          setNote(data.error || "Push failed");
          return;
        }
        const alerted = ingestRingApiEvent({
          id: data.event.id,
          kind: data.event.kind,
          label: data.event.label,
          at: data.event.at,
          source: "webhook",
        });
        notifyDoorAlert({
          label: data.event.label,
          alerted,
          source: "Ring",
        });
        setNote(
          alerted
            ? "Instant alert · sound + banner"
            : "Logged only (pact / away — no alert)",
        );
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Push failed");
      } finally {
        setBusy(false);
      }
    },
    [ingestRingApiEvent],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshStatus]);

  // Near-instant: poll Ring history every 2s while Today is open
  useEffect(() => {
    if (!status?.configured) return;
    const initial = window.setTimeout(() => void sync({ silent: true }), 0);
    const id = window.setInterval(() => {
      void sync({ silent: true });
    }, 2000);
    return () => { window.clearTimeout(initial); window.clearInterval(id); };
  }, [status?.configured, sync]);

  const configured = Boolean(status?.configured);
  const deviceName = status?.device?.name ?? "—";

  if (headless) return null;

  return (
    <div className="rounded-[1.15rem] bg-black/25 border border-white/10 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Ring Playground
          </p>
          <p className="text-sm font-semibold mt-0.5">
            {configured ? deviceName : "Not connected"}
          </p>
          <p className="text-xs text-white/55 mt-0.5">
            {configured
              ? "Live poll every 2s · Instant buttons below"
              : (status?.message ??
                "Paste token in You → Setup (no restart)")}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 bg-white/15 text-white border border-white/20 disabled:opacity-50"
          disabled={busy || !configured}
          onClick={() => void sync({ silent: false })}
        >
          {busy ? "…" : "Pull"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="text-xs font-semibold rounded-full px-3 py-1.5 bg-white text-black disabled:opacity-50"
          disabled={busy}
          onClick={() => void pushInstant("ding")}
        >
          Instant doorbell
        </button>
        <button
          type="button"
          className="text-xs font-semibold rounded-full px-3 py-1.5 bg-white text-black disabled:opacity-50"
          disabled={busy}
          onClick={() => void pushInstant("motion")}
        >
          Instant motion
        </button>
      </div>

      {status?.error && (
        <p className="text-xs text-[#fecaca]">{status.error}</p>
      )}
      {note && <p className="text-xs text-white/75">{note}</p>}
      <p className="text-[11px] text-white/45 leading-snug">
        Playground has no webhooks — Package/Motion sims land via the 2s poll.
        Use <strong className="text-white/70">Instant</strong> for zero-lag demo
        (same Ring event shape; production Ring would POST to{" "}
        <code className="text-white/60">/api/ring/webhook</code>).
      </p>
    </div>
  );
}
