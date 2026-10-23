"use client";

import { Bell, Check, ChevronRight, Home, Settings, ShieldCheck, Unplug, UserRoundCheck, Users, X } from "lucide-react";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BottomDrawer } from "./BottomDrawer";
import { CareHomeHeader } from "./CareHomeChrome";
import { initials } from "@/lib/care-setup";
import { StatusBar, inter, jakarta } from "./OnboardingFlow";
import { BrandMark } from "./BrandMark";
import {
  DEMO_INVITE_CODE,
  RECEIVER_SETUP_KEY,
  emptyReceiverSetup,
  normalizeInviteCode,
  parseReceiverSetup,
  type ReceiverSetup,
} from "@/lib/receiver-setup";

type ReceiverStep = "intro" | "code" | "review" | "joined" | "day";
const subscribeToMount = () => () => {};

function ReceiverIcon({ name }: { name: "mail-lock" | "shield-check" | "share" | "handshake" }) {
  return <Image alt="" height={24} src={`/images/receiver/${name}.svg`} width={24} />;
}

function ReceiverNotice({ children, people = false }: { children: ReactNode; people?: boolean }) {
  return (
    <aside className="receiver-notice">
      <span className="receiver-notice__icon">
        {people
          ? <Image alt="" height={20} src="/images/receiver/people.png" width={20} />
          : <ReceiverIcon name="shield-check" />}
      </span>
      <p>{children}</p>
    </aside>
  );
}

function ReceiverIdentity({ name, joined = false }: { name: string; joined?: boolean }) {
  return (
    <div className="care-member">
      <span className="care-member__avatar receiver-profile-icon">
        <Image alt="" height={24} src="/images/onboarding/sun.svg" width={24} />
      </span>
      <span className="care-member__details"><strong>{name}</strong><small>Parent</small></span>
      {joined && <span className="care-chip receiver-joined-chip">Joined</span>}
    </div>
  );
}

function Inviter({ showEmail = false }: { showEmail?: boolean }) {
  return (
    <div className="care-member">
      <span aria-hidden="true" className="care-member__avatar">EM</span>
      <span className="care-member__details">
        <strong>Elias Morgan</strong>
        <small>{showEmail ? "elias.morgan@example.com" : "Care lead · Invited you."}</small>
      </span>
    </div>
  );
}

export function ReceiverOnboarding({ initialView }: { initialView?: "day" }) {
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  if (!mounted) return <main aria-busy="true" aria-label="Loading care receiver setup" className="onboarding-screen" />;
  return <ReceiverWizard initialView={initialView} />;
}

