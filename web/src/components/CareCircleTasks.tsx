"use client";

import { ArrowUpRight, ChevronRight, Plus } from "lucide-react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatWhen, memberById, now } from "@/lib/engine";
import { useStore } from "@/lib/store";
import type { Assignment, MemberId } from "@/lib/types";
import { DrawerSelect, DurationSelect, memberDrawerChoice } from "./BottomDrawer";
import { CarePills, CareSection, CareWorkspace, EmptyCareState } from "./CareWorkspace";

type TaskTab = "mine" | "open" | "done";
const taskIsOpen = (task: Assignment) => task.status === "open" || task.status === "overdue";
const taskStatus = (task: Assignment, time: Date) => task.status === "done" ? "Done" : task.status === "cant_do" ? "Can’t do" : task.status === "overdue" || new Date(task.dueAt) < time ? "Overdue" : "Open";

export function CareCircleTasks() {
  const search = useSearchParams();
  const { state, hydrated, completeAssignment } = useStore();
  const [tab, setTab] = useState<TaskTab>("mine");
  const newTask = search.get("view") === "new";
  const taskId = search.get("task");
  const task = state.assignments.find((item) => item.id === taskId);
  const mine = state.assignments.filter((item) => taskIsOpen(item) && item.toId === state.currentUserId);
  const open = state.assignments.filter(taskIsOpen);
  const done = state.assignments.filter((item) => !taskIsOpen(item));
  const displayed = tab === "mine" ? mine : tab === "open" ? open : done;
  const time = now(state);
  return <CareWorkspace title={newTask ? "New care task" : taskId ? "Care task" : "Care circle"} active="circle" back={newTask || taskId ? { href: "/assignments", label: "Care circle" } : undefined} action={!newTask && !taskId && <Link className="care-text-button" href="/setup?section=members">Members <span aria-hidden="true"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></span></Link>}>
    <div className="workspace-stack">
      {newTask ? <NewCareTask key={search.get("alert") ?? "new"} alertId={search.get("alert") ?? undefined} /> : taskId ? task ? <>
        <CareSection title={task.title}><span className={`care-chip${taskStatus(task, time) === "Overdue" ? " care-chip--pending" : " care-chip--blue"}`}>{taskStatus(task, time)}</span><dl className="care-task-facts"><div><dt>Assigned to</dt><dd>{memberById(state, task.toId)?.name ?? "Caregiver"}</dd></div><div><dt>From</dt><dd>{memberById(state, task.fromId)?.name ?? "Caregiver"}</dd></div><div><dt>Due</dt><dd>{formatWhen(task.dueAt)}</dd></div></dl>{task.alertId && <Link className="cs-button cs-button--glass" href={`/alerts/${encodeURIComponent(task.alertId)}`}>Open related care alert</Link>}{taskIsOpen(task) && task.toId === state.currentUserId ? <div className="care-task-actions"><button className="cs-button cs-button--primary" onClick={() => completeAssignment(task.id, "done")} type="button">Mark done</button><button className="cs-button cs-button--glass" onClick={() => completeAssignment(task.id, "cant_do")} type="button">Can’t do</button></div> : taskIsOpen(task) && <p className="settings-note">{memberById(state, task.toId)?.name ?? "The assigned caregiver"} can update this task.</p>}</CareSection>
        <CareSection title="Task activity"><div className="settings-inset"><strong>Assigned by {memberById(state, task.fromId)?.name ?? "a caregiver"}</strong><time className="settings-note" dateTime={task.createdAt}>{formatWhen(task.createdAt)}</time></div></CareSection>
      </> : <CareSection title={hydrated ? "Task not found" : "Loading task"}><EmptyCareState title={hydrated ? "This task isn’t available" : "Loading…"} detail="Return to Care circle to see current tasks." /></CareSection> : <>
        <Link className="cs-button cs-button--primary care-task-add" href="/assignments?view=new"><Plus aria-hidden="true" size={18} /> Add a care task</Link>
        <CarePills label="Care circle tasks" value={tab} options={[{ value: "mine", label: "Assigned to me", count: mine.length }, { value: "open", label: "All open", count: open.length }, { value: "done", label: "Completed & declined", count: done.length }]} onChange={setTab} />
        <CareSection title={tab === "mine" ? "Your follow-through" : tab === "open" ? "Household tasks" : "Previous tasks"}>
          {displayed.length ? <div className="care-task-list">{displayed.map((item) => <article className="settings-inset care-task" key={item.id}><div className="home-alert__meta"><span className={`care-chip${taskStatus(item, time) === "Overdue" ? " care-chip--pending" : " care-chip--blue"}`}>{taskStatus(item, time)}</span><time dateTime={item.dueAt}>{formatWhen(item.dueAt)}</time></div><Link className="alerts-title-link" href={`/assignments?task=${encodeURIComponent(item.id)}`}><h3>{item.title}</h3><span aria-hidden="true"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></span></Link><div className="care-task-assignee"><span className="settings-avatar">{(memberById(state, item.toId)?.name ?? "?").slice(0, 2).toUpperCase()}</span><span><strong>{memberById(state, item.toId)?.name ?? "Caregiver"}</strong><small>From {memberById(state, item.fromId)?.name ?? "caregiver"}</small></span></div>{item.alertId && <Link className="care-text-button" href={`/alerts/${encodeURIComponent(item.alertId)}`}>Related care alert <span aria-hidden="true"><ArrowUpRight aria-hidden="true" size={18} strokeWidth={2} /></span></Link>}{taskIsOpen(item) && item.toId === state.currentUserId && <div className="care-task-actions"><button className="cs-button cs-button--primary" onClick={() => completeAssignment(item.id, "done")} type="button">Mark done</button><button className="cs-button cs-button--glass" onClick={() => completeAssignment(item.id, "cant_do")} type="button">Can’t do</button></div>}</article>)}</div> : <EmptyCareState title={tab === "mine" ? "Nothing assigned to you" : tab === "open" ? "No open care tasks" : "No previous tasks yet"} detail={tab === "mine" ? "Check all open tasks or add follow-up for your care circle." : tab === "open" ? "Add a task when something needs a little follow-through." : "Completed and declined tasks will stay here."} />}
        </CareSection>
        <CareSection title="People in your circle" action={<Link className="care-text-button" href="/setup?section=members">Manage</Link>}><div className="care-circle-people">{state.members.map((member) => <div key={member.id}><span className="settings-avatar">{member.name.slice(0, 2).toUpperCase()}</span><strong>{member.name}</strong><small>{member.role === "person_at_home" ? "Receiver" : member.role === "care_lead" ? "Care lead" : member.role === "view_only" ? "View only" : "Caregiver"}</small></div>)}</div><p className="settings-note">Demo members · individual sign-in is not connected yet.</p></CareSection>
      </>}
    </div>
  </CareWorkspace>;
}

