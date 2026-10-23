"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { alertStatusLabel, escalationNextStep, minutesUntilEscalate } from "@/lib/agents";
import { formatWhen, memberById, openAlerts } from "@/lib/engine";
import { useStore } from "@/lib/store";
import type { Alert } from "@/lib/types";
import { CarePills, CareSection, CareWorkspace, EmptyCareState } from "./CareWorkspace";
import { BottomDrawer } from "./BottomDrawer";

type Bucket = "escalated" | "open" | "acknowledged";
const bucketTitles: Record<Bucket, string> = { escalated: "Escalated to backup", open: "Awaiting acceptance", acknowledged: "Accepted · in progress" };
export const alertIsActive = (alert: Alert) => ["open", "escalated", "acknowledged"].includes(alert.status);

function railPosition(element: HTMLDivElement) {
  const card = element.firstElementChild as HTMLElement | null;
  const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
  return {
    position: card ? Math.round(element.scrollLeft / (card.offsetWidth + gap)) : 0,
    atStart: element.scrollLeft <= 1,
    atEnd: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
  };
}

export function CareAlerts() {
  const router = useRouter();
  const { state, runEscalationPass, acknowledgeAlert, clearAlert } = useStore();
  const history = useSearchParams().get("view") === "history";
  const [selectedBucket, setBucket] = useState<Bucket | null>(null);
  const bucket = selectedBucket ?? (state.alerts.some((alert) => alert.status === "escalated") ? "escalated" : state.alerts.some((alert) => alert.status === "open") ? "open" : state.alerts.some((alert) => alert.status === "acknowledged") ? "acknowledged" : "escalated");
  const [clearId, setClearId] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [railState, setRailState] = useState({ position: 0, atStart: true, atEnd: true });
  const rail = useRef<HTMLDivElement>(null);
  const active = openAlerts(state);
  const alerts = (history ? state.alerts.filter((alert) => !alertIsActive(alert)) : state.alerts.filter((alert) => alert.status === bucket)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const clearing = state.alerts.find((alert) => alert.id === clearId);
  const railKey = `${history}:${bucket}:${alerts.map((alert) => alert.id).join(",")}`;

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    element.scrollTo({ left: 0 });
    const update = () => setRailState(railPosition(element));
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [railKey]);

  function browse(direction: number) {
    const element = rail.current;
    const card = element?.firstElementChild as HTMLElement | null;
    if (element && card) element.scrollBy({ left: direction * (card.offsetWidth + (parseFloat(getComputedStyle(element).columnGap) || 0)), behavior: "smooth" });
  }

  function select(next: Bucket) {
    setBucket(next);
  }
  return <CareWorkspace title={history ? "Care history" : "Care alerts"} active="alerts" back={history ? { href: "/escalation", label: "Alerts" } : undefined} action={!history && <Link className="care-text-button" href="/escalation?view=history">History <span aria-hidden="true"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></span></Link>}>
    <div className="workspace-stack">
      {!history && <>
        <p className="workspace-summary">{active.length} open · {active.filter((alert) => alert.status !== "acknowledged").length} awaiting acceptance</p>
        <div className="alerts-check"><span>{checkedAt ? `Checked ${checkedAt}` : "Response timers follow your care rules"}</span><button className="care-text-button" onClick={() => { runEscalationPass(); setCheckedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })); }} type="button">Check responses</button></div>
        <CarePills label="Alert status" value={bucket} options={(Object.keys(bucketTitles) as Bucket[]).map((value) => ({ value, label: bucketTitles[value], count: state.alerts.filter((alert) => alert.status === value).length }))} onChange={select} />
      </>}
      <CareSection title={history ? "Previous care alerts" : bucketTitles[bucket]} className="alerts-section" action={!history && alerts.length > 1 ? <div className="alerts-rail-controls"><button aria-label="Previous alert" disabled={railState.atStart} onClick={() => browse(-1)} type="button"><ChevronLeft aria-hidden="true" size={18} strokeWidth={2} /></button><button aria-label="Next alert" disabled={railState.atEnd} onClick={() => browse(1)} type="button"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></button></div> : undefined}>
        {alerts.length ? <div className={history ? "workspace-stack" : "alerts-rail"} aria-label={history ? "Alert history" : bucketTitles[bucket]} ref={rail} onScroll={(event) => {
          setRailState(railPosition(event.currentTarget));
        }}>
          {alerts.map((alert) => {
            const remaining = minutesUntilEscalate(state, alert);
            return <article className={`home-alert alerts-item${alert.status === "escalated" ? " alerts-item--urgent" : ""}`} key={alert.id}>
              <div className="home-alert__meta"><span className={`care-chip${alert.severity === "urgent" ? " care-chip--pending" : " care-chip--blue"}`}>{alert.severity === "urgent" ? "Help now" : alert.severity === "attention" ? "Needs attention" : "Routine"}</span><time dateTime={alert.createdAt}>{formatWhen(alert.createdAt)}</time></div>
              <Link className="alerts-title-link" href={`/alerts/${alert.id}`}><h3>{alert.title}</h3><span aria-hidden="true"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></span></Link>
              <p>{alert.summary}</p>
              <div className="alerts-ownership"><strong>{alert.status === "acknowledged" ? `${memberById(state, alert.ownerId)?.name ?? "Caregiver"} accepted` : alert.status === "escalated" ? `${memberById(state, alert.backupId)?.name ?? "Backup"} is responsible` : alert.status === "open" ? `Waiting for ${memberById(state, alert.onDutyId)?.name ?? "the on-duty caregiver"}` : alertStatusLabel(alert.status)}</strong><p>{history ? alert.resolveNote || "Retained in care history." : alert.status === "open" ? `Backup in ${remaining ?? 0} min if no one accepts.` : escalationNextStep(state, alert)}</p></div>
              {!history && <><button className="cs-button cs-button--primary" onClick={() => {
                if (alert.status !== "acknowledged") acknowledgeAlert(alert.id);
                router.push(`/alerts/${alert.id}`);
              }} type="button">{alert.status === "acknowledged" ? "Continue care" : "Accept & take ownership"}</button><div className="alerts-item__footer"><Link className="care-text-button" href={`/alerts/${alert.id}`}>View alert</Link><button className="care-text-button alerts-clear" onClick={() => setClearId(alert.id)} type="button"><span aria-hidden="true"><X aria-hidden="true" size={18} strokeWidth={2} /></span> Clear</button></div></>}
              {history && <Link className="cs-button cs-button--glass" href={`/alerts/${alert.id}`}>View care history</Link>}
            </article>;
          })}
        </div> : <EmptyCareState title={history ? "No past alerts yet" : bucket === "escalated" ? "No escalated alerts" : bucket === "open" ? "Nothing awaiting acceptance" : "No care in progress"} detail={history ? "Resolved and cleared alerts will stay here." : active.length ? "Choose another status pill to view your other alerts." : "New care alerts will appear here when they need attention."} />}
        {!history && alerts.length > 1 && <p aria-live="polite" className="alerts-position">{Math.min(railState.position + 1, alerts.length)} of {alerts.length} · Swipe to browse</p>}
      </CareSection>
      {!history && <p className="settings-note">Accepting takes ownership and stops escalation. It doesn’t mark care complete.</p>}
    </div>
    {clearing && <BottomDrawer title="Clear this care alert?" onClose={() => setClearId(null)}><div className="settings-form"><p className="care-body-copy">{clearing.title}</p><p className="care-muted">Remove it from open alerts without marking care as completed. Its timeline stays in history, and any follow-up tasks stay open.</p><button className="cs-button cs-button--primary" onClick={() => { clearAlert(clearing.id); setClearId(null); }} type="button">Clear from open alerts</button><button className="cs-button cs-button--glass" onClick={() => setClearId(null)} type="button">Keep alert open</button></div></BottomDrawer>}
  </CareWorkspace>;
}
