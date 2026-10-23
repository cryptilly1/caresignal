"use client";

import { Check, ChevronLeft, ChevronRight, Mic, X } from "lucide-react";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BottomDrawer, memberDrawerChoice } from "./BottomDrawer";
import { CareHomeHeader } from "./CareHomeChrome";
import { ReceiverDoorSense } from "./ReceiverDoorSense";
import { CareSection, EmptyCareState } from "./CareWorkspace";
import { StatusBar, inter, jakarta } from "./OnboardingFlow";
import { buildMedicationBrief } from "@/lib/agents";
import { breakActive, currentBackup, currentOnDuty, formatTime as formatClockTime, latestFeeling, memberById, now, todayKey, visitorOccursOn } from "@/lib/engine";
import { initials } from "@/lib/care-setup";
import { canListen, isSecureMediaContext, listenOnceDetailed, parseRecipientIntent, speak } from "@/lib/speech";
import { useStore } from "@/lib/store";
import type { FeelingLevel } from "@/lib/types";

type Drawer = "mood" | "medicine" | "walk" | "visitor" | "help" | "voice" | "account" | "call" | null;
type DailyView = "home" | "reminders" | "circle" | "settings";
const moods: { value: FeelingLevel; label: string; emoji: string }[] = [
  { value: "good", label: "Feeling good", emoji: "😁" },
  { value: "okay", label: "Feeling okay", emoji: "🙂" },
  { value: "not_great", label: "Not feeling great", emoji: "🙁" },
];
const navigation: { value: DailyView; label: string; icon: string }[] = [
  { value: "home", label: "Home", icon: "home" },
  { value: "reminders", label: "Reminders", icon: "alerts" },
  { value: "circle", label: "Care circle", icon: "care-circle" },
  { value: "settings", label: "Settings", icon: "settings" },
];
const dailyHref = (view: DailyView) => view === "home" ? "/recipient" : `/recipient?view=${view}`;
const formatTime = (value: string) => formatClockTime(new Date(value));

function DailyIcon({ name }: { name: string }) {
  if (name === "mic") return <Mic aria-hidden="true" size={22} strokeWidth={1.8} />;
  return <Image alt="" src={`/images/caregiver-home/${name}.svg`} width={22} height={22} />;
}

function DailyRow({ icon, title, detail, onClick }: { icon: string; title: string; detail: string; onClick: () => void }) {
  return <button className="receiver-daily-row" onClick={onClick} type="button"><span className="receiver-daily-row__icon"><DailyIcon name={icon} /></span><span><strong>{title}</strong><small>{detail}</small></span><span aria-hidden="true"><ChevronRight aria-hidden="true" size={18} strokeWidth={2} /></span></button>;
}

