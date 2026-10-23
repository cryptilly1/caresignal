"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomDrawer } from "./BottomDrawer";
import { useStore } from "@/lib/store";
import { DoorWatch } from "./DoorWatch";
import { CaregiverDoorAssist } from "./CaregiverDoorAssist";
import { RingBridge } from "./RingBridge";

const scenarios = [
  { id: "alert", title: "Care alert", detail: "A care task needs someone to follow up." },
  { id: "motion", title: "Camera motion", detail: "Motion detected at the front door." },
  { id: "help", title: "Receiver help request", detail: "Your care receiver asked for help." },
  { id: "check-in", title: "Missed check-in", detail: "The scheduled check-in hasn't arrived." },
  { id: "visit", title: "Missed visit", detail: "An expected visitor hasn't arrived." },
] as const;
type TestEvent = { id: string; title: string; detail: string; at: string; owned: boolean };

export function CaregiverLiveWatchers() {
  return <><DoorWatch /><RingBridge headless /></>;
}

export function CaregiverSimulations({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStore();
  const [events, setEvents] = useState<TestEvent[]>([]);
  const [notice, setNotice] = useState("");
  const [liveError, setLiveError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function checkConnection() {
      try {
        const response = await fetch("/api/household", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`Live care connection returned ${response.status}`);
        setLiveError("");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Unable to connect caregiver Home to live care updates", error);
        setLiveError("Live care updates are unavailable. Check operational access and connectivity. Simulations still work locally; saved activity is not proof of a live connection.");
      }
    }
    void checkConnection();
    const timer = window.setInterval(() => void checkConnection(), 15_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  const active = state.alerts.filter(a => ["open", "acknowledged", "escalated"].includes(a.status));
  function simulate(scenario: typeof scenarios[number]) {
    setEvents(current => [{
      id: crypto.randomUUID(), title: scenario.title, detail: scenario.detail,
      at: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), owned: false,
    }, ...current]);
    setNotice(`${scenario.title} simulated. Live events are unchanged.`);
  }
  return <>
    <CaregiverDoorAssist hideIdle />
    {liveError && <p className="care-home__message simulation-live" role="status">{liveError}</p>}
    {active.length > 0 && <section className="care-card simulation-live">
      <div className="care-card__heading"><h2>Incoming care alerts</h2><Link className="care-text-button" href="/escalation">View alerts</Link></div>
      <p className="care-body-copy">Shared care-circle activity · separate from simulations</p>
      {active.slice(0, 3).map(a => <Link className="simulation-event" key={a.id} href={`/alerts/${encodeURIComponent(a.id)}`}><strong>{a.title}</strong><span>Open care response</span></Link>)}
    </section>}
    {events.length > 0 && <section className="care-card simulation-results" aria-label="Simulated events">
      <div className="care-card__heading"><h2>Simulated events</h2><button className="care-text-button" type="button" onClick={() => setEvents([])}>Clear tests</button></div>
      {events.map(e => <article className="simulation-event" key={e.id}>
        <span className="care-muted">Simulation · {e.at}</span><h3>{e.title}</h3><p className="care-body-copy">{e.detail}</p>
        <div className="simulation-actions">
          <button className="cs-button cs-button--primary" disabled={e.owned} type="button" onClick={() => setEvents(current => current.map(item => item.id === e.id ? { ...item, owned: true } : item))}>{e.owned ? "Owned by you" : "I'll handle this"}</button>
          <button className="cs-button cs-button--glass" type="button" onClick={() => setEvents(current => current.filter(item => item.id !== e.id))}>Clear test</button>
        </div>
      </article>)}
    </section>}
    {open && <BottomDrawer title="Simulate an event" onClose={onClose}>
      <div className="home-drawer-content">
        <p className="care-body-copy">Test the caregiver response without sending a real request. Camera sensing and incoming receiver requests continue normally. Tests stay in this page and disappear when you leave.</p>
        {notice && <p className="home-drawer-message" role="status">{notice}</p>}
        <div className="drawer-options">{scenarios.map(s => <button key={s.id} className="drawer-option" type="button" onClick={() => simulate(s)}><span><strong>{s.title}</strong><small className="simulation-description">{s.detail}</small></span><span aria-hidden="true">+</span></button>)}</div>
        <button className="cs-button cs-button--primary" type="button" onClick={onClose}>View Home</button>
      </div>
    </BottomDrawer>}
  </>;
}
