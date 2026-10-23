"use client";

import { ArrowUpRight, X } from "lucide-react";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { inter, jakarta, StatusBar } from "./OnboardingFlow";
import { CareHomeFooter, CareHomeHeader } from "./CareHomeChrome";
import { BottomDrawer } from "./BottomDrawer";
import { CaregiverLiveWatchers, CaregiverSimulations } from "./CaregiverSimulations";
import { CARE_SETUP_KEY, caregiverLabel, initials, parseCareSetup, recipientLabel } from "@/lib/care-setup";
import {
  emptyHomePreview, formatCallDuration, HOME_PREVIEW_KEY, parseHomePreview,
  previewMoments, type HomePreviewState, type PreviewAlertId,
} from "@/lib/caregiver-home-preview";

type Drawer = "alerts" | "history" | "logs" | "check-ins" | "circle" | "devices" | "profile" | null;
type DoorScenario = "help" | "visitor";

function HomeIcon({ name, size = 20 }: { name: string; size?: number }) {
  return <Image alt="" height={size} src={`/images/caregiver-home/${name}.svg`} width={size} />;
}

function usePreviewCallTimer(started: number | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (started === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [started]);
  return started === null ? 0 : Math.max(0, Math.floor((now - started) / 1000));
}

export function CaregiverActivityHome() {
  const [initial] = useState(() => {
    let setup = null;
    let activity = emptyHomePreview;
    const errors: string[] = [];
    try {
      const raw = new URLSearchParams(window.location.search).get("demo") === "1" ? null : localStorage.getItem(CARE_SETUP_KEY);
      if (raw) setup = parseCareSetup(raw);
    } catch (error) {
      console.error("Unable to load caregiver home setup", error);
      errors.push("Your household setup could not be loaded. Saved data has not been changed.");
    }
    try {
      const raw = localStorage.getItem(HOME_PREVIEW_KEY);
      if (raw) activity = parseHomePreview(raw);
    } catch (error) {
      console.error("Unable to load home preview activity", error);
      errors.push("Saved preview activity could not be loaded. Saved data has not been changed.");
    }
    return { setup, activity, error: errors.join(" ") };
  });
  const [activity, setActivity] = useState(initial.activity);
  const [message, setMessage] = useState(initial.error);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [simulating, setSimulating] = useState(false);
  const [doorOpen, setDoorOpen] = useState(() => ["request", "connected", "visitor"].includes(new URLSearchParams(window.location.search).get("door") ?? ""));
  const [scenario, setScenario] = useState<DoorScenario>(() => new URLSearchParams(window.location.search).get("door") === "visitor" ? "visitor" : "help");
  const [callStarted, setCallStarted] = useState(() => new URLSearchParams(window.location.search).get("door") === "connected" ? Date.now() : null);
  const connected = callStarted !== null;
  const [muted, setMuted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const openDoorRef = useRef<HTMLButtonElement>(null);
  const miniRef = useRef<HTMLButtonElement>(null);
  const seconds = usePreviewCallTimer(callStarted);
  const recipient = initial.setup ? recipientLabel(initial.setup) : "Evelyn";
  const caregiver = initial.setup ? caregiverLabel(initial.setup) : "Elias";
  const greeting = caregiver === "You" ? "there" : caregiver.split(/\s+/)[0];
  const backup = initial.setup?.members.find((member) => initial.setup?.backupIds.includes(member.id) && member.status === "joined")?.name ?? "Jamie";
  const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
  const alerts = [
    { id: "door-help", title: "Help Mom with the visitor", detail: `Mom asked on her tablet. Join above to take ownership; ${backup} is backup.`, time: "11:41 AM" },
    { id: "medicine-refill", title: "Arrange a medicine refill", detail: "Elias noted 3 days of medicine left. Please arrange a refill by Thursday.", time: "10:45 AM" },
  ] satisfies Array<{ id: PreviewAlertId; title: string; detail: string; time: string }>;
  const openAlerts = alerts.filter((alert) => !activity.cleared.includes(alert.id));
  const panelExpanded = doorOpen && !minimized;

  useEffect(() => {
    if (panelExpanded) panelRef.current?.focus({ preventScroll: true });
  }, [panelExpanded]);

  function persist(next: HomePreviewState) {
    try {
      localStorage.setItem(HOME_PREVIEW_KEY, JSON.stringify(next));
      setActivity(next);
      return true;
    } catch (error) {
      console.error("Unable to save home preview activity", error);
      setMessage("Your change could not be saved on this device. Allow browser storage and try again.");
      return false;
    }
  }

  function openDoor(nextScenario: DoorScenario = "help") {
    if (connected && nextScenario !== scenario) {
      setDrawer(null);
      setMessage("Leave the current call preview before opening a different door event.");
      return;
    }
    setScenario(nextScenario);
    setDoorOpen(true);
    setMinimized(false);
    setDrawer(null);
    setVideoExpanded(false);
  }

  function minimizeDoor() {
    setMinimized(true);
    setVideoExpanded(false);
    requestAnimationFrame(() => miniRef.current?.focus({ preventScroll: true }));
  }

  function endCall() {
    setCallStarted(null);
    setMuted(false);
    setDoorOpen(false);
    setVideoExpanded(false);
    setMessage(scenario === "help" ? "Call preview ended. The care alert stays open until you clear it." : "Visitor preview ended. Existing care alerts have not been changed.");
    requestAnimationFrame(() => openDoorRef.current?.focus({ preventScroll: true }));
  }

  function joinCall() {
    if (scenario === "help" && !activity.owned.includes("door-help") &&
      !persist({ ...activity, owned: [...activity.owned, "door-help"] })) return;
    setCallStarted(Date.now());
    setMuted(false);
  }

  function clearAlert(id: PreviewAlertId) {
    if (activity.cleared.includes(id)) return;
    if (persist({ ...activity, cleared: [...activity.cleared, id] })) {
      setMessage("Removed from open alerts. The event remains in care history.");
    }
  }

  function renderAlert(alert: typeof alerts[number], history = false) {
    const owned = activity.owned.includes(alert.id) || (alert.id === "door-help" && connected && scenario === "help");
    const cleared = activity.cleared.includes(alert.id);
    return (
      <article className="home-alert" key={alert.id}>
        <div className="home-alert__meta">
          <span className={`home-status${alert.id === "door-help" && !owned && !cleared ? " home-status--urgent" : ""}`}>{cleared ? "Cleared" : owned ? "Owned by you" : alert.id === "door-help" ? "Help now · unassigned" : "Needs an owner"}</span>
          <time>{alert.time}</time>
        </div>
        <h3>{alert.title}</h3>
        <p>{alert.detail}</p>
        {!history && <div className="home-alert__actions">
          {alert.id === "door-help"
            ? <button className="cs-button cs-button--primary" onClick={() => openDoor()} ref={drawer ? undefined : openDoorRef} type="button">Open door help alert</button>
            : <button className="cs-button cs-button--primary" disabled={owned} onClick={() => persist({ ...activity, owned: [...activity.owned, alert.id] })} type="button">{owned ? "You’re handling this" : "I’ll handle this"}</button>}
          <button aria-label={`Clear ${alert.title}`} className="cs-button cs-button--glass home-alert__clear" onClick={() => clearAlert(alert.id)} type="button"><span aria-hidden="true"><X aria-hidden="true" size={18} strokeWidth={2} /></span> Clear</button>
        </div>}
      </article>
    );
  }

  function renderMoments() {
    return <div className="home-moments">{previewMoments.map((moment) => (
      <div className="home-moment" key={moment.icon}>
        <span className="home-moment__icon"><HomeIcon name={moment.icon} /></span>
        <span className="home-moment__copy"><strong>{moment.title}</strong><small>{moment.detail}</small></span>
        <time>{moment.time}</time>
      </div>
    ))}</div>;
  }

  const titles: Record<Exclude<Drawer, null>, string> = {
    alerts: "Open care alerts", history: "Care history", logs: `What ${recipient} logged`,
    "check-ins": "Scheduled check-ins", circle: "Care circle", devices: "Door and Ring", profile: "Profile & preview",
  };

  return (
    <main className={`onboarding-screen care-home caregiver-home ${inter.variable} ${jakarta.variable}`}>
      <StatusBar />
      <CareHomeHeader initials={initial.setup ? initials(caregiver) : "EA"} onAccount={() => setDrawer("profile")} onSimulate={() => { setDrawer(null); setSimulating(true); }} />
      <div className={`onboarding-body caregiver-home__body${doorOpen && minimized ? " caregiver-home__body--call" : ""}`}>
        <header className="caregiver-home__greeting">
          <p>{date}</p>
          <h1>Hello {greeting}.<br />It’s good to have you here.</h1>
        </header>
        <CaregiverSimulations open={simulating} onClose={() => setSimulating(false)} />
        <section aria-label="Duty and household overview" className="home-overview">
          <div className="home-duty home-glass">
            <div><div className="home-duty__heading"><span>On Duty</span><Link href="/onboarding?step=5">Manage</Link></div><strong>You ·</strong><span>{initial.setup?.dutyShift ?? "10:00 AM until 6:00 PM"}</span></div>
            <div><div className="home-duty__heading"><span>Backup</span><Link href="/onboarding?step=5">Manage</Link></div><strong>{initial.setup ? backup : "Jared"} ·</strong><span>{initial.setup?.dutyShift ?? "10:00 AM until 6:00 PM"}</span></div>
          </div>
          <div className="home-metrics">
            {[
              { icon: "check-ins", count: 3, title: "Scheduled Check-Ins", caption: "Today", view: "check-ins" },
              { icon: "circle", count: initial.setup?.members.length ?? 3, title: "Care Circle Update", caption: "New messages", view: "circle" },
              { icon: "door", count: activity.cleared.includes("door-help") ? 1 : 2, title: "DoorSense Alerts", caption: "Front door", view: "door" },
              { icon: "bell", count: openAlerts.length + 1, title: "Alerts & Reminders", caption: "Due Today", view: "alerts" },
            ].map((metric) => (
              <button className="home-metric home-glass" key={metric.icon} onClick={() => {
                if (metric.view === "door") openDoor("visitor");
                else if (metric.view === "check-ins" || metric.view === "circle" || metric.view === "alerts") setDrawer(metric.view);
              }} type="button">
                <span className="home-metric__icon"><HomeIcon name={metric.icon} /></span>
                <strong>{metric.count}</strong><span>{metric.title}</span><small>{metric.caption}</small>
              </button>
            ))}
          </div>
        </section>
        <div className="caregiver-home__cards">
          <section className="care-card home-open-alerts">
            <div className="home-section-heading"><h2>Open care alerts</h2><button onClick={() => setDrawer("alerts")} type="button">View all · {openAlerts.length}</button></div>
            {openAlerts.map((alert) => renderAlert(alert))}
            {!openAlerts.length && <p className="care-body-copy">You’re all caught up. There are no open care alerts.</p>}
            <p className="home-footnote">No longer relevant? Clear it from the open list. The event stays in <button onClick={() => setDrawer("history")} type="button">care history</button>.</p>
          </section>
          <section className="care-card">
            <div className="home-section-heading"><h2>What {recipient} logged</h2><button onClick={() => setDrawer("logs")} type="button">Today·&nbsp; See all</button></div>
            {renderMoments()}
          </section>
          <section className="care-card home-medicine">
            <div className="home-section-heading"><h2>Medicine today</h2><span className="home-status home-status--good">On track</span></div>
            <div aria-label="One of two doses logged" className="home-dose-progress" role="img"><span /><span /></div>
            <div className="home-dose"><HomeIcon name="checked" /><span><strong>Morning · 8:00 AM</strong><small>Mom confirmed at 8:20 AM</small></span><em>Taken</em></div>
            <div className="home-dose"><HomeIcon name="clock" /><span><strong>Evening · 7:00 PM</strong><small>Reminder scheduled</small></span><em>Later</em></div>
            <p className="home-footnote">Based on Mom’s logs, not automatic confirmation.</p>
          </section>
          <section className="care-card home-device">
            <div className="home-section-heading"><h2>Door and Ring</h2><button onClick={() => setDrawer("devices")} type="button">Manage</button></div>
            <div className="home-device__connection">
              <span className="home-device__icon"><HomeIcon name="door-open" size={24} /></span>
              <span><strong>Front door</strong><small>Ring Video Doorbell</small></span><span className="home-status home-status--good">Online</span>
            </div>
            <div className="home-device__health"><span><HomeIcon name="wifi" size={16} />Wi-Fi good</span><span><HomeIcon name="battery" size={18} />Battery 82%</span></div>
            <p className="care-muted">DoorSense is watching for door events. Live video is open for Mom’s help request.</p>
            <p className="home-footnote">Last synced 11:42 AM · door lock not connected</p>
          </section>
        </div>
      </div>
      <CaregiverLiveWatchers />
      <CareHomeFooter />
      {doorOpen && minimized && (
        <button className="door-help-mini home-glass" onClick={() => setMinimized(false)} ref={miniRef} type="button">
          <HomeIcon name="doorsense" size={24} /><span>{connected ? `Helping ${recipient} · ${formatCallDuration(seconds)}` : scenario === "help" ? `${recipient} needs help at the door` : "Visitor at the front door"}<small>{connected ? muted ? "Microphone preview muted" : "Call preview in progress" : "Open DoorSense preview"}</small></span>
          <HomeIcon name="expand" />
        </button>
      )}
      {panelExpanded && (
        <section
          aria-label={connected ? `Helping ${recipient}` : "DoorSense alert"}
          className={`door-help-panel${connected ? " door-help-panel--connected" : ""}${videoExpanded ? " door-help-panel--video" : ""}`}
          onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (videoExpanded) setVideoExpanded(false); else minimizeDoor(); } }}
          ref={panelRef} tabIndex={-1}
        >
          <header className="door-help-panel__heading">
            <div className="door-help-panel__top"><span className="door-help-label"><HomeIcon name="doorsense" size={24} />DoorSense</span><button aria-label="Minimize door alert" className="door-icon-button" onClick={minimizeDoor} type="button"><HomeIcon name="minimize" size={24} /></button></div>
            <h2>{connected ? scenario === "help" ? `Helping ${recipient}` : "Speaking with the visitor" : scenario === "help" ? `${recipient} requested for help at the door.` : "A visitor is at the front door."}</h2>
          </header>
          {connected && <div className="door-call-status"><span className="home-status">Connected · {formatCallDuration(seconds)}</span><span>On call: You{scenario === "help" ? `, ${recipient}` : ", Visitor"}</span></div>}
          <div className="door-video">
            <Image alt="Visitor holding a parcel on the front porch — preview still image" className="door-video__image" fill priority sizes="(min-width: 900px) 480px, 100vw" src="/images/caregiver-home/visitor.png" />
            <div className="door-video__top"><span className="door-video__live"><span />PREVIEW</span><button aria-label={videoExpanded ? "Close expanded video" : "Expand video"} className="door-video__expand" onClick={() => setVideoExpanded(!videoExpanded)} type="button"><HomeIcon name={videoExpanded ? "minimize" : "expand"} size={18} /></button></div>
            <span className="door-video__caption">Front door · Ring · {connected ? "Call preview" : "Sound off"}</span>
          </div>
          {connected && (
            <div className="door-mic-notice">
              <span aria-hidden="true" className="door-waveform"><i /><i /><i /><i /><i /></span>
              <span><strong>{muted ? "Your microphone is muted" : "Your microphone is on"}</strong><small>Call preview only. No audio is captured or sent.</small></span>
            </div>
          )}
          <div className="door-help-panel__actions">
            <button aria-pressed={connected ? muted : undefined} className="cs-button cs-button--primary" onClick={() => connected ? setMuted(!muted) : joinCall()} type="button"><HomeIcon name={connected ? "mute" : "video"} size={24} />{connected ? muted ? "Unmute" : "Mute" : "Join call"}</button>
            <button className="cs-button cs-button--glass door-end-call" onClick={endCall} type="button"><HomeIcon name={connected ? "leave" : "decline"} size={24} />{connected ? "Leave call" : "Decline call"}</button>
          </div>
          {connected
            ? <p className="home-footnote">Stay connected while you browse Home. Leaving this call won’t clear the care alert.</p>
            : <div className="door-help-panel__related"><div><span>{activity.owned.includes("door-help") && scenario === "help" ? "Owned by you" : "Waiting for an owner"}</span><button onClick={() => { minimizeDoor(); setDrawer("alerts"); }} type="button">Open alert <ArrowUpRight aria-hidden="true" size={16} /></button></div><p className="home-footnote">{scenario === "help" ? `${backup} is next in the preview escalation plan at 11:44 if no one takes this.` : "Visitor detected by the front door camera."}</p></div>}
        </section>
      )}
      {drawer && <BottomDrawer title={titles[drawer]} onClose={() => setDrawer(null)}>
        <div className="home-drawer-content">
          {message && <div className="home-drawer-message" role="status"><span>{message}</span><button aria-label="Dismiss message" className="care-message-dismiss" onClick={() => setMessage("")} type="button"><X aria-hidden="true" size={18} strokeWidth={2} /></button></div>}
          {(drawer === "alerts" || drawer === "history") && <>
            {(drawer === "history" ? alerts : openAlerts).map((alert) => renderAlert(alert, drawer === "history"))}
            {drawer === "alerts" && !openAlerts.length && <p className="care-body-copy">No open care alerts.</p>}
            {drawer === "alerts" && <button className="care-text-button" onClick={() => setDrawer("history")} type="button">View care history</button>}
          </>}
          {drawer === "logs" && renderMoments()}
          {drawer === "check-ins" && <><p className="care-body-copy">Three check-ins are shown in this design preview.</p><Link className="care-text-button" href="/onboarding?step=6">Manage check-in preferences</Link><p className="care-muted">No reminder notifications are scheduled by this preview.</p></>}
          {drawer === "circle" && <><p className="care-body-copy">Keep up with your household and care team.</p><Link className="care-text-button" href="/onboarding?step=4">Manage care team members</Link><Link className="care-text-button" href="/onboarding?step=7">Review your household</Link></>}
          {drawer === "devices" && <><p className="care-body-copy">This design preview uses a still image, sample device health and local call controls. No camera or microphone is connected.</p><button className="cs-button cs-button--primary care-inline-button" onClick={() => openDoor("visitor")} type="button">Preview visitor alert</button><Link className="care-text-button" href="/setup">Open device setup</Link></>}
          {drawer === "profile" && <>
            <p className="care-body-copy">Design preview · The activity, visitor image and call states here are sample data. Actions are saved only on this device, separate from your operational household.</p>
            <Link className="care-text-button" href="/onboarding?step=1">Edit your profile</Link>
            <button className="cs-button cs-button--primary care-inline-button" onClick={() => openDoor()} type="button">Preview help request</button>
            <button className="cs-button cs-button--glass care-inline-button" onClick={() => openDoor("visitor")} type="button">Preview visitor alert</button>
            <button className="care-text-button" onClick={() => { if (persist(emptyHomePreview)) { setDrawer(null); setCallStarted(null); setMuted(false); setDoorOpen(false); setMessage("Home activity preview reset."); } }} type="button">Reset preview activity</button>
            <Link className="care-text-button" href="/care-circle">View setup-ready home</Link>
          </>}
        </div>
      </BottomDrawer>}
      {message && !drawer && <div className="onboarding-message" role="status"><span>{message}</span><button aria-label="Dismiss message" className="care-message-dismiss" onClick={() => setMessage("")} type="button"><X aria-hidden="true" size={18} strokeWidth={2} /></button></div>}
    </main>
  );
}