export function ReceiverDaily() {
  const search = useSearchParams();
  const requested = search.get("view");
  const view: DailyView = navigation.find((item) => item.value === requested)?.value ?? "home";
  const { state, hydrated, imOkay, logFeeling, logMedicine, logWalk, logSomeoneComing, requestBreak, clearBreak, requestHelp } = useStore();
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [message, setMessage] = useState("");
  const [medicineId, setMedicineId] = useState<string | undefined>();
  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const at = now(state);
  const key = todayKey(state);
  const brief = buildMedicationBrief(state);
  const checked = state.checkIns.find((entry) => entry.at.slice(0, 10) === key);
  const feeling = latestFeeling(state);
  const mood = moods.find((item) => item.value === feeling?.level);
  const onBreak = breakActive(state);
  const walks = state.walkLogs.filter((entry) => entry.at.slice(0, 10) === key);
  const visitor = state.visitors.find((entry) => entry.oneOffDay === key) ?? state.visitors.find((entry) => visitorOccursOn(entry, at));
  const duty = memberById(state, currentOnDuty(state));
  const backup = memberById(state, currentBackup(state));
  const nextDutyDay = new Date(`${key}T00:00:00.000Z`);
  nextDutyDay.setUTCDate(nextDutyDay.getUTCDate() + 1);
  const dutyHours = `Today · until ${formatClockTime(nextDutyDay)}`;
  const reminderCount = brief.totalCount - brief.takenCount + (!checked && !onBreak ? 1 : 0);
  const greeting = at.getHours() < 12 ? "Good morning" : at.getHours() < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [view]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  function confirm(text: string) { setDrawer(null); setMessage(text); speak(text); }
  function checkIn() { imOkay(); setMessage("Check-in saved. Your care circle can see it."); speak("You’re checked in."); }
  function openMedicine(id?: string) { setMedicineId(id ?? brief.nextForMom?.medicineId); setDrawer("medicine"); }
  const titles: Record<Exclude<Drawer, null>, string> = { mood: "How do you feel?", medicine: "Medicine cabinet", walk: "Log a walk", visitor: "Expecting someone", help: "Ask your care circle for help", voice: "Speak to CareSignal", account: "Your receiver profile", call: "Connect with your caregiver" };
  const ready = hydrated;

  return <main className={`onboarding-screen care-home caregiver-home settings-screen receiver-daily ${inter.variable} ${jakarta.variable}`}>
    <StatusBar />
    <CareHomeHeader initials={initials(state.careRecipientName)} onAccount={() => setDrawer("account")} />
    <div className="onboarding-body caregiver-home__body receiver-daily__body" ref={bodyRef} aria-busy={!hydrated} inert={!hydrated}>
      {view === "home" ? <>
        <header className="receiver-daily__greeting"><p>{at.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p><h1 ref={headingRef} tabIndex={-1}>{greeting}, {state.careRecipientName}.<br />Take your time.</h1></header>
        <div className="home-duty home-glass receiver-daily__duty"><div><span>On duty</span><strong>{duty?.name ?? "Unassigned"}</strong><span>{state.dutyOverrideId ? "Temporary cover · until ended" : dutyHours}</span></div><div><span>Backup</span><strong>{backup?.name ?? "Unassigned"}</strong><span>{dutyHours}</span></div></div>
        <div className="receiver-daily__tiles">
          <button className="receiver-daily-tile home-glass" disabled={!ready} onClick={() => setDrawer("mood")} type="button"><span className="receiver-daily-tile__emoji" aria-hidden="true">{mood?.emoji ?? "🙂"}</span><span className="receiver-daily-tile__label">How you feel</span><strong>{mood?.label ?? "How are you feeling?"}</strong><small>{feeling ? `Saved at ${formatTime(feeling.at)}` : "Share with your care circle"}</small><span className="cs-button cs-button--glass receiver-daily-tile__action">Share mood</span></button>
          <button className="receiver-daily-tile receiver-daily-tile--check" disabled={!ready} onClick={checkIn} type="button"><strong>I’m okay</strong><span>Tap to let your circle know</span><small>{checked ? `Last checked in at ${formatTime(checked.at)}` : "Your check-in for today"}</small></button>
          <button className="receiver-daily-tile home-glass" disabled={!ready} onClick={() => setDrawer("voice")} type="button"><span className="receiver-daily-tile__icon"><DailyIcon name="mic" /></span><span className="receiver-daily-tile__label">Speak to CareSignal</span><strong>A little help, by voice</strong>          <small>Tap to start speaking</small></button>
          <Link className="receiver-daily-tile home-glass" href={dailyHref("reminders")}><span className="receiver-daily-tile__icon"><DailyIcon name="bell" /></span><strong className="receiver-daily-tile__count">{reminderCount}</strong><span className="receiver-daily-tile__label">Reminders</span><small>{reminderCount ? "Still on today’s list" : "You’re all caught up"}</small></Link>
        </div>
        <ReceiverDoorSense />
        <div className="receiver-daily__rows">
          <DailyRow icon="pill" title="My medicines" detail={brief.totalCount ? `${brief.takenCount} of ${brief.totalCount} logged today` : "No medicines on today’s list"} onClick={() => openMedicine()} />
          <DailyRow icon="walk" title="Log a walk" detail={walks.length ? `${walks.reduce((total, walk) => total + walk.minutes, 0)} minutes logged today` : "A little movement, at your pace"} onClick={() => setDrawer("walk")} />
          <DailyRow icon="people" title="Expecting someone" detail={visitor ? `${visitor.label} · expected today` : "Tell your circle who to expect"} onClick={() => setDrawer("visitor")} />
        </div>
        <CareSection title="Quick buttons" className="receiver-daily__quick">
          <button className="cs-button cs-button--glass" disabled={!ready} onClick={() => setDrawer("voice")} type="button"><DailyIcon name="mic" />Speak to CareSignal</button>
          <button className="cs-button cs-button--primary" disabled={!ready} onClick={() => setDrawer("call")} type="button"><DailyIcon name="video" />Connect with caregiver</button>
          <button className="cs-button receiver-help-button" disabled={!ready} onClick={() => setDrawer("help")} type="button"><DailyIcon name="bell" />I need help now</button>
        </CareSection>
        <button className="receiver-daily__break care-text-button" disabled={!ready} onClick={() => { if (onBreak) { clearBreak(); confirm("Check-ins are back on."); } else { requestBreak(); confirm("Break started. Quiet check-in alerts are paused for today."); } }} type="button">{onBreak ? "I’m back · resume check-ins" : "I need a little quiet time"}</button>
        {onBreak && <p className="settings-note">Quiet check-in alerts are paused for today. Your care circle can see you’re taking a break.</p>}
      </> : <>
        <header className="settings-heading"><h1 ref={headingRef} tabIndex={-1}>{navigation.find((item) => item.value === view)?.label}</h1></header>
        {view === "reminders" && <div className="workspace-stack">
          <CareSection title="Today’s check-in">{onBreak ? <p className="care-body-copy">You’re taking a break. Quiet check-in alerts are paused for today.</p> : <><p className="care-body-copy">{checked ? `Checked in at ${formatTime(checked.at)}` : "Let your care circle know how you’re doing."}</p><button className="cs-button cs-button--primary" disabled={!ready} onClick={checkIn} type="button">{checked ? "Check in again" : "I’m okay"}</button></>}</CareSection>
          <CareSection title="Your medicines">{brief.slots.length ? <div className="settings-list">{brief.slots.map((slot) => <button className="settings-row" key={`${slot.medicineId}-${slot.timeSlot}`} onClick={() => openMedicine(slot.medicineId)} type="button"><span className="settings-icon"><DailyIcon name="pill" /></span><span className="settings-row__copy"><strong>{slot.name}</strong><small>{slot.dose} · {slot.timeSlot}</small></span><span className={`care-chip${slot.status === "taken" ? "" : " care-chip--blue"}`}>{slot.status === "taken" ? "Logged" : slot.status === "upcoming" ? "Later" : slot.status === "due_now" ? "Due" : "Not logged"}</span></button>)}</div> : <EmptyCareState title="No medicines listed" detail="Your care circle hasn’t added any scheduled medicines." />}</CareSection>
        </div>}
        {view === "circle" && <div className="workspace-stack"><CareSection title="Your people"><div className="receiver-daily__people">{state.members.filter((member) => member.role !== "person_at_home").map((member) => {
          const choice = memberDrawerChoice(member);
          return <div className="receiver-person" key={member.id}><span className="drawer-option__avatar">{choice.avatar}</span><span><strong>{member.name}</strong><small>{choice.description}{member.id === duty?.id ? " · On duty" : member.id === backup?.id ? " · Backup" : ""}</small></span></div>;
        })}</div></CareSection><CareSection title="Reach your circle"><button className="cs-button cs-button--primary" onClick={() => setDrawer("call")} type="button">Connect with caregiver</button><button className="cs-button cs-button--glass" onClick={() => setDrawer("help")} type="button">Ask for help</button><p className="settings-note">Household demo members. Individual accounts are not connected yet.</p></CareSection></div>}
        {view === "settings" && <div className="workspace-stack"><CareSection title="Your day"><DailyRow icon="coffee" title={onBreak ? "Resume check-ins" : "Take a break"} detail={onBreak ? "Turn quiet check-in alerts back on" : "Pause quiet check-in alerts for today"} onClick={() => { if (onBreak) clearBreak(); else requestBreak(); confirm(onBreak ? "Check-ins resumed." : "Quiet check-in alerts paused for today."); }} /><DailyRow icon="circle" title="Your profile" detail={state.careRecipientName} onClick={() => setDrawer("account")} /></CareSection><CareSection title="Door & voice"><Link className="cs-button cs-button--glass" href="/doorsense">Open DoorSense</Link><Link className="care-text-button" href="/cam">Open stand-in camera</Link><p className="settings-note">Camera and microphone access start only when you choose to use them. Alexa connectivity isn’t verified by this screen.</p></CareSection></div>}
      </>}
    </div>
    <footer className="care-home__footer"><nav aria-label="Receiver navigation" className="care-home__nav">{navigation.map((item) => <Link href={dailyHref(item.value)} aria-current={view === item.value ? "page" : undefined} key={item.value}><Image alt="" src={`/images/care-circle/${item.icon}.svg`} height={25} width={25} /><span>{item.label}</span></Link>)}</nav><div className="onboarding-home-indicator" aria-hidden="true" /></footer>
    {drawer && <BottomDrawer title={titles[drawer]} onClose={() => setDrawer(null)}>
      {drawer === "mood" && <MoodSheet initial={feeling?.level} onSave={(level) => { logFeeling(level); confirm("Your mood is saved for your care circle."); }} />}
      {drawer === "medicine" && <MedicineSheet initialId={medicineId} onLog={(id, time) => { logMedicine(id, time); confirm("Medicine recorded as taken."); }} />}
      {drawer === "walk" && <WalkSheet walks={walks} onSave={(minutes) => { logWalk(minutes); confirm(`Your ${minutes}-minute walk is saved.`); }} />}
      {drawer === "visitor" && <VisitorSheet current={visitor?.label} onSave={(name) => { logSomeoneComing(name); confirm(`Expecting ${name}. Your visit window is saved.`); }} />}
      {drawer === "help" && <div className="settings-form"><p className="care-body-copy">This creates an urgent care alert for {duty?.name ?? "your on-duty caregiver"}, with backup escalation if it isn’t accepted.</p><p className="settings-note">This is not an emergency service. If you’re in immediate danger, contact your local emergency services.</p><button className="cs-button receiver-help-button" disabled={!ready} onClick={() => { requestHelp(); confirm("Help request saved for your caregiver."); }} type="button">Send help request</button><button className="cs-button cs-button--glass" onClick={() => setDrawer(null)} type="button">Not now</button></div>}
      {drawer === "voice" && <VoiceSheet onCheckIn={checkIn} onMedicine={() => openMedicine()} onWalk={() => setDrawer("walk")} />}
      {drawer === "account" && <div className="settings-form"><div className="receiver-person"><span className="drawer-option__avatar">{initials(state.careRecipientName)}</span><span><strong>{state.careRecipientName}</strong><small>Care receiver</small></span></div><p className="care-body-copy">Your daily logs are shared with this household’s care circle. Access currently uses the shared household session; a separate receiver sign-in isn’t connected yet.</p><Link className="care-text-button" href="/onboarding/receiver">View receiver setup</Link></div>}
      {drawer === "call" && <div className="settings-form"><p className="care-body-copy">For someone at the door, open DoorSense and choose “Tell my caregiver” to share the door view.</p><Link className="cs-button cs-button--primary" href="/doorsense">Open DoorSense</Link><p className="settings-note">General voice and video calls to care-circle members aren’t connected yet.</p><button className="cs-button cs-button--glass" onClick={() => setDrawer("help")} type="button">Ask your caregiver for help</button></div>}
    </BottomDrawer>}
    {message && !drawer && <div className="onboarding-message" role="status"><span>{message}</span><button className="care-message-dismiss" aria-label="Dismiss message" onClick={() => setMessage("")} type="button"><X aria-hidden="true" size={18} strokeWidth={2} /></button></div>}
  </main>;
}

function MoodSheet({ initial, onSave }: { initial?: FeelingLevel; onSave: (level: FeelingLevel) => void }) {
  const [index, setIndex] = useState(() => Math.max(0, moods.findIndex((item) => item.value === initial)));
  const mood = moods[index];
  return <div className="receiver-sheet receiver-sheet--large"><span className="care-chip care-chip--blue">Mood</span><div className="receiver-mood-face"><span aria-hidden="true">{mood.emoji}</span><strong aria-live="polite">{mood.label}</strong></div><div className="receiver-mood-control"><label className="settings-field-label" htmlFor="receiver-mood">How you’re feeling</label><input id="receiver-mood" className="receiver-mood-range" type="range" min={0} max={2} step={1} value={index} aria-valuetext={mood.label} onChange={(event) => setIndex(Number(event.target.value))} /><div className="receiver-mood-labels">{moods.map((item, i) => <button aria-label={item.label} aria-pressed={i === index} key={item.value} onClick={() => setIndex(i)} type="button">{item.emoji}</button>)}</div><button className="cs-button cs-button--primary" onClick={() => onSave(mood.value)} type="button">Log mood</button></div></div>;
}

function MedicineSheet({ initialId, onLog }: { initialId?: string; onLog: (id: string, time: string) => void }) {
  const { state, hydrated } = useStore();
  const brief = buildMedicationBrief(state);
  const [selectedId, setSelectedId] = useState(initialId ?? state.medicines[0]?.id ?? "");
  const [selectedTime, setSelectedTime] = useState("");
  const railRef = useRef<HTMLDivElement>(null);
  const [railEdges, setRailEdges] = useState({ atStart: true, atEnd: true });
  const selected = state.medicines.find((item) => item.id === selectedId) ?? state.medicines[0];
  const slots = brief.slots.filter((slot) => slot.medicineId === selected?.id);
  const slot = slots.find((item) => item.timeSlot === selectedTime) ?? slots.find((item) => item.status !== "taken") ?? slots[0];
  useEffect(() => {
    railRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected?.id]);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => setRailEdges({
      atStart: rail.scrollLeft <= 1,
      atEnd: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1,
    });
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const delta = event.deltaY;
      const canScroll = delta > 0 ? rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1 : rail.scrollLeft > 1;
      if (!canScroll) return;
      event.preventDefault();
      const card = rail.firstElementChild;
      if (!(card instanceof HTMLElement)) return;
      rail.scrollBy({ left: Math.sign(delta) * (card.offsetWidth + parseFloat(getComputedStyle(rail).columnGap)), behavior: "smooth" });
    };
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    const frame = requestAnimationFrame(update);
    rail.addEventListener("scroll", update);
    rail.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      rail.removeEventListener("scroll", update);
      rail.removeEventListener("wheel", wheel);
    };
  }, [state.medicines.length]);
  function browse(direction: number) {
    const rail = railRef.current;
    const card = rail?.firstElementChild;
    if (!rail || !(card instanceof HTMLElement)) return;
    rail.scrollBy({ left: direction * (card.offsetWidth + parseFloat(getComputedStyle(rail).columnGap)), behavior: "smooth" });
  }
  if (!state.medicines.length) return <EmptyCareState title="Your cabinet is empty" detail="No medicines have been added to this household’s schedule." />;
  return <div className="receiver-sheet receiver-sheet--large"><span className="care-chip care-chip--blue">Log medicine</span><div className="alerts-rail-controls receiver-medicine-controls" aria-label="Browse medicines"><button aria-label="Previous medicine" disabled={railEdges.atStart} onClick={() => browse(-1)} type="button"><ChevronLeft aria-hidden="true" size={18} /></button><button aria-label="Next medicine" disabled={railEdges.atEnd} onClick={() => browse(1)} type="button"><ChevronRight aria-hidden="true" size={18} /></button></div><div className="receiver-medicine-rail" aria-label="Choose a medicine" ref={railRef}>{state.medicines.map((medicine) => <button className="receiver-medicine-card" aria-pressed={medicine.id === selected?.id} onClick={() => { setSelectedId(medicine.id); setSelectedTime(""); }} key={medicine.id} type="button"><strong>{medicine.name}</strong><span className="receiver-medicine-card__art" aria-hidden="true"><DailyIcon name="pill" /></span><span>{medicine.dose}</span>{medicine.id === selected?.id && <span className="receiver-medicine-card__selected" aria-hidden="true"><Check aria-hidden="true" size={18} strokeWidth={2} /></span>}</button>)}</div><div className="receiver-medicine-form"><div><span className="settings-field-label">Scheduled amount</span><strong className="receiver-medicine-dose">{selected?.dose}</strong></div><fieldset className="receiver-medicine-times"><legend className="settings-field-label">Scheduled time</legend>{slots.map((item) => <label key={item.timeSlot}><input type="radio" name="medicine-time" checked={slot?.timeSlot === item.timeSlot} onChange={() => setSelectedTime(item.timeSlot)} /><span>{item.timeSlot}</span><small>{item.status === "taken" ? "Logged" : "Not logged"}</small></label>)}</fieldset><p className="settings-note">Record only medicine you’ve already taken. This doesn’t change your prescribed amount or schedule.</p><button className="cs-button cs-button--primary" disabled={!hydrated || !slot || slot.status === "taken"} onClick={() => { if (slot) onLog(slot.medicineId, slot.timeSlot); }} type="button">{slot?.status === "taken" ? "Already logged" : "Log as taken"}</button></div></div>;
}