function ReceiverWizard({ initialView }: { initialView?: "day" }) {
  const router = useRouter();
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(RECEIVER_SETUP_KEY);
      return { setup: raw ? parseReceiverSetup(raw) : emptyReceiverSetup, error: "" };
    } catch (error) {
      console.error("Unable to read care receiver setup", error);
      return { setup: emptyReceiverSetup, error: "Saved setup could not be loaded. Your previous data has not been changed." };
    }
  });
  const [setup, setSetup] = useState(initial.setup);
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("code") ?? (initial.setup.joined ? DEMO_INVITE_CODE : ""));
  const [step, setStep] = useState<ReceiverStep>(() =>
    initialView === "day" ? "day" : initial.setup.joined ? "joined" :
      new URLSearchParams(window.location.search).has("code") ? "code" : "intro",
  );
  const [message, setMessage] = useState(initial.error);
  const [codeError, setCodeError] = useState("");
  const [editing, setEditing] = useState(false);
  const [daySheet, setDaySheet] = useState<"profile" | "circle" | "reminder" | "devices" | null>(null);
  const [draftName, setDraftName] = useState(setup.preferredName);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const validCode = normalizeInviteCode(code) === DEMO_INVITE_CODE;
  const stepIndex = ["intro", "code", "review", "joined", "day"].indexOf(step);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const checkedIn = setup.checkInDate === today;

  function goTo(nextStep: ReceiverStep) {
    setStep(nextStep);
    setMessage("");
    setCodeError("");
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }

  function save(next: ReceiverSetup) {
    try {
      localStorage.setItem(RECEIVER_SETUP_KEY, JSON.stringify(next));
      setSetup(next);
      return true;
    } catch (error) {
      console.error("Unable to save care receiver setup", error);
      setMessage("Your setup could not be saved on this device. Allow browser storage and try again.");
      return false;
    }
  }

  function continueSetup() {
    if (step === "intro") goTo("code");
    if (step === "code") {
      if (!validCode) {
        setCodeError("This preview only recognizes the demo invitation CS-7K4M. Real invitation lookup is not connected yet.");
        codeInputRef.current?.focus();
        return;
      }
      goTo("review");
    }
    if (step === "review") {
      if (setup.joined) {
        if (save(setup)) goTo("joined");
        return;
      }
      if (!validCode) {
        goTo("code");
        return;
      }
      if (save({ ...setup, joined: true, reminderChoice: null, completed: false })) goTo("joined");
    }
    if (step === "joined" && save({ ...setup, completed: true })) router.push("/onboarding/my-day");
  }

  function goBack() {
    if (step === "intro") router.push("/onboarding");
    else if (step === "code") goTo("intro");
    else if (step === "review") goTo("code");
    else if (step === "joined") goTo("review");
  }

  function connectLater() {
    if (save({ ...setup, completed: true })) router.push("/onboarding/my-day");
  }

  function skipReminder() {
    if (save({ ...setup, reminderChoice: null, completed: true })) router.push("/onboarding/my-day");
  }

  const headings: Record<ReceiverStep, string> = {
    intro: "Get support from your care circle members.",
    code: "Enter the code from your CareSignal invitation.",
    review: "Check the details for your new household.",
    joined: "You’ve joined your family’s circle.",
    day: "My Day",
  };

  if (step === "day") return (
    <main className={`onboarding-screen care-home caregiver-home settings-screen receiver-setup-day ${inter.variable} ${jakarta.variable}`}>
      <StatusBar />
      <CareHomeHeader initials={initials(setup.preferredName)} onAccount={() => setDaySheet("profile")} />
      <div className="onboarding-body receiver-setup-day__body">
        <header className="receiver-setup-day__greeting">
          <p>My day</p>
          <h1>Hello {setup.preferredName.trim().split(/\s+/)[0]}.<br />It’s good to have you here.</h1>
        </header>
        <div className="receiver-setup-day__grid">
          <section className="care-card receiver-setup-day__check">
            <span className="receiver-setup-day__icon"><UserRoundCheck aria-hidden="true" size={24} /></span>
            <h2>{checkedIn ? "A little hello, saved for today." : "Say hello to your care circle."}</h2>
            <p>{setup.joined ? checkedIn ? "Your preview check-in is saved on this device." : "Start with a gentle check-in. There’s no check-in from you today." : "Join your care circle when you’re ready to check in."}</p>
            {setup.joined ? <button className="cs-button cs-button--primary" disabled={checkedIn} onClick={() => {
              if (save({ ...setup, checkInDate: today })) setMessage("Demo check-in saved on this device. Nothing was sent to your care team.");
            }} type="button">{checkedIn ? <Check aria-hidden="true" size={20} /> : <UserRoundCheck aria-hidden="true" size={20} />}{checkedIn ? "Checked in today" : "Check in to your day"}</button> : <Link className="cs-button cs-button--primary" href="/onboarding/receiver">Enter invite code <ChevronRight aria-hidden="true" size={18} /></Link>}
            <span className="receiver-setup-day__preview-note"><ShieldCheck aria-hidden="true" size={15} />Setup preview · check-ins stay on this device</span>
          </section>
          <section className="care-card receiver-setup-day__circle">
            <div className="care-card__heading"><h2>Your care circle</h2><button className="care-text-button" onClick={() => setDaySheet("circle")} type="button">View <ChevronRight aria-hidden="true" size={16} /></button></div>
            {setup.joined ? <div className="settings-inset"><Inviter /><span className="care-chip">Demo member</span></div> : <div className="settings-inset receiver-setup-day__empty"><span className="receiver-setup-day__icon"><Users aria-hidden="true" size={24} /></span><div><strong>A little support, together</strong><p>Use your family’s invitation to connect.</p></div></div>}
            <p>{setup.joined ? "Elias is the care lead shown in your demo invitation." : "Your care circle will appear here once you join."}</p>
          </section>
          <section className="care-card receiver-setup-day__next">
            <div className="care-card__heading"><h2>Your next steps</h2></div>
            <button className="receiver-setup-day__row settings-inset" onClick={() => setDaySheet("reminder")} type="button"><span className="receiver-setup-day__icon"><Bell aria-hidden="true" size={22} /></span><span><strong>Daily reminder</strong><small>{setup.reminderChoice === "yes" ? "9:00 AM · Every day · Local time" : "Choose a gentle reminder, or leave it off"}</small></span><ChevronRight aria-hidden="true" size={20} /></button>
            <button className="receiver-setup-day__row settings-inset" onClick={() => setDaySheet("devices")} type="button"><span className="receiver-setup-day__icon"><Unplug aria-hidden="true" size={22} /></span><span><strong>Ring and other devices</strong><small>Not connected in this setup preview</small></span><ChevronRight aria-hidden="true" size={20} /></button>
          </section>
          <section className="care-card receiver-setup-day__continue">
            <h2>Make yourself at home.</h2><p>Your daily screen brings check-ins, medicines, mood, and walks together.</p>
            <Link className="cs-button cs-button--glass" href="/recipient">Open My day <ChevronRight aria-hidden="true" size={18} /></Link>
          </section>
        </div>
      </div>
      <footer className="care-home__footer"><nav className="care-home__nav" aria-label="Receiver navigation">
        <Link href="/onboarding/my-day" aria-current="page"><Home aria-hidden="true" size={25} /><span>Home</span></Link>
        <Link href="/recipient?view=reminders"><Bell aria-hidden="true" size={25} /><span>Reminders</span></Link>
        <Link href="/recipient?view=circle"><Users aria-hidden="true" size={25} /><span>Care circle</span></Link>
        <Link href="/recipient?view=settings"><Settings aria-hidden="true" size={25} /><span>Settings</span></Link>
      </nav><div className="onboarding-home-indicator" aria-hidden="true" /></footer>
      {message && <div className="onboarding-message" role="status"><span>{message}</span><button aria-label="Dismiss message" className="care-message-dismiss" onClick={() => setMessage("")} type="button"><X aria-hidden="true" size={18} /></button></div>}
      {daySheet && <BottomDrawer title={daySheet === "profile" ? "Your profile" : daySheet === "circle" ? "Your care circle" : daySheet === "reminder" ? "Daily reminder" : "Your devices"} onClose={() => setDaySheet(null)}>
        <div className="settings-form">
          {daySheet === "profile" && <><ReceiverIdentity name={setup.preferredName} joined={setup.joined} /><p className="settings-note">This is your local setup preview, not a signed-in account.</p><Link className="cs-button cs-button--glass" href="/onboarding/receiver">Review setup</Link></>}
          {daySheet === "circle" && <>{setup.joined ? <Inviter /> : <p className="care-body-copy">You haven’t joined a care circle yet.</p>}<p className="settings-note">Invitations here are demo-only. Real account invitations aren’t connected yet.</p><Link className="cs-button cs-button--glass" href="/onboarding/receiver">{setup.joined ? "Review invitation" : "Enter invite code"}</Link></>}
          {daySheet === "reminder" && <><p className="care-body-copy">Choose your reminder preference for this setup preview. No notifications are scheduled yet.</p>{setup.joined ? <>{(["yes", "no"] as const).map((choice) => <button className="drawer-option" aria-pressed={setup.reminderChoice === choice} key={choice} type="button" onClick={() => { if (save({ ...setup, reminderChoice: choice })) setDaySheet(null); }}><span>{choice === "yes" ? "Every day · 9:00 AM" : "No daily reminder"}</span>{setup.reminderChoice === choice && <Check aria-hidden="true" size={20} />}</button>)}</> : <Link className="cs-button cs-button--primary" href="/onboarding/receiver">Join your care circle first</Link>}</>}
          {daySheet === "devices" && <><p className="care-body-copy">No device connection is configured in this setup preview.</p><Link className="cs-button cs-button--glass" href="/recipient?view=settings">Open daily settings <ChevronRight aria-hidden="true" size={18} /></Link></>}
          <button className="cs-button cs-button--glass" onClick={() => setDaySheet(null)} type="button">Done</button>
        </div>
      </BottomDrawer>}
    </main>
  );

  return (
    <main className={`onboarding-screen receiver-screen ${inter.variable} ${jakarta.variable}`}>
      <StatusBar />
      <header className="onboarding-wizard-header">
        <Link aria-label="Return to CareSignal home" className="onboarding-wizard-home" href="/"><BrandMark centered /></Link>
        {step === "joined" && <button className="onboarding-skip" onClick={skipReminder} type="button">Skip</button>}
      </header>
      <div className="onboarding-progress-row">
        <div aria-label={`Care receiver setup step ${Math.min(stepIndex + 1, 4)} of 4`} aria-valuemax={4} aria-valuemin={1} aria-valuenow={Math.min(stepIndex + 1, 4)} className="onboarding-progress" role="progressbar">
          {Array.from({ length: 7 }, (_, index) => <span className={index <= stepIndex ? "is-complete" : ""} key={index} />)}
        </div>
      </div>
      <div className="onboarding-body onboarding-body--wizard receiver-body" ref={bodyRef}>
        <header className="onboarding-wizard-heading receiver-heading">
          <h1 ref={headingRef} tabIndex={-1}>{headings[step]}</h1>
        </header>
        <div className="care-stack receiver-stack">
          {step === "intro" && (
            <>
              <section className="care-card receiver-invite-card">
                <span className="receiver-mail-icon"><ReceiverIcon name="mail-lock" /></span>
                <span className="care-chip receiver-disconnected-chip">Not connected yet</span>
                <h2>Your care circle members can invite you to join</h2>
                <p className="care-body-copy">They can create an invitation from their household and share the code with you.</p>
              </section>
              <ReceiverNotice>You’re not connected yet. Check-ins and requests for help won’t be shared until you join your family’s circle.</ReceiverNotice>
            </>
          )}
          {step === "code" && (
            <>
              <form className="care-card receiver-invite-card" onSubmit={(event) => { event.preventDefault(); continueSetup(); }}>
                <span className="receiver-mail-icon"><ReceiverIcon name="mail-lock" /></span>
                <label className="onboarding-field" htmlFor="receiver-invite-code">
                  Invitation Code
                  <span className="receiver-code-input">
                    <input
                      aria-describedby={`receiver-code-hint${codeError ? " receiver-code-error" : ""}`}
                      aria-invalid={!!codeError}
                      autoCapitalize="characters"
                      autoComplete="off"
                      autoCorrect="off"
                      id="receiver-invite-code"
                      maxLength={32}
                      onChange={(event) => { setCode(event.target.value); setCodeError(""); }}
                      placeholder={DEMO_INVITE_CODE}
                      ref={codeInputRef}
                      spellCheck={false}
                      value={code}
                    />
                    {validCode && <Image alt="Demo invitation recognized" height={20} src="/images/care-circle/backup-check.svg" width={20} />}
                  </span>
                </label>
                <p className="care-body-copy" id="receiver-code-hint">Find this in the invitation message from your family.</p>
                {codeError && <p className="care-error" id="receiver-code-error" role="alert">{codeError}</p>}
                {validCode && (
                  <div aria-live="polite" className="receiver-inviter">
                    <p className="receiver-section-label">Invited by</p>
                    <Inviter showEmail />
                  </div>
                )}
              </form>
              <ReceiverNotice>You’ll see who invited you before joining. Checking a code doesn’t connect your account.</ReceiverNotice>
            </>
          )}
          {(step === "intro" || step === "code") && <p className="receiver-link-note">Have an invitation link? Open message on this device to continue.</p>}
          {step === "review" && (
            <>
              <section className="care-card receiver-review-card">
                <div className="care-card__heading">
                  <h2>{setup.preferredName.trim().split(/\s+/)[0]}’s household</h2>
                  <button className="care-text-button" onClick={() => { setDraftName(setup.preferredName); setEditing(true); }} type="button">Edit</button>
                </div>
                <ReceiverIdentity name={setup.preferredName} />
                <p className="receiver-section-label">Invited by</p>
                <Inviter />
                <div className="receiver-permissions">
                  <p><ReceiverIcon name="handshake" /><span>Join as the person receiving support.</span></p>
                  <p><ReceiverIcon name="share" /><span>Share check-ins and requests for help with your care team.</span></p>
                  <p><ReceiverIcon name="shield-check" /><span>Keep control of your reminders and what you choose to share.</span></p>
                </div>
              </section>
              <ReceiverNotice people>{setup.joined
                ? "Going back to review these pages won’t undo joining or change your reminder preference."
                : <>You haven’t joined yet. Nothing is shared until you tap “Accept &amp; Join”.</>}</ReceiverNotice>
            </>
          )}
          {step === "joined" && (
            <>
              <section className="care-card">
                <ReceiverIdentity joined name={setup.preferredName} />
                <p className="care-body-copy">Elias is your care lead. You can now check in with your care team.</p>
              </section>
              <section className="care-card receiver-reminder">
                <h2 id="receiver-reminder-heading">Would you like a daily reminder?</h2>
                <div aria-labelledby="receiver-reminder-heading" className="receiver-reminder__options" role="radiogroup">
                  <label className={`receiver-reminder-option${setup.reminderChoice === "yes" ? " is-selected" : ""}`}>
                    <Image alt="" height={20} src="/images/receiver/person.png" width={20} />
                    <span>Yes, remind me at 9:00 AM.<br />Every day. My local time.</span>
                    <input checked={setup.reminderChoice === "yes"} name="receiver-reminder" onChange={() => setSetup({ ...setup, reminderChoice: "yes" })} type="radio" value="yes" />
                  </label>
                  <label className={`receiver-reminder-option${setup.reminderChoice === "no" ? " is-selected" : ""}`}>
                    <Image alt="" height={20} src="/images/receiver/link.png" width={20} />
                    <span>No. You can change this anytime</span>
                    <input checked={setup.reminderChoice === "no"} name="receiver-reminder" onChange={() => setSetup({ ...setup, reminderChoice: "no" })} type="radio" value="no" />
                  </label>
                </div>
                <p className="care-body-copy">Elias suggested a gentle hello at <strong>9:00 AM</strong>. It’s your choice to accept or decline. You can change this later.</p>
              </section>
            </>
          )}
        </div>
      </div>
      <footer className="onboarding-footer">
            <div className="onboarding-footer__actions">
              <button className="cs-button cs-button--glass" onClick={goBack} type="button">Back</button>
              <button className="cs-button cs-button--primary" onClick={continueSetup} type="button">
                {step === "intro" ? "Enter invite code" : step === "review" ? setup.joined ? "Continue" : "Accept & Join" : step === "joined" ? "Go to My Day" : "Continue"}
              </button>
            </div>
            <p className="onboarding-sign-in">
              <button onClick={() => {
                if (step === "intro") connectLater();
                else if (step === "code") goTo("intro");
                else if (step === "review") { setCode(""); goTo("code"); }
                else skipReminder();
              }} type="button">
                {step === "intro" ? "I’ll connect later" : step === "code" ? "I don’t have an invitation yet" : step === "review" ? "This isn't my invitation" : "Setup later. No reminders set yet"}
              </button>
            </p>
        <div aria-hidden="true" className="onboarding-home-indicator" />
      </footer>
      {message && <div className="onboarding-message" role="status"><span>{message}</span><button aria-label="Dismiss message" className="care-message-dismiss" onClick={() => setMessage("")} type="button"><X aria-hidden="true" size={18} strokeWidth={2} /></button></div>}
      {editing && <BottomDrawer onClose={() => setEditing(false)} title="Your preferred name">
        <form className="receiver-edit-form" onSubmit={(event) => {
          event.preventDefault();
          if (!draftName.trim()) return;
          setSetup({ ...setup, preferredName: draftName.trim() });
          setEditing(false);
        }}>
          <label className="onboarding-field" htmlFor="receiver-preferred-name">Your name<input autoComplete="name" id="receiver-preferred-name" maxLength={80} onChange={(event) => setDraftName(event.target.value)} required value={draftName} /></label>
          <p className="care-muted">Choose how your name appears. This doesn’t change who sent the invitation.</p>
          <button className="cs-button cs-button--primary care-inline-button" disabled={!draftName.trim()} type="submit">Save changes</button>
        </form>
      </BottomDrawer>}
    </main>
  );
}
