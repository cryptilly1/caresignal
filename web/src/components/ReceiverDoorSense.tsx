"use client";

import Link from "next/link";
import { CameraOff, ChevronRight, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { formatTime } from "@/lib/engine";
import { BottomDrawer } from "./BottomDrawer";
import { CareSection } from "./CareWorkspace";
import { DoorCameraPreview } from "./DoorCameraPreview";
import { DoorMotionNotice } from "./DoorMotionNotice";

type DoorEvent = { id: string; at: string; label: string };
type Snapshot = { events: DoorEvent[]; checkedAt: number };

export function ReceiverDoorSense() {
  const { state } = useStore();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const responses = await Promise.all(["/api/doorsense", "/api/door-sighting"].map((url) => fetch(url, { cache: "no-store", signal: controller.signal })));
        if (responses.some((response) => !response.ok)) throw new Error("DoorSense updates are unavailable. Check your connection and household access.");
        const [door, sightings] = await Promise.all(responses.map((response) => response.json())) as [{ pending: DoorEvent | null }, { events: DoorEvent[] }];
        if (!Array.isArray(sightings.events)) throw new Error("DoorSense returned an invalid activity list.");
        if (controller.signal.aborted) return;
        setSnapshot({ events: door.pending ? [door.pending, ...sightings.events] : sightings.events, checkedAt: Date.now() });
        setError("");
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "DoorSense updates could not be loaded.");
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 3000);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  const events = [...(snapshot?.events ?? []), ...state.ringEvents]
    .filter(event => !event.label.startsWith("Test ·"))
    .filter((event, index, all) => all.findIndex((other) => other.id === event.id) === index)
    .sort((a, b) => b.at.localeCompare(a.at));
  const latest = events[0];
  const age = latest && snapshot ? snapshot.checkedAt - new Date(latest.at).getTime() : Infinity;
  const active = !error && age >= 0 && age < 120000;
  const label = error ? "Unavailable" : !snapshot ? "Checking" : active ? "Motion detected" : "Inactive";

  return <>
    <DoorMotionNotice event={active ? latest : null} />
    <CareSection title="DoorSense" className="receiver-door" action={<span className="receiver-door__location">Front door</span>}>
      <div className={`settings-inset receiver-door__content${active ? " receiver-door__content--active" : ""}`}>
        <div className="receiver-door__copy" aria-live="polite">
          <div className="home-alert__meta">          <span className={`care-chip${active ? " care-chip--motion" : ""}`}>{label}</span>{latest && <time dateTime={latest.at}>{formatTime(new Date(latest.at))}</time>}</div>
          <h3>{error ? "Door updates unavailable" : !snapshot ? "Checking the door" : active ? "Person at the door" : "All quiet at the door"}</h3>
          <p className="receiver-door__message">{error ? "We can’t check for visitors right now." : !snapshot ? "Looking for recent motion and doorbell events." : active ? "A door event was detected. Open DoorSense to view the camera and choose what happens next." : "We’ll let you know when motion or a doorbell event is detected. Your camera and microphone stay off."}</p>
          <div className="receiver-door__actions">
            <Link className="cs-button cs-button--primary" href="/doorsense"><Video aria-hidden="true" size={20} />{active ? "View camera" : "Open DoorSense"}</Link>
            <button className="cs-button cs-button--glass" onClick={() => setHistory(true)} type="button">View activity <ChevronRight aria-hidden="true" size={16} /></button>
          </div>
          {error && <p className="settings-error" role="status">{error}</p>}
        </div>
        {active ? <div className="receiver-door__preview receiver-door__preview--live"><DoorCameraPreview compact /></div> :
          <div className="receiver-door__preview"><CameraOff aria-hidden="true" size={32} strokeWidth={1.5} /><span>Camera view inactive</span></div>}
      </div>
    </CareSection>
    {history && <BottomDrawer title="DoorSense activity" onClose={() => setHistory(false)}>
      <div className="settings-form">
        {events.length ? <div className="settings-list">{events.slice(0, 10).map((event) => <div className="settings-row" key={event.id}><span className="settings-row__copy"><strong>{event.label}</strong><small>{new Date(event.at).toLocaleString()}</small></span></div>)}</div> : <p className="care-body-copy">No door events have been received yet.</p>}
        {error && <p className="settings-error" role="status">{error}</p>}
        <Link className="cs-button cs-button--glass" href="/doorsense">Open DoorSense</Link>
      </div>
    </BottomDrawer>}
  </>;
}