function WalkSheet({ walks, onSave }: { walks: { id: string; minutes: number; at: string }[]; onSave: (minutes: number) => void }) {
  const [minutes, setMinutes] = useState(20);
  const [custom, setCustom] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const duration = custom ? Number(customMinutes) : minutes;
  const valid = Number.isInteger(duration) && duration >= 1 && duration <= 1440;
  return <form className="settings-form" onSubmit={(event) => { event.preventDefault(); if (valid) onSave(duration); }}>
    <div className="receiver-walk-illustration"><DailyIcon name="walk" /></div>
    <p className="care-body-copy">How long did you walk?</p>
    <div className="receiver-walk-times" role="group" aria-label="Walk duration">
      {[10, 15, 20, 30].map((value) => <button aria-pressed={!custom && minutes === value} onClick={() => { setMinutes(value); setCustom(false); }} key={value} type="button">{value} min</button>)}
      <button aria-pressed={custom} onClick={() => setCustom(true)} type="button">Custom</button>
    </div>
    {custom && <label className="onboarding-field"><span>Duration in minutes</span><input type="number" inputMode="numeric" min={1} max={1440} step={1} required value={customMinutes} onChange={(event) => setCustomMinutes(event.target.value)} placeholder="e.g. 45" /><small>1–1,440 minutes</small></label>}
    <button className="cs-button cs-button--primary" disabled={!valid} type="submit">Log walk</button>
    {walks.length > 0 && <div className="settings-list">{walks.map((walk) => <div className="settings-row" key={walk.id}><strong>{walk.minutes} minutes</strong><time dateTime={walk.at}>{formatTime(walk.at)}</time></div>)}</div>}
  </form>;
}