function NewCareTask({ alertId }: { alertId?: string }) {
  const router = useRouter();
  const { state, hydrated, assignTask } = useStore();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<MemberId | "">("");
  const [due, setDue] = useState(60);
  const [error, setError] = useState("");
  const members = state.members.filter((member) => member.role === "care_lead" || member.role === "caregiver");
  const alert = state.alerts.find((item) => item.id === alertId);
  const alertActive = alert && ["open", "acknowledged", "escalated"].includes(alert.status);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !assignee || !members.some((member) => member.id === assignee)) { setError("Add a task and choose a caregiver."); return; }
    if (alertId && !alertActive) { setError("This alert is no longer open. Return to Care circle to create a standalone task."); return; }
    assignTask({ title: title.trim(), toId: assignee, dueMinutes: due, alertId });
    router.push("/assignments");
  }
  return <CareSection title="A little follow-through"><form className="settings-form" onSubmit={submit}>
    <label className="onboarding-field"><span>What needs doing?</span><textarea autoComplete="off" maxLength={240} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Arrange a medicine refill" /></label>
    <DrawerSelect label="Assign to" value={assignee} options={members.map(memberDrawerChoice)} onChange={setAssignee} placeholder="Choose a caregiver" />
    <DurationSelect label="Due" value={due} presets={[{ value: 30, label: "In 30 minutes" }, { value: 60, label: "In 1 hour" }, { value: 120, label: "In 2 hours" }, { value: 240, label: "In 4 hours" }, { value: 1440, label: "In 1 day" }, { value: 4320, label: "In 3 days" }, { value: 10080, label: "In 1 week" }]} onChange={setDue} />
    {alertId && <div className="settings-inset"><strong>Related care alert</strong><p>{alert?.title ?? (hydrated ? "Alert not available" : "Loading…")}</p></div>}
    {error && <p className="settings-error" role="alert">{error}</p>}
    <button className="cs-button cs-button--primary" disabled={!hydrated || !title.trim() || !assignee || !!alertId && !alertActive} type="submit">Assign care task</button>
    <Link className="care-text-button care-task-cancel" href={alertId ? `/alerts/${encodeURIComponent(alertId)}` : "/assignments"}>Cancel</Link>
  </form></CareSection>;
}
