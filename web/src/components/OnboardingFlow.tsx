"use client";

import { BrandMark } from "./BrandMark";

import { X } from "lucide-react";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { useRouter } from "next/navigation";
import { CheckInPlan, DutyPlan, HouseholdReview, InviteMembers } from "./CareSetupSteps";
import { CARE_SETUP_KEY, emptyCareSetup, missingCareSetupDetails, parseCareSetup, type CareSetup } from "@/lib/care-setup";
import { DrawerSelect } from "./BottomDrawer";
import { completeAccountOnboarding, signedInAccountName } from "@/lib/account-profile";

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-welcome-inter",
});

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-welcome-jakarta",
});

type Role = "caregiver" | "recipient";
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

const profileIcons = [
  { label: "Sun", src: "/images/onboarding/sun-icon.svg" },
  { label: "Flower", src: "/images/onboarding/flower.svg" },
  { label: "Bird", src: "/images/onboarding/bird.svg" },
  { label: "Leaf", src: "/images/onboarding/leaf.svg" },
] as const;

const profileColors = [
  { label: "Amber", value: "#f3d7a2" },
  { label: "Sage", value: "#cfdfd1" },
  { label: "Lilac", value: "#e5dff1" },
  { label: "Rose", value: "#f1dbd6" },
  { label: "Pick color", value: "conic-gradient(#f4e5fd, #98f8f5, #c4fdbb, #fff8db, #ffb8b8, #f4e5fd)" },
] as const;

export function StatusBar() {
  return (
    <div className="onboarding-status" aria-label="Device status">
      <span>9:41</span>
      <Image
        src="/images/welcome/device-status.svg"
        width={74}
        height={14}
        alt="Cellular, Wi-Fi, and battery status"
        priority
      />
    </div>
  );
}


function LockShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.8"
        width="5.6"
        x="9.2"
        y="10"
      />
      <path
        d="M10.4 10V8.6a1.6 1.6 0 0 1 3.2 0V10m-1.6 2.4v1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RoleCard({
  role,
  selected,
  onSelect,
  onFocus,
  cardRef,
}: {
  role: Role;
  selected: boolean;
  onSelect: (role: Role) => void;
  onFocus: () => void;
  cardRef: (node: HTMLButtonElement | null) => void;
}) {
  const caregiver = role === "caregiver";

  return (
    <button
      aria-pressed={selected}
      className={`onboarding-role-card${selected ? " is-selected" : ""}`}
      onFocus={onFocus}
      onClick={() => onSelect(role)}
      ref={cardRef}
      type="button"
    >
      <span className="onboarding-role-card__copy">
        <span className="onboarding-role-card__icon">
          <Image
            src={`/images/onboarding/${caregiver ? "heart-handshake.svg" : "hand-heart.svg"}`}
            width={26}
            height={26}
            alt=""
          />
        </span>
        <span className="onboarding-role-card__details">
          <span className="onboarding-role-card__role">
            {caregiver ? "Caregiver" : "Care recipient"}
          </span>
          <span className="onboarding-role-card__title">
            {caregiver ? "I support someone" : "I receive support"}
          </span>
          <span className="onboarding-role-card__description">
            {caregiver
              ? "Bring your care team together."
              : "Stay connected with your family."}
          </span>
        </span>
      </span>
      <span className="onboarding-role-card__image">
        <Image
          src={`/images/onboarding/${caregiver ? "caregiver-family.png" : "recipient-family.png"}`}
          alt={
            caregiver
              ? "A family caring for a loved one at home"
              : "A care recipient sharing a meal with family"
          }
          fill
          sizes="(max-width: 430px) 75vw, 292px"
        />
      </span>
    </button>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <div
      aria-label={`Setup step ${current} of 7`}
      className="onboarding-progress"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={7}
      aria-valuenow={current}
    >
      {Array.from({ length: 7 }, (_, index) => (
        <span
          className={index < current ? "is-complete" : ""}
          key={index}
        />
      ))}
    </div>
  );
}