function VisitorSheet({ current, onSave }: { current?: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(current ?? "");
  function submit(event: FormEvent) { event.preventDefault(); if (name.trim()) onSave(name.trim()); }
  return <form className="settings-form" onSubmit={submit}><p className="care-body-copy">Who are you expecting?</p><div className="receiver-visitor-presets">{["Family", "Friend", "Nurse", "Delivery"].map((label) => <button aria-pressed={name === label} onClick={() => setName(label)} key={label} type="button">{label}</button>)}</div><label className="onboarding-field"><span>Name or visit</span><input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Who’s coming?" /></label><p className="settings-note">Sets a visit window from this hour for about two hours, ending by midnight. This replaces today’s previous one-off visit and does not verify who is at the door.</p><button className="cs-button cs-button--primary" disabled={!name.trim()} type="submit">Save expected visit</button></form>;
}

function VoiceSheet({ onCheckIn, onMedicine, onWalk }: { onCheckIn: () => void; onMedicine: () => void; onWalk: () => void }) {
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  async function listen() {
    if (!canListen()) { setResult("Voice isn’t supported in this browser. Use the buttons instead, or open in Chrome."); return; }
    if (!isSecureMediaContext()) { setResult("Microphone access needs HTTPS or localhost."); return; }
    const controller = new AbortController();
    controllerRef.current = controller;
    setListening(true); setResult("");
    const response = await listenOnceDetailed(9000, controller.signal);
    if (controller.signal.aborted) return;
    setListening(false);
    if (!response.transcript) { setResult(response.error ?? "I didn’t catch that. Try again or use the buttons."); return; }
    const intent = parseRecipientIntent(response.transcript);
    setResult(`Heard: “${response.transcript}”`);
    if (intent === "okay") { onCheckIn(); setResult("Check-in saved for your care circle."); }
    else if (intent === "medicine") onMedicine();
    else if (intent === "walk") onWalk();
    else setResult(`Heard: “${response.transcript}”. Try “I’m okay”, “I took my medicine”, or “I went for a walk”.`);
  }
  return <div className="settings-form"><div className={`receiver-voice-icon${listening ? " is-listening" : ""}`}><DailyIcon name="mic" /></div><p className="care-body-copy">Say “I’m okay”, “I took my medicine”, or “I went for a walk”.</p><p className="settings-note">Medicine and walk commands open their log for you to confirm. Listening starts only when you tap below.</p><button className="cs-button cs-button--primary" onClick={() => { if (listening) { controllerRef.current?.abort(); setListening(false); setResult("Listening stopped."); } else void listen(); }} type="button">{listening ? "Stop listening" : "Tap to speak"}</button>{result && <p role="status" className="care-body-copy">{result}</p>}</div>;
}
