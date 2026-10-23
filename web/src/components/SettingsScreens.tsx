"use client";

import { ChevronRight, Plus, X } from "lucide-react";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BottomDrawer, DrawerOption, DurationOptions, memberDrawerChoice, type DrawerChoice } from "./BottomDrawer";
import { CareHomeFooter, CareHomeHeader } from "./CareHomeChrome";
import { CaregiverDoorAssist } from "./CaregiverDoorAssist";
import { CameraConnectButton } from "./CameraConnectButton";
import { RingStreamPreview } from "./RingStreamPreview";
import { SignOutButton } from "./SignOutButton";
import { inter, jakarta, StatusBar } from "./OnboardingFlow";
import { currentBackup, currentOnDuty, memberById, now, quietByLabel, uid, visitorRepeatLabel } from "@/lib/engine";
import { useStore } from "@/lib/store";
import type { AlertType, CarePact, ExpectedVisitor, MemberId } from "@/lib/types";

const sectionTitles = {
  settings: "Settings", rhythm: "Daily rhythm", windows: "Night & rest windows",
  response: "Response & activity", rota: "Duty rota", cover: "Temporary cover",
  door: "DoorSense", visitors: "Expected visitors", members: "Household members",
  playbooks: "Care playbooks", ring: "Ring account", connect: "Connect Ring",
  permissions: "Account permissions", account: "Your account",
} as const;
type Section = keyof typeof sectionTitles;
type DrawerState = { title: string; content: ReactNode } | null;
type RingStatus = { configured?: boolean; source?: string; hint?: string | null; message?: string; warning?: string; error?: string; deviceCount?: number };
const playbookTitles: Record<AlertType, string> = {
  night_exit: "Night-time door activity", unusual_door: "Unexpected door activity",
  long_open: "Door left open", rest_window_exit: "Activity during rest",
  quiet_miss: "No sign of life by quiet-by", visit_missed: "An expected visit was missed",
};
const href = (section: Section) => section === "settings" ? "/setup" : `/setup?section=${section}`;
const timeValue = (hour: number, minute = 0) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
const timeLabel = (hour: number, minute = 0) => `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;

function Icon({ name }: { name: string }) {
  return <span className="settings-icon"><Image alt="" src={`/images/caregiver-home/${name}.svg`} height={21} width={21} /></span>;
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="care-card settings-card"><header className="home-section-heading"><h2>{title}</h2>{action}</header>{children}</section>;
}

function MenuRow({ title, detail, icon, section, value, onClick }: {
  title: string; detail?: string; icon?: string; section?: Section; value?: string; onClick?: () => void;
}) {
  const content = <>{icon && <Icon name={icon} />}<span className="settings-row__copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</span>{value && <span className="settings-row__value">{value}</span>}<span aria-hidden="true" className="settings-chevron"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></span></>;
  return section
    ? <Link className="settings-row" href={href(section)}>{content}</Link>
    : <button className="settings-row" type="button" onClick={onClick}>{content}</button>;
}

function Toggle({ title, detail, checked, onChange }: { title: string; detail?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="settings-toggle-row"><span className="settings-row__copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</span><button aria-label={title} aria-checked={checked} className="settings-switch" onClick={() => onChange(!checked)} role="switch" type="button"><span /></button></div>;
}

function Segments<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div aria-label={label} className="settings-segments" role="group">{options.map((option) => <button aria-pressed={option.value === value} key={option.value} onClick={() => onChange(option.value)} type="button">{option.label}</button>)}</div>;
}

function TimeEditor({ value, onSave, hourly = false }: { value: string; onSave: (value: string) => void; hourly?: boolean }) {
  const [draft, setDraft] = useState(value);
  return <form className="settings-form" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}><label className="onboarding-field"><span>Time</span><input type="time" required step={hourly ? 3600 : 60} value={draft} onChange={(event) => setDraft(event.target.value)} /></label><button className="cs-button cs-button--primary" type="submit">Save time</button></form>;
}

function VisitorEditor({ visitor, today, onSave, onRemove }: { visitor?: ExpectedVisitor; today: Date; onSave: (value: ExpectedVisitor) => void; onRemove?: () => void }) {
  const [label, setLabel] = useState(visitor?.label ?? "");
  const [repeat, setRepeat] = useState(() => {
    if (visitor?.oneOffDay) return "once";
    const recurrence = visitor?.recurrence;
    if (!recurrence) return "weekly";
    if (recurrence.unit === "week" && recurrence.interval === 2) return "fortnightly";
    return recurrence.interval === 1 ? { day: "daily", week: "weekly", month: "monthly" }[recurrence.unit] : "custom";
  });
  const [startsOn, setStartsOn] = useState(() => {
    if (visitor?.oneOffDay) return visitor.oneOffDay;
    if (visitor?.recurrence) return visitor.recurrence.startsOn;
    const date = new Date(today);
    date.setDate(date.getDate() + ((visitor?.weekday ?? date.getDay()) - date.getDay() + 7) % 7);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  const [interval, setInterval] = useState(String(visitor?.recurrence?.interval ?? 1));
  const [unit, setUnit] = useState<"day" | "week" | "month">(visitor?.recurrence?.unit ?? "week");
  const [start, setStart] = useState(timeValue(visitor?.startHour ?? 12));
  const [end, setEnd] = useState(timeValue(visitor?.endHour ?? 13));
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const startHour = Number(start.split(":")[0]), endHour = Number(end.split(":")[0]);
    if (!label.trim() || endHour <= startHour) { setError("Add a name and an end time after the start time."); return; }
    if (!startsOn || !Number.isFinite(new Date(`${startsOn}T12:00:00`).getTime())) { setError("Choose a valid start date."); return; }
    if (repeat === "custom" && (!Number.isInteger(Number(interval)) || Number(interval) < 1 || Number(interval) > 365)) { setError("Choose a repeat interval from 1 to 365."); return; }
    const recurrence: ExpectedVisitor["recurrence"] = repeat === "once" ? undefined : {
      startsOn,
      unit: repeat === "custom" ? unit : repeat === "daily" ? "day" : repeat === "monthly" ? "month" : "week",
      interval: repeat === "custom" ? Number(interval) : repeat === "fortnightly" ? 2 : 1,
    };
    onSave({ ...visitor, id: visitor?.id ?? uid("visitor"), label: label.trim(), weekday: new Date(`${startsOn}T12:00:00`).getDay(), startHour, endHour, oneOffDay: repeat === "once" ? startsOn : undefined, recurrence });
  }
  return <form className="settings-form" onSubmit={submit}>
    <label className="onboarding-field"><span>Visitor name</span><input required maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
    <div><p className="settings-field-label">Repeat</p><div aria-label="Visit repeat" className="receiver-walk-times" role="group">{[{ value: "once", label: "Does not repeat" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "fortnightly", label: "Every two weeks" }, { value: "monthly", label: "Monthly" }, { value: "custom", label: "Custom" }].map((option) => <button aria-pressed={repeat === option.value} onClick={() => setRepeat(option.value)} key={option.value} type="button">{option.label}</button>)}</div></div>
    <label className="onboarding-field"><span>{repeat === "once" ? "Visit date" : "Starts on"}</span><input type="date" required value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label>
    {repeat === "custom" && <><label className="onboarding-field"><span>Repeat every</span><input type="number" inputMode="numeric" min={1} max={365} step={1} required value={interval} onChange={(event) => setInterval(event.target.value)} /></label><div className="receiver-walk-times" aria-label="Repeat unit" role="group">{(["day", "week", "month"] as const).map((value) => <button aria-pressed={unit === value} onClick={() => setUnit(value)} key={value} type="button">{value === "day" ? "Days" : value === "week" ? "Weeks" : "Months"}</button>)}</div></>}
    {(repeat === "monthly" || repeat === "custom" && unit === "month") && <p className="settings-note">Same calendar date, or the last day in shorter months.</p>}
    <div className="settings-field-pair"><label className="onboarding-field"><span>From</span><input type="time" step={3600} required value={start} onChange={(e) => setStart(e.target.value)} /></label><label className="onboarding-field"><span>Until</span><input type="time" step={3600} required value={end} onChange={(e) => setEnd(e.target.value)} /></label></div>
    {error && <p role="alert" className="settings-error">{error}</p>}
    <button className="cs-button cs-button--primary" type="submit">Save visitor</button>
    {onRemove && <button className="settings-danger" onClick={onRemove} type="button">Remove visitor</button>}
  </form>;
}

function PlaybookEditor({ labels, onSave }: { labels: string[]; onSave: (labels: string[]) => void }) {
  const [draft, setDraft] = useState(labels);
  return <form className="settings-form" onSubmit={(event) => { event.preventDefault(); onSave(draft.map((text) => text.trim())); }}>
    {draft.map((text, index) => <label className="onboarding-field" key={index}><span>Step {index + 1}</span><textarea required maxLength={500} value={text} onChange={(event) => setDraft(draft.map((label, i) => i === index ? event.target.value : label))} /></label>)}
    <button className="cs-button cs-button--primary" disabled={draft.some((text) => !text.trim())} type="submit">Save playbook</button>
  </form>;
}

export function SettingsScreens() {
  const search = useSearchParams();
  const requested = search.get("section") ?? "settings";
  const section: Section = Object.hasOwn(sectionTitles, requested) ? requested as Section : "settings";
  const { state, hydrated, updatePact, setDuty, setDutyOverride, setOptOutToday, saveVisitor, removeVisitor, updatePlaybook } = useStore();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [message, setMessage] = useState("");
  const [ring, setRing] = useState<RingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const caregivers = state.members.filter((member) => member.role !== "person_at_home");
  const onDuty = memberById(state, currentOnDuty(state));
  const backup = memberById(state, currentBackup(state));
  const pact = state.pact;
  const days = [...state.duty].sort((a, b) => a.date.localeCompare(b.date));

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [section]);

  const refreshRing = useCallback((signal?: AbortSignal) => {
    return fetch("/api/ring/token", { cache: "no-store", signal }).then(async (response) => {
      const result: RingStatus = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load Ring status.");
      if (!signal?.aborted) setRing(result);
    }).catch((error: unknown) => {
      if (signal?.aborted) return;
      console.error("Unable to load Ring settings", error);
      setRing({ error: error instanceof Error ? error.message : "Could not reach Ring settings." });
    });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refreshRing(controller.signal);
    return () => controller.abort();
  }, [refreshRing]);

  function finish() { setDrawer(null); setMessage("Settings updated."); }
  function changePact(patch: Partial<CarePact>) { updatePact(patch); setMessage("Settings updated."); }
  function editTime(title: string, hour: keyof Pick<CarePact, "quietByHour" | "nightStartHour" | "nightEndHour" | "restStartHour" | "restEndHour">) {
    setDrawer({ title, content: <TimeEditor hourly={hour !== "quietByHour"} value={timeValue(pact[hour], hour === "quietByHour" ? pact.quietByMinute : 0)} onSave={(value) => {
      const [hours, minutes] = value.split(":").map(Number);
      updatePact(hour === "quietByHour" ? { quietByHour: hours, quietByMinute: minutes } : { [hour]: hours }); finish();
    }} /> });
  }
  function choose<T extends string>(title: string, value: T, options: DrawerChoice<T>[], onChange: (value: T) => void) {
    setDrawer({ title, content: <div className="drawer-options">{options.map((option) => <DrawerOption {...option} selected={value === option.value} key={option.value} onClick={() => { onChange(option.value); finish(); }} />)}</div> });
  }
  function editVisitor(visitor?: ExpectedVisitor) {
    setDrawer({ title: visitor ? "Edit expected visitor" : "Add expected visitor", content: <VisitorEditor visitor={visitor} today={now(state)} onSave={(value) => { saveVisitor(value); finish(); }} onRemove={visitor ? () => { removeVisitor(visitor.id); finish(); } : undefined} /> });
  }
  async function submitToken(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/ring/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.trim() }) });
      const result: RingStatus = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save the Ring token.");
      setRing(result); setToken(""); setMessage(result.warning ? "Token stored, but Ring could not verify the connection." : "Ring token stored.");
    } catch (error) {
      console.error("Unable to save Ring token", error);
      setMessage(error instanceof Error ? error.message : "Could not save Ring token.");
    } finally { setBusy(false); }
  }
  function clearToken() {
    setDrawer({ title: "Clear pasted Ring token?", content: <div className="settings-form"><p className="care-body-copy">This removes the token held in server memory. An environment-configured token will still be used. It does not revoke access in your Ring account.</p><button className="cs-button cs-button--primary" onClick={async () => {
      setDrawer(null); setBusy(true);
      try {
        const response = await fetch("/api/ring/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clear: true }) });
        const result: RingStatus = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not clear the token.");
        setRing(result); setToken(""); setMessage(result.configured ? "Pasted token cleared. The environment token is still configured." : "Pasted Ring token cleared.");
      } catch (error) { console.error("Unable to clear Ring token", error); setMessage(error instanceof Error ? error.message : "Could not clear Ring token."); }
      finally { setBusy(false); }
    }} type="button">Clear pasted token</button></div> });
  }
  const memberOptions = caregivers.map(memberDrawerChoice);
  const ringLabel = ring?.error ? "Needs attention" : ring === null ? "Checking…" : ring.configured ? "Token configured" : "Not connected";
  const intro = section === "settings";
  const backSection: Section = section === "cover" ? "rota" : section === "permissions" || section === "connect" ? "ring" : "settings";

  return <main className={`onboarding-screen care-home caregiver-home settings-screen${section === "connect" ? " settings-screen--connect" : ""} ${inter.variable} ${jakarta.variable}`}>
    <StatusBar />
    <CareHomeHeader accountIcon centered back={intro ? undefined : { href: href(backSection), label: sectionTitles[backSection] }} initials="" onAccount={() => setDrawer({ title: "Your account", content: <AccountNotice /> })} />
    <div className="onboarding-body caregiver-home__body settings-body" ref={bodyRef}>
      <header className="settings-heading"><h1 ref={headingRef} tabIndex={-1}>{sectionTitles[section]}</h1></header>
      <CaregiverDoorAssist hideIdle />
      <div className="settings-stack" aria-busy={!hydrated}>
        {intro && <>
          <Card title="Everyday care"><div className="settings-list">
            <MenuRow icon="smile" title="Daily rhythm" detail={`Quiet by ${quietByLabel(state)}`} section="rhythm" />
            <MenuRow icon="clock" title="Night & rest windows" detail={`${timeLabel(pact.nightStartHour)}–${timeLabel(pact.nightEndHour)}`} section="windows" />
            <MenuRow icon="bell" title="Response & activity" detail={`Backup after ${pact.escalationMinutes} min`} section="response" />
          </div></Card>
          <Card title="Family coverage"><div className="settings-list">
            <MenuRow icon="check-ins" title="Duty rota & temporary cover" detail={state.dutyOverrideId ? "An override is active" : "Your upcoming care schedule"} section="rota" />
            <MenuRow icon="people" title="Household members" detail={`${state.members.length} people in the care circle`} section="members" />
          </div></Card>
          <Card title="Home & devices"><div className="settings-list">
            <MenuRow icon="door-open" title="DoorSense" detail="Detection & alert preferences" section="door" />
            <MenuRow icon="doorsense" title="Ring account" detail={ringLabel} section="ring" />
            <MenuRow icon="check-ins" title="Expected visitors" detail={`${state.visitors.length} planned visits`} section="visitors" />
          </div></Card>
          <Card title="More"><div className="settings-list"><MenuRow icon="circle" title="Care playbooks" section="playbooks" /><MenuRow icon="people" title="Your account" section="account" /></div></Card>
        </>}
        {section === "rhythm" && <>
          <Card title="Quiet-by expectation"><div className="settings-list"><MenuRow title="If we haven’t heard from them" value={quietByLabel(state)} onClick={() => editTime("Quiet-by time", "quietByHour")} /><MenuRow title="What counts as a sign of life" section="response" /></div></Card>
          <Card title="Today"><Toggle title="I’m with them today" detail="Pause today’s quiet-by alert" checked={state.optOutToday} onChange={setOptOutToday} /></Card>
          <Card title="Daily check-in"><p className="care-body-copy">Check-ins are available on the receiver’s My day screen. Scheduled tablet reminders are not connected yet.</p><Link className="cs-button cs-button--glass" href="/recipient">Open My day</Link></Card>
          <Card title="Rest & routine"><MenuRow icon="clock" title="Night & rest windows" section="windows" /></Card>
        </>}
        {(section === "windows" || section === "rhythm") && <>
          <Card title="Night window"><div className="settings-list"><MenuRow title="From" value={timeLabel(pact.nightStartHour)} onClick={() => editTime("Night starts", "nightStartHour")} /><MenuRow title="Until" value={timeLabel(pact.nightEndHour)} onClick={() => editTime("Night ends", "nightEndHour")} /></div><p className="settings-note">Door activity during these hours follows your night alert rules.</p></Card>
          <Card title="Daytime rest"><div className="settings-list"><Toggle title="Rest window alerts" checked={pact.restWindowEnabled} onChange={(value) => changePact({ restWindowEnabled: value })} /><MenuRow title="From" value={timeLabel(pact.restStartHour)} onClick={() => editTime("Rest starts", "restStartHour")} /><MenuRow title="Until" value={timeLabel(pact.restEndHour)} onClick={() => editTime("Rest ends", "restEndHour")} /></div></Card>
        </>}
        {section === "response" && <>
          <Card title="Notify backup if unaccepted"><MenuRow title="Care alerts" detail="On-duty caregiver first, then backup" value={`${pact.escalationMinutes} min`} onClick={() => setDrawer({ title: "Notify backup after", content: <DurationOptions value={pact.escalationMinutes} maxMinutes={1440} presets={[...new Set([1, 3, 5, 10, 15, 30, 60, 120, pact.escalationMinutes])].sort((a, b) => a - b).map((value) => ({ value, label: `${value} minute${value === 1 ? "" : "s"}` }))} onSelect={(value) => { updatePact({ escalationMinutes: value }); finish(); }} /> })} /></Card>
          <Card title="What counts as a sign of life"><div className="settings-list"><Toggle title="Expected door activity" detail="Include qualifying events in the quiet-by check" checked={pact.doorActivityCountsAsSignOfLife} onChange={(value) => changePact({ doorActivityCountsAsSignOfLife: value })} /><Toggle title="Require “I’m okay”" detail="Door activity alone is not enough" checked={pact.requireImOkay} onChange={(value) => changePact({ requireImOkay: value })} /></div><p className="settings-note">These choices don’t dismiss an open care alert or confirm medicine was taken.</p></Card>
          <Card title="When someone takes ownership"><MenuRow icon="circle" title="Care playbooks" section="playbooks" /></Card>
        </>}
        {section === "rota" && <>
          <div className="settings-highlight home-glass"><Icon name="people" /><span><strong>{onDuty?.name ?? "Unassigned"} is on duty</strong><small>{backup?.name ?? "No one"} is backup{state.dutyOverrideId ? " · override active" : ""}</small></span></div>
          <Card title="Upcoming duty"><div className="settings-list">{days.map((day) => <MenuRow key={day.date} title={new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} detail={`${memberById(state, day.onDutyId)?.name} · backup ${memberById(state, day.backupId)?.name}`} onClick={() => setDrawer({ title: `Duty · ${day.date}`, content: <DutyEditor onDuty={day.onDutyId} backup={day.backupId} members={memberOptions} onSave={(onDutyId, backupId) => { setDuty(day.date, onDutyId, backupId); finish(); }} /> })} />)}</div></Card>
          <Card title="Temporary coverage"><MenuRow title={state.dutyOverrideId ? `${onDuty?.name} is covering` : "No override active"} detail="Change who receives new care alerts" section="cover" /></Card>
        </>}
        {section === "cover" && <>
          <Card title={state.dutyOverrideId ? "Cover is active" : "Set cover"}><MenuRow icon="people" title="On duty" value={state.dutyOverrideId ? onDuty?.name : "Use the rota"} onClick={() => choose<MemberId | "">("Who is covering?", state.dutyOverrideId ?? "", [{ value: "", label: "Use the duty rota" }, ...memberOptions], (value) => setDutyOverride(value || null))} /><p className="settings-note">Cover starts immediately and stays active until you remove it. Scheduled start and end times aren’t supported yet.</p></Card>
          <Card title="While cover is active"><p className="care-body-copy">New alerts go to the covering caregiver. Accepted alerts stay with their current owner.</p></Card>
          {state.dutyOverrideId && <button className="cs-button cs-button--glass" onClick={() => { setDutyOverride(null); setMessage("Cover removed. The duty rota is active again."); }} type="button">End cover & return to rota</button>}
        </>}
        {section === "door" && <>
          <Card title="Your door"><MenuRow icon="door-open" title="Front door" detail={ringLabel} section="ring" /></Card>
          <Card title="Detection sensitivity"><Segments label="Detection sensitivity" value={pact.cameraSensitivity} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Balanced" }, { value: "high", label: "High" }]} onChange={(value) => changePact({ cameraSensitivity: value })} /><p className="settings-note">Applies to the phone-camera stand-in, not Ring’s own motion zones.</p></Card>
          <Card title="Events that create alerts"><div className="settings-list"><MenuRow title="Detect" value={pact.cameraDetectMode === "person" ? "People" : "Any motion"} onClick={() => choose("Detection type", pact.cameraDetectMode, [{ value: "person", label: "People" }, { value: "motion", label: "Any motion" }], (value) => updatePact({ cameraDetectMode: value }))} /></div><Segments label="Alert policy" value={pact.cameraAlertPolicy} options={[{ value: "pact", label: "Care rules" }, { value: "always", label: "Every sighting" }]} onChange={(value) => changePact({ cameraAlertPolicy: value })} /><p className="settings-note">Care rules follow night, rest and unusual-activity checks. Every sighting is intended for testing.</p></Card>
          <Card title="Camera setup"><CameraConnectButton /><MenuRow title="Night & rest windows" section="windows" /><MenuRow title="Expected visitors" section="visitors" /></Card>
        </>}
        {section === "visitors" && <>
          <button className="cs-button cs-button--primary settings-add" onClick={() => editVisitor()} type="button"><Plus aria-hidden="true" size={18} /> Add expected visitor</button>
          <Card title="Planned visits"><div className="settings-visitor-list">{state.visitors.map((visitor) => <article className="settings-inset" key={visitor.id}><div className="settings-person"><span className="settings-avatar">{visitor.label.slice(0, 2).toUpperCase()}</span><strong>{visitor.label}</strong><button className="care-text-button" onClick={() => editVisitor(visitor)} type="button">Edit<span className="sr-only"> {visitor.label}</span></button></div><p>{visitorRepeatLabel(visitor)} · {timeLabel(visitor.startHour)}–{timeLabel(visitor.endHour)}</p></article>)}{!state.visitors.length && <p className="care-body-copy">No expected visitors yet.</p>}</div><p className="settings-note">Visitor schedules don’t grant household or camera access.</p></Card>
        </>}
        {section === "members" && <>
          <Card title="Your care circle"><div className="settings-visitor-list">{state.members.map((member) => <article className="settings-inset" key={member.id}><div className="settings-person"><span className="settings-avatar">{member.name.slice(0, 2).toUpperCase()}</span><span className="settings-row__copy"><strong>{member.name}</strong><small>{member.role === "person_at_home" ? "Care receiver" : member.role === "care_lead" ? "Care lead" : member.role === "view_only" ? "View only" : "Caregiver"}</small></span><span className="home-status">Demo</span></div><p>{member.phoneLabel}</p></article>)}</div></Card>
          <Card title="Account access"><AccountNotice /><button className="cs-button cs-button--glass" onClick={() => setDrawer({ title: "Invite a household member", content: <p className="care-body-copy">Real invitations need individual accounts and household access controls. They aren’t connected yet; no invitation has been sent.</p> })} type="button">Invite household member</button></Card>
        </>}
        {section === "playbooks" && <>
          <div className="settings-notice">In immediate danger, call local emergency services. Don’t wait for an app alert.</div>
          {Object.entries(state.playbooks).map(([type, steps]) => {
            const alertType = type as AlertType;
            return <Card key={type} title={playbookTitles[alertType]} action={<button className="care-text-button" onClick={() => setDrawer({ title: playbookTitles[alertType], content: <PlaybookEditor labels={steps.map((step) => step.label)} onSave={(labels) => { updatePlaybook(alertType, labels); finish(); }} /> })} type="button">Edit<span className="sr-only"> {playbookTitles[alertType]}</span></button>}><ol className="settings-steps">{steps.map((step, index) => <li key={step.id}><span>{index + 1}</span><p>{step.label}</p></li>)}</ol></Card>;
          })}
        </>}
        {section === "ring" && <>
          <Card title="Phone camera stand-in"><p className="care-body-copy">No Ring device? Scan a QR code to open the motion-detection camera on your phone.</p><CameraConnectButton /></Card>
          <div className="settings-connection-art"><span><Icon name="door-open" /><strong>ring</strong></span><span aria-hidden="true">↔</span><span><Icon name="doorsense" /><strong>CareSignal</strong></span></div>
          <Card title="Connection"><div className="settings-highlight"><Icon name="doorsense" /><span><strong>{ringLabel}</strong><small>{ring?.source === "runtime" ? "Pasted Playground token" : ring?.source === "env" ? "Environment token" : "Ring Playground"}</small></span></div>{ring?.error && <p className="settings-error" role="alert">{ring.error}</p>}{ring?.warning && <p className="settings-error" role="alert">{ring.warning}</p>}<div className="settings-list"><MenuRow title={ring?.configured ? "Replace access token" : "Set up connection"} section="connect" /><MenuRow title="Account permissions" section="permissions" /></div><button className="cs-button cs-button--glass" disabled={busy} onClick={() => void refreshRing()} type="button">Refresh status</button><p className="settings-note">A configured token is not confirmation that a device is online.</p></Card>
          <Card title="Your connected device"><MenuRow icon="door-open" title="DoorSense preferences" section="door" /><Link className="cs-button cs-button--glass" href="/doorsense">Open door devices</Link></Card>
          {ring?.configured && <button className="settings-danger" disabled={busy} onClick={clearToken} type="button">Clear pasted token</button>}
        </>}
        {section === "connect" && <>
          <Card title="Choose your camera"><p className="care-body-copy">Use your phone as a stand-in, or connect Amazon&apos;s Ring developer Playground below. These are separate event and camera sources.</p><CameraConnectButton /></Card>
          <Card title="Connect securely"><div className="settings-list"><MenuRow icon="bell" title="Doorbell & motion events" section="permissions" /><MenuRow icon="doorsense" title="Device status & live view" section="permissions" /></div><p className="care-body-copy">Ring account authorization isn’t integrated yet. The current connection uses a Ring Playground access token, not your Ring password.</p></Card>
          <Card title="Playground access token"><form className="settings-form" onSubmit={submitToken}><label className="onboarding-field"><span>Access token</span><input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.target.value)} required minLength={10} /></label><button className="cs-button cs-button--primary" disabled={busy || token.trim().length < 10} type="submit">{busy ? "Connecting…" : "Save access token"}</button></form>{ring?.warning && <p className="settings-error" role="alert">{ring.warning}</p>}<p className="settings-note">Held in server memory until restart. Never saved to your browser or committed to source.</p></Card>
          <Card title="Ring developer live stream"><p className="care-body-copy">Save your Playground token first, then request a live view from its device. Streaming requires the corresponding API permissions.</p><button type="button" className="cs-button cs-button--glass" onClick={() => setDrawer({ title: "Ring live view", content: <RingStreamPreview /> })}>Open Ring live view</button></Card>
        </>}
        {section === "permissions" && <>
          <Card title="Ring connection"><div className="settings-permissions"><p><Icon name="bell" /><span><strong>Doorbell & motion events</strong><small>Used to create care alerts.</small></span></p><p><Icon name="door-open" /><span><strong>Device information</strong><small>Connection status when available.</small></span></p><p><Icon name="doorsense" /><span><strong>Live view</strong><small>Opened through the existing door-assist service.</small></span></p></div></Card>
          <Card title="Your privacy"><p className="care-body-copy">This is not a Ring authorization page. OAuth consent and per-account permissions will be added with the real account integration.</p><Link className="cs-button cs-button--glass" href={href("ring")}>Back to Ring account</Link></Card>
        </>}
        {section === "account" && <><Card title="Your CareSignal account"><AccountNotice /></Card><Card title="Caregiver & receiver"><p className="care-body-copy">Your caregiver and receiver will have separate sign-ins. Demo members remain household examples, not accounts you can sign into.</p><MenuRow title="Household members" icon="people" section="members" /></Card></>}
      </div>
    </div>
    <CareHomeFooter active="settings" />
    {drawer && <BottomDrawer title={drawer.title} wide={drawer.title === "Ring live view"} onClose={() => setDrawer(null)}>{drawer.content}</BottomDrawer>}
    {message && !drawer && <div className="onboarding-message" role="status"><span>{message}</span><button aria-label="Dismiss message" className="care-message-dismiss" onClick={() => setMessage("")} type="button"><X aria-hidden="true" size={18} strokeWidth={2} /></button></div>}
  </main>;
}

function AccountNotice() {
  return <div className="settings-form"><p className="care-body-copy">Manage your CareSignal login. Care-circle membership and permissions remain separate from your account. Signing out does not delete saved care setup or shared care records.</p><Link className="care-text-button" href="/account">Manage account</Link><SignOutButton /></div>;
}

function DutyEditor({ onDuty, backup, members, onSave }: { onDuty: MemberId; backup: MemberId; members: DrawerChoice<MemberId>[]; onSave: (onDuty: MemberId, backup: MemberId) => void }) {
  const [duty, setDuty] = useState(onDuty);
  const [backupId, setBackup] = useState(backup);
  const [tab, setTab] = useState<"duty" | "backup">("duty");
  return <div className="settings-form"><Segments label="Assignment" value={tab} options={[{ value: "duty", label: "On duty" }, { value: "backup", label: "Backup" }]} onChange={setTab} /><div className="drawer-options">{members.map((member) => <DrawerOption {...member} selected={(tab === "duty" ? duty : backupId) === member.value} key={member.value} onClick={() => tab === "duty" ? setDuty(member.value) : setBackup(member.value)} />)}</div>{duty === backupId && <p className="settings-error" role="alert">Choose different people for duty and backup.</p>}<button className="cs-button cs-button--primary" disabled={duty === backupId} onClick={() => onSave(duty, backupId)} type="button">Save assignments</button></div>;
}
