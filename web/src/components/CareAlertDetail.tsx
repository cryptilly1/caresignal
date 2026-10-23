"use client";

import { Check, ChevronRight } from "lucide-react";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { alertStatusLabel, escalationNextStep } from "@/lib/agents";
import { formatWhen, memberById } from "@/lib/engine";
import { useStore } from "@/lib/store";
import type { Alert } from "@/lib/types";
import { BottomDrawer, DrawerOption, memberDrawerChoice } from "./BottomDrawer";
import { CareSection, CareWorkspace, EmptyCareState } from "./CareWorkspace";

export function CareAlertDetail() {
  const { id } = useParams<{ id: string }>();
  const { state, hydrated, acknowledgeAlert, completeStep, handOffAlert, resolveAlert, escalateAlert } = useStore();
  const [drawer, setDrawer] = useState<"handoff" | "resolve" | null>(null);
  const alert = state.alerts.find((item) => item.id === id);
  if (!alert) return <CareWorkspace title="Care alert" active="alerts" back={{ href: "/escalation", label: "Alerts" }}><CareSection title={hydrated ? "Alert not found" : "Loading care alert"}><EmptyCareState title={hydrated ? "This alert isn’t available" : "Loading…"} detail={hydrated ? "Return to Alerts to see this household’s care activity." : "Waiting for the household."} /><Link className="cs-button cs-button--glass" href="/escalation">Back to alerts</Link></CareSection></CareWorkspace>;
  const active = ["open", "acknowledged", "escalated"].includes(alert.status);
  const accepted = alert.status === "acknowledged";
  const steps = state.playbooks[alert.type];
  const doneCount = steps.filter((step) => alert.completedSteps.includes(step.id)).length;
  const tasks = state.assignments.filter((task) => task.alertId === alert.id);
  const owner = memberById(state, alert.ownerId);
  const caregivers = state.members.filter((member) => member.role === "care_lead" || member.role === "caregiver");

  return <CareWorkspace title={alert.title} active="alerts" back={{ href: active ? "/escalation" : "/escalation?view=history", label: active ? "Alerts" : "Care history" }}>
    <div className="workspace-stack">
      <div className="alert-detail-meta"><span className={`care-chip${alert.severity === "urgent" ? " care-chip--pending" : " care-chip--blue"}`}>{alert.severity === "urgent" ? "Help now" : alert.severity === "attention" ? "Needs attention" : "Routine"}</span><span>{alertStatusLabel(alert.status)}</span></div>
      <p className="workspace-lead">{alert.summary}</p>
      <time className="settings-note" dateTime={alert.createdAt}>{formatWhen(alert.createdAt)}</time>
      <CareSection title={accepted ? "Incident owner" : active ? "Take responsibility" : "Care outcome"}>
        <div className="alert-owner"><span className="settings-avatar">{accepted || !active ? (owner?.name ?? "?").slice(0, 2).toUpperCase() : "—"}</span><span><strong>{accepted || !active ? owner?.name ?? "Caregiver" : "Awaiting acceptance"}</strong><small>{accepted ? `Accepted ${formatWhen(alert.acknowledgedAt ?? alert.createdAt)} · escalation stopped` : alert.status === "escalated" ? `${memberById(state, alert.backupId)?.name ?? "Backup"} is responsible until someone accepts` : active ? `${memberById(state, alert.onDutyId)?.name ?? "Caregiver"} is on duty` : alertStatusLabel(alert.status)}</small></span></div>
        {active && <><div className="alerts-ownership"><p>{escalationNextStep(state, alert)}</p></div>{!accepted ? <button className="cs-button cs-button--primary" onClick={() => acknowledgeAlert(alert.id)} type="button">Accept & take ownership</button> : <p className="care-body-copy">{doneCount === steps.length ? "The playbook is complete. Confirm the outcome when care is finished." : "Follow the playbook and confirm everyone has what they need."}</p>}</>}
        {!active && <><p className="care-body-copy">{alert.resolveNote || (alert.status === "cleared" ? "Removed from the open list without marking care complete." : "No outcome note was added.")}</p>{alert.resolvedAt && <time className="settings-note" dateTime={alert.resolvedAt}>{formatWhen(alert.resolvedAt)}</time>}</>}
      </CareSection>
      <CareSection title="Your playbook" action={<span className="settings-note">{doneCount} of {steps.length}</span>}>
        {steps.length > 0 && <div className="alert-step-progress" aria-label={`${doneCount} of ${steps.length} playbook steps completed`} role="img">{steps.map((step) => <span className={alert.completedSteps.includes(step.id) ? "is-done" : ""} key={step.id} />)}</div>}
        <ol className="alert-steps">{steps.map((step) => {
          const done = alert.completedSteps.includes(step.id);
          return <li key={step.id}><button aria-label={`${done ? "Completed" : "Complete"}: ${step.label}`} aria-pressed={done} className="alert-step-check" disabled={!active || !accepted || done} onClick={() => completeStep(alert.id, step.id)} type="button">{done ? <Check aria-hidden="true" size={18} /> : null}</button><span className={done ? "is-complete" : ""}>{step.label}</span></li>;
        })}</ol>
        {active && !accepted && <p className="settings-note">Accept ownership before marking playbook steps complete.</p>}
      </CareSection>
      <CareSection title="Care circle follow-up" action={active && <Link className="care-text-button" href={`/assignments?view=new&alert=${encodeURIComponent(alert.id)}`}>Add task</Link>}>
        {tasks.length ? <div className="settings-list">{tasks.map((task) => <Link className="settings-row" href={`/assignments?task=${encodeURIComponent(task.id)}`} key={task.id}><span className="settings-row__copy"><strong>{task.title}</strong><small>{memberById(state, task.toId)?.name ?? "Caregiver"} · {task.status === "done" ? "Done" : task.status === "cant_do" ? "Can’t do" : `Due ${formatWhen(task.dueAt)}`}</small></span><span className="settings-chevron" aria-hidden="true"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></span></Link>)}</div> : <p className="care-body-copy">No follow-up tasks assigned.</p>}
        <p className="settings-note">Follow-up tasks stay open after this alert is resolved or cleared.</p>
      </CareSection>
      {active && <CareSection title="Need someone else?"><div className="settings-list">
        {accepted && <button className="settings-row" onClick={() => setDrawer("handoff")} type="button"><span className="settings-row__copy"><strong>Hand off ownership</strong><small>Transfer this incident to another caregiver</small></span><span className="settings-chevron" aria-hidden="true"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></span></button>}
        {alert.status === "open" && <button className="settings-row" onClick={() => escalateAlert(alert.id)} type="button"><span className="settings-row__copy"><strong>Escalate to backup now</strong><small>{memberById(state, alert.backupId)?.name ?? "Backup"} becomes responsible</small></span><span className="settings-chevron" aria-hidden="true"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></span></button>}
        {alert.type !== "quiet_miss" && alert.type !== "visit_missed" && <Link className="settings-row" href="/doorsense"><span className="settings-row__copy"><strong>Open door devices</strong><small>Use your connected camera service</small></span><span className="settings-chevron" aria-hidden="true"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></span></Link>}
      </div></CareSection>}
      <CareSection title="Timeline"><ol className="care-alert-timeline">{[...alert.timeline].reverse().map((entry) => <li key={entry.id}><time dateTime={entry.at}>{formatWhen(entry.at)}</time><span>{entry.text}</span></li>)}</ol></CareSection>
      {active && <button className="cs-button cs-button--primary" onClick={() => setDrawer("resolve")} type="button">Resolve alert…</button>}
    </div>
    {drawer === "resolve" && active && <BottomDrawer title="How did it turn out?" onClose={() => setDrawer(null)}><ResolveAlert alert={alert} onResolve={(outcome, note) => { resolveAlert(alert.id, outcome, note); setDrawer(null); }} /></BottomDrawer>}
    {drawer === "handoff" && active && <BottomDrawer title="Hand off ownership" onClose={() => setDrawer(null)}><div className="settings-form"><p className="care-body-copy">Ownership transfers immediately. This is not a request for the other caregiver to accept.</p><div className="drawer-options">{caregivers.filter((member) => member.id !== alert.ownerId).map((member) => <DrawerOption {...memberDrawerChoice(member)} key={member.id} onClick={() => { handOffAlert(alert.id, member.id); setDrawer(null); }} />)}</div>{caregivers.length < 2 && <p className="care-muted">No other caregiver is available.</p>}</div></BottomDrawer>}
  </CareWorkspace>;
}

function ResolveAlert({ alert, onResolve }: { alert: Alert; onResolve: (outcome: "resolved_fine" | "resolved_helped", note?: string) => void }) {
  const [outcome, setOutcome] = useState<"resolved_fine" | "resolved_helped" | "">("");
  const [note, setNote] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); if (outcome) onResolve(outcome, note.trim() || undefined); }
  return <form className="settings-form" onSubmit={submit}><p className="care-body-copy">{alert.title}</p><fieldset className="alert-outcome-options"><legend className="settings-field-label">Choose an outcome</legend>{([{ value: "resolved_fine", label: "All fine" }, { value: "resolved_helped", label: "Needed a check" }] as const).map((option) => <label key={option.value}><input type="radio" name="outcome" value={option.value} checked={outcome === option.value} onChange={() => setOutcome(option.value)} required /><span>{option.label}</span></label>)}</fieldset><label className="onboarding-field"><span>Outcome note <small>(optional)</small></span><textarea maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What happened and how things are now" /></label><p className="settings-note">Shared with the household. Follow-up tasks stay in Care circle.</p><button className="cs-button cs-button--primary" disabled={!outcome} type="submit">Resolve alert</button></form>;
}