function FormField({
  id,
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  required = false,
  invalid = false,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <label className="onboarding-field" htmlFor={id}>
      <span>{label}{required ? " *" : ""}</span>
      <input
        required={required}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

const subscribeToMount = () => () => {};

export function OnboardingFlow() {
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  if (!mounted) return <main aria-busy="true" aria-label="Loading care setup" className="onboarding-screen" />;
  return <OnboardingWizard />;
}

function OnboardingWizard() {
  const router = useRouter();
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(CARE_SETUP_KEY);
      return { setup: raw ? parseCareSetup(raw) : emptyCareSetup, error: "" };
    } catch (error) {
      console.error("Unable to read saved care setup", error);
      return { setup: emptyCareSetup, error: "Saved setup could not be loaded. Your previous data has not been changed." };
    }
  });
  const [step, setStep] = useState<Step>(() => {
    const requested = Number(new URLSearchParams(window.location.search).get("step"));
    return requested === 1 || requested === 2 || requested === 3 || requested === 4 || requested === 5 || requested === 6 || requested === 7 ? requested : 0;
  });
  const [role, setRole] = useState<Role>("caregiver");
  const [caregiverName, setCaregiverName] = useState(initial.setup.caregiverName);
  const [caregiverPreferredName, setCaregiverPreferredName] = useState(initial.setup.caregiverPreferredName);
  const [recipientUsername, setRecipientUsername] = useState(initial.setup.recipientUsername);
  const [recipientName, setRecipientName] = useState(initial.setup.recipientName);
  const [recipientPreferredName, setRecipientPreferredName] = useState(initial.setup.recipientPreferredName);
  const [relationship, setRelationship] = useState(initial.setup.relationship);
  const [profileIcon, setProfileIcon] = useState(initial.setup.profileIcon);
  const [profileColor, setProfileColor] = useState(initial.setup.profileColor);
  const [settings, setSettings] = useState(initial.setup);
  const [reviewReturn, setReviewReturn] = useState(false);
  const [message, setMessage] = useState(initial.error);
  const [invalidField, setInvalidField] = useState("");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const roleTrackRef = useRef<HTMLDivElement>(null);
  const roleCardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    let active = true;
    void signedInAccountName().then((name) => {
      if (!active || !name) return;
      setCaregiverName((current) => current.trim() ? current : name.fullName);
      setCaregiverPreferredName((current) => current.trim() ? current : name.preferredName);
    }).catch(() => {
      if (!active) return;
      console.error("Unable to load account name for care setup.");
      setMessage("Your account name couldn't be loaded. You can enter it below.");
    });
    return () => { active = false; };
  }, []);

  const setup: CareSetup = {
    ...settings, caregiverName, caregiverPreferredName, recipientUsername,
    recipientName, recipientPreferredName, relationship, profileIcon, profileColor,
  };

  function updateSetup(patch: Partial<CareSetup>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function keepRoleCardVisible(roleIndex: number) {
    const track = roleTrackRef.current;
    const card = roleCardRefs.current[roleIndex];
    if (!track || !card || track.scrollWidth <= track.clientWidth) return;

    const trackBounds = track.getBoundingClientRect();
    const cardBounds = card.getBoundingClientRect();
    const nextScrollLeft =
      roleIndex === 0
        ? track.scrollLeft + cardBounds.left - trackBounds.left
        : track.scrollLeft + cardBounds.right - trackBounds.right;
    track.scrollTo({ left: nextScrollLeft, behavior: "smooth" });
  }

  function focusRole(roleIndex: number) {
    const card = roleCardRefs.current[roleIndex];
    if (!card) return;
    card.focus({ preventScroll: true });
    requestAnimationFrame(() => keepRoleCardVisible(roleIndex));
  }

  function selectRole(nextRole: Role) {
    setRole(nextRole);
    const roleIndex = nextRole === "caregiver" ? 0 : 1;
    requestAnimationFrame(() => keepRoleCardVisible(roleIndex));
  }

  function updateRoleFromCarousel() {
    const track = roleTrackRef.current;
    if (!track || track.scrollWidth <= track.clientWidth) return;
    const trackCenter =
      track.getBoundingClientRect().left + track.clientWidth / 2;
    const nearestIndex = roleCardRefs.current.reduce(
      (nearest, card, index, cards) => {
        if (!card) return nearest;
        const cardCenter =
          card.getBoundingClientRect().left +
          card.getBoundingClientRect().width / 2;
        const nearestCard = cards[nearest];
        if (!nearestCard) return index;
        const nearestCenter =
          nearestCard.getBoundingClientRect().left +
          nearestCard.getBoundingClientRect().width / 2;
        return Math.abs(cardCenter - trackCenter) <
          Math.abs(nearestCenter - trackCenter)
          ? index
          : nearest;
      },
      0,
    );
    setRole(nearestIndex === 0 ? "caregiver" : "recipient");
  }

  function handleRoleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const currentIndex = role === "caregiver" ? 0 : 1;
    const nextIndex =
      event.key === "ArrowRight"
        ? Math.min(roleCardRefs.current.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);
    const nextRole: Role = nextIndex === 0 ? "caregiver" : "recipient";
    setRole(nextRole);
    focusRole(nextIndex);
  }

  function goToStep(nextStep: Step) {
    setStep(nextStep);
    setMessage("");
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }

  async function continueSetup() {
    if (saving) return;
    if (step === 0) {
      if (role === "recipient") {
        router.push("/onboarding/receiver");
        return;
      }
      goToStep(1);
      return;
    }
    if (!validateDetails()) return;
    setInvalidField("");
    if (step === 5) updateSetup({ dutyEnabled: true });
    if (reviewReturn) {
      setReviewReturn(false);
      goToStep(7);
      return;
    }
    if (step < 7) {
      goToStep((step + 1) as Step);
      return;
    }
    try {
      setSaving(true);
      localStorage.setItem(CARE_SETUP_KEY, JSON.stringify(setup));
      await completeAccountOnboarding("caregiver");
      router.push("/care-circle");
    } catch (error) {
      console.error("Unable to save care setup", error);
      setMessage("Your setup could not be fully saved. Check browser storage and your account connection, then try again.");
    } finally { setSaving(false); }
  }

  function validateDetails() {
    const missing = missingCareSetupDetails(setup);
    if (!missing || step < missing.step) return true;
    goToStep(missing.step);
    setInvalidField(missing.field);
    setMessage(missing.message);
    requestAnimationFrame(() => {
      const target = missing.field === "relationship"
        ? bodyRef.current?.querySelector<HTMLButtonElement>(".drawer-select-trigger")
        : document.getElementById(missing.field);
      target?.focus();
    });
    return false;
  }

  function goBack() {
    if (reviewReturn) {
      setReviewReturn(false);
      goToStep(7);
      return;
    }
    if (step > 0) goToStep((step - 1) as Step);
  }

  function skipStep() {
    if (!validateDetails()) return;
    if (step === 5) updateSetup({ dutyEnabled: false, backupIds: [] });
    if (step === 6) updateSetup({ checkInEnabled: false });
    if (reviewReturn) {
      setReviewReturn(false);
      goToStep(7);
    } else if (step > 0 && step < 7) {
      goToStep((step + 1) as Step);
    }
  }

  const recipientDisplayName =
    recipientPreferredName || recipientName || "Evelyn";
  const selectedColor =
    profileColors.find((color) => color.label === profileColor) ??
    profileColors[0];
  const selectedIcon =
    profileIcons.find((icon) => icon.label === profileIcon) ?? profileIcons[0];

  return (
    <main className={`onboarding-screen onboarding-flow ${inter.variable} ${jakarta.variable}`}>
      <StatusBar />

      {step === 0 ? (
        <header className="onboarding-role-header">
          <Link
            className="onboarding-wordmark"
            href="/"
            aria-label="CareSignal home"
          >
            <BrandMark />
            <span>CareSignal</span>
          </Link>
          <button
            aria-label="About CareSignal"
            className="welcome-screen__help onboarding-help"
            onClick={() =>
              setMessage("CareSignal helps families share care and stay connected.")
            }
            type="button"
          >
            <span aria-hidden="true">?</span>
          </button>
        </header>
      ) : (
        <>
          <header className="onboarding-wizard-header">
            <Link
              aria-label="Return to CareSignal home"
              className="onboarding-wizard-home"
              href="/"
            >
              <BrandMark centered />
            </Link>
            {(step === 4 || step === 5 || step === 6) && (
              <button
                className="onboarding-skip"
                onClick={skipStep}
                type="button"
              >
                {step === 5 ? "Setup Later" : "Skip"}
              </button>
            )}
          </header>
          <div className="onboarding-progress-row">
            <Progress current={step} />
          </div>
        </>
      )}

      {step === 0 ? (
        <div className="onboarding-body onboarding-body--roles" ref={bodyRef}>
          <h1 className="onboarding-role-heading">
            How will you use{" "}
            <br />
            Care Signal?
          </h1>
          <div
            aria-label="Choose your role"
            className="onboarding-role-track"
            onKeyDown={handleRoleKeyDown}
            onScroll={updateRoleFromCarousel}
            ref={roleTrackRef}
            role="group"
            tabIndex={-1}
          >
            <RoleCard
              cardRef={(node) => {
                roleCardRefs.current[0] = node;
              }}
              onFocus={() => selectRole("caregiver")}
              onSelect={selectRole}
              role="caregiver"
              selected={role === "caregiver"}
            />
            <RoleCard
              cardRef={(node) => {
                roleCardRefs.current[1] = node;
              }}
              onFocus={() => selectRole("recipient")}
              onSelect={selectRole}
              role="recipient"
              selected={role === "recipient"}
            />
          </div>
          <div className="onboarding-reassurance">
            <span className="onboarding-reassurance__lock" aria-hidden="true">
              <LockShieldIcon />
            </span>
            <p>Your circle is private. Only people you invite can join.</p>
          </div>
        </div>
      ) : (
        <div
          className={`onboarding-body onboarding-body--wizard onboarding-body--wizard-step-${step}`}
          ref={bodyRef}
        >
          <div
            className={`onboarding-wizard-heading onboarding-wizard-heading--step-${step}`}
          >
            <h1>
              {step === 1 && "What is your name?"}
              {step === 2 &&
                "What does your care receiver like to be called?"}
              {step === 3 &&
                `Choose a name and icon for ${recipientDisplayName}`}
              {step === 4 && "Invite people you trust to your care circle."}
              {step === 5 && "Make a starting plan. It won’t be active until you finish setup."}
              {step === 6 && `Set a check-in time for ${recipientDisplayName}.`}
              {step === 7 && "Check the details of your new care circle."}
            </h1>
          </div>

          {step === 1 && (
            <div className="onboarding-form-stack">
              <FormField
                id="caregiver-full-name"
                required
                invalid={invalidField === "caregiver-full-name"}
                label="Your full name"
                onChange={setCaregiverName}
                placeholder="Full Name"
                value={caregiverName}
              />
              <FormField
                id="caregiver-preferred-name"
                label="Your preferred name"
                onChange={setCaregiverPreferredName}
                placeholder="Preferred Name"
                value={caregiverPreferredName}
              />
              <div className="onboarding-reassurance">
                <span className="onboarding-reassurance__lock" aria-hidden="true">
                  <LockShieldIcon />
                </span>
                <p>
                  <strong>You&apos;ll be the care lead.</strong>
                  <br />
                  You manage care circle access, settings and connections. Care
                  is shared with your team.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-form-stack onboarding-form-stack--recipient">
              <FormField
                id="recipient-username"
                label="Their user name"
                onChange={setRecipientUsername}
                placeholder="Username"
                value={recipientUsername}
              />
              <FormField
                id="recipient-full-name"
                required
                invalid={invalidField === "recipient-full-name"}
                label="Their full name"
                onChange={setRecipientName}
                placeholder="Full Name"
                value={recipientName}
              />
              <FormField
                id="recipient-preferred-name"
                label="Their preferred name"
                onChange={setRecipientPreferredName}
                placeholder="Preferred Name"
                value={recipientPreferredName}
              />
              <DrawerSelect label="Their relationship to you *" onChange={setRelationship} value={relationship} options={["Parent", "Spouse or partner", "Child", "Sibling", "Friend", "Other"].map((option) => ({ value: option, label: option }))} />
              <div className="onboarding-reassurance">
                <span className="onboarding-reassurance__lock" aria-hidden="true">
                  <LockShieldIcon />
                </span>
                <p>
                  No medical details needed. Invite will be sent to care
                  receiver if they are not yet enrolled
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <section className="onboarding-profile-card" aria-label="Care receiver profile">
              <div className="onboarding-profile-preview">
                <span
                  className="onboarding-profile-preview__icon"
                  style={{ background: selectedColor.value }}
                >
                  <Image
                    alt=""
                    height={35}
                    src={selectedIcon.src}
                    width={35}
                  />
                </span>
                <span>
                  <strong>{recipientDisplayName}</strong>
                  <small>
                    {profileIcon} icon · {profileColor}
                  </small>
                </span>
              </div>

              <div className="onboarding-profile-section">
                <div className="onboarding-profile-section__heading">
                  <strong>Profile icon</strong>
                  <button
                    onClick={() =>
                      setMessage("More profile icons will be added soon.")
                    }
                    type="button"
                  >
                    more icons
                  </button>
                </div>
                <div className="onboarding-icon-options">
                  {profileIcons.map((icon) => (
                    <button
                      aria-pressed={profileIcon === icon.label}
                      className={
                        profileIcon === icon.label ? "is-selected" : ""
                      }
                      key={icon.label}
                      onClick={() => setProfileIcon(icon.label)}
                      type="button"
                    >
                      <span>
                        <Image
                          alt=""
                          height={26}
                          src={icon.src}
                          width={26}
                        />
                      </span>
                      <small>{icon.label}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="onboarding-profile-section">
                <strong>Profile color</strong>
                <div className="onboarding-color-options">
                  {profileColors.map((color) => (
                    <button
                      aria-pressed={profileColor === color.label}
                      aria-label={`${color.label} profile color`}
                      key={color.label}
                      onClick={() => setProfileColor(color.label)}
                      type="button"
                    >
                      <span
                        className={
                          profileColor === color.label ? "is-selected" : ""
                        }
                        style={{ background: color.value }}
                      >
                        {profileColor === color.label && (
                          <Image
                            alt=""
                            height={22}
                            src="/images/onboarding/check.svg"
                            width={22}
                          />
                        )}
                      </span>
                      <small>{color.label}</small>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {step === 4 && (
            <InviteMembers members={settings.members} onChange={(members) => updateSetup({ members, backupIds: settings.backupIds.filter((id) => members.some((member) => member.id === id)) })} onMessage={setMessage} />
          )}
          {step === 5 && <DutyPlan setup={setup} onChange={updateSetup} />}
          {step === 6 && <CheckInPlan setup={setup} onChange={updateSetup} />}
          {step === 7 && <HouseholdReview setup={setup} onEdit={(nextStep) => { setReviewReturn(true); goToStep(nextStep); }} />}
        </div>
      )}

      <footer
        className={`onboarding-footer${step === 0 ? " onboarding-footer--roles" : step === 7 ? " onboarding-footer--review" : ""}`}
      >
        {step === 0 ? (
          <>
            <button
              className="cs-button cs-button--primary onboarding-footer__single"
              onClick={continueSetup}
              disabled={saving}
              type="button"
            >
              Continue
            </button>
            <SignInPrompt
              onClick={() => router.push("/welcome?signin=1")}
            />
          </>
        ) : (
          <>
            <div className="onboarding-footer__actions">
              <button
                className="cs-button cs-button--glass"
                disabled={saving}
                onClick={goBack}
                type="button"
              >
                Back
              </button>
              <button
                className="cs-button cs-button--primary"
                disabled={saving}
                onClick={continueSetup}
                type="button"
              >
                {saving ? "Saving setup..." : step === 7 ? "Finish Setup" : reviewReturn ? "Save changes" : "Continue"}
              </button>
            </div>
            {step === 5 || step === 6 ? (
              <p className="onboarding-sign-in"><button onClick={skipStep} type="button">{step === 5 ? "Set this up later" : "Setup later. No reminders set yet"}</button></p>
            ) : step !== 7 ? <SignInPrompt onClick={() => router.push("/welcome?signin=1")} /> : null}
          </>
        )}
        <div className="onboarding-home-indicator" aria-hidden="true" />
      </footer>

      {message && (
        <div className="onboarding-message" role="status">
          <span>{message}</span>
          <button aria-label="Dismiss message" className="care-message-dismiss" onClick={() => setMessage("")} type="button"><X aria-hidden="true" size={18} strokeWidth={2} /></button>
        </div>
      )}
    </main>
  );
}

function SignInPrompt({ onClick }: { onClick: () => void }) {
  return (
    <p className="onboarding-sign-in">
      Already have an account?{" "}
      <button onClick={onClick} type="button">
        Sign In
      </button>
    </p>
  );
}
