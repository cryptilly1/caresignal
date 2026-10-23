"use client";

import Link from "next/link";
import { now } from "@/lib/engine";
import { useStore } from "@/lib/store";

export default function DemoPage() {
  const {
    state,
    injectQuietMiss,
    injectRing,
    injectVisitMissed,
    resetDemo,
    setDemoNow,
    runEscalationPass,
  } = useStore();

  function nightAt(): Date {
    const d = new Date(now(state));
    d.setHours(1, 40, 0, 0);
    return d;
  }

  function restAt(): Date {
    const d = new Date(now(state));
    d.setHours(state.pact.restStartHour, 15, 0, 0);
    return d;
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow opacity-80">Hackathon demo</p>
        <p className="mt-2 text-white/55 max-w-2xl text-sm leading-snug">
          Prefer Today → Ring Sync for real events. These fixtures cover pact
          scenarios (night exit, quiet miss) Playground may not.
        </p>
      </div>

      <section className="glass-strong p-5 sm:p-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="btn btn-primary justify-start"
          onClick={() => injectQuietMiss()}
        >
          Unusual quiet (missed sign of life)
        </button>
        <button
          type="button"
          className="btn btn-urgent justify-start"
          onClick={() =>
            injectRing("open", "Front door open · 1:40am", nightAt())
          }
        >
          Odd hours night exit (1:40am)
        </button>
        <button
          type="button"
          className="btn btn-ghost justify-start"
          onClick={() =>
            injectRing("ding", "Doorbell · unexpected visitor", now(state))
          }
        >
          Unusual doorbell
        </button>
        <button
          type="button"
          className="btn btn-ghost justify-start"
          onClick={() =>
            injectRing("open", "Door during rest window", restAt())
          }
        >
          Rest-window exit
        </button>
        <button
          type="button"
          className="btn btn-ghost justify-start"
          onClick={() => injectVisitMissed()}
        >
          Expected visit missed
        </button>
        <button
          type="button"
          className="btn btn-ghost justify-start"
          onClick={() =>
            injectRing("motion", "Daytime motion · mail area", now(state))
          }
        >
          Benign daytime motion (ignore)
        </button>
        <button
          type="button"
          className="btn btn-ghost justify-start"
          onClick={() => runEscalationPass()}
        >
          Force escalation check
        </button>
        <button
          type="button"
          className="btn btn-ghost justify-start"
          onClick={() => setDemoNow(null)}
        >
          Clear demo clock
        </button>
        <button
          type="button"
          className="btn btn-ghost justify-start text-[#ff6482]"
          onClick={() => {
            if (confirm("Reset all demo data?")) resetDemo();
          }}
        >
          Reset household seed
        </button>
      </section>

      <section className="glass-strong p-5 sm:p-6 space-y-3">
        <h2 className="display text-2xl">Suggested demo script</h2>
        <ol className="list-decimal pl-5 space-y-2 text-white/65">
          <li>
            Open <Link className="text-white/90 font-medium" href="/home">I’m okay</Link>{" "}
            as Mom → tap check-in →{" "}
            <Link className="text-white/90 font-medium" href="/today">Today</Link> shows green.
          </li>
          <li>
            Inject <strong>Unusual quiet</strong> → alert to on-duty Elias → open
            playbook → assign Sam → switch viewing-as Sam → complete assignment.
          </li>
          <li>
            Leave an alert <strong>open</strong> without “I’m on it” for{" "}
            {state.pact.escalationMinutes} min (or Force escalation) → Escalations
            inbox → backup Sam.
          </li>
          <li>
            Inject <strong>night exit 1:40am</strong> → resolve with “That was fine”.
          </li>
          <li>
            Show <Link className="text-white/90 font-medium" href="/setup">Setup</Link> duty
            calendar and who’s on tomorrow.
          </li>
        </ol>
      </section>

      <section className="glass-strong p-5 sm:p-6">
        <h2 className="display text-2xl">Ring fixture note</h2>
        <p className="mt-2 text-white/65">
          Injected door events are stored as Ring fixtures with match labels
          (expected / alert / ignore). Swap the injector for Ring Developer
          Playground tokens + webhook simulator without changing caregiver
          screens.
        </p>
        <p className="mt-2 text-sm text-white/65">
          Demo clock: {state.demoNow ?? "live"} · Open alerts:{" "}
          {state.alerts.filter((a) =>
            ["open", "acknowledged", "escalated"].includes(a.status),
          ).length}
        </p>
      </section>
    </div>
  );
}
