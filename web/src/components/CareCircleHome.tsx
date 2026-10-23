"use client";

import { X } from "lucide-react";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { inter, jakarta, StatusBar } from "./OnboardingFlow";
import { CareHomeFooter, CareHomeHeader } from "./CareHomeChrome";
import { CaregiverActivityHome } from "./CaregiverActivityHome";
import { InvitedMembers } from "./CareSetupSteps";
import { CARE_SETUP_KEY, caregiverLabel, initials, parseCareSetup, recipientLabel, type CareSetup } from "@/lib/care-setup";

const subscribeToMount = () => () => {};

export function CareCircleHome() {
  const search = useSearchParams();
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  if (!mounted) return <main aria-busy="true" aria-label="Loading your care circle" className="onboarding-screen care-home" />;
  return search.get("view") === "activity"
    ? <CaregiverActivityHome />
    : <ReadyCareCircle />;
}

function ReadyCareCircle() {
  const router = useRouter();
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(CARE_SETUP_KEY);
      return { setup: raw ? parseCareSetup(raw) : null, error: "" };
    } catch (error) {
      console.error("Unable to load care circle", error);
      return { setup: null, error: "Your saved care circle could not be loaded. Your data has not been changed." };
    }
  });
  const [setup, setSetup] = useState<CareSetup | null>(initial.setup);
  const [message, setMessage] = useState(initial.error);
  const invitationDialog = useRef<HTMLDialogElement>(null);
  const recipient = setup ? recipientLabel(setup) : "";
  const name = setup ? caregiverLabel(setup) : "";

  function inviteRecipient() {
    if (!setup) return;
    const next = { ...setup, recipientInvitePending: true };
    try {
      localStorage.setItem(CARE_SETUP_KEY, JSON.stringify(next));
      setSetup(next);
      setMessage("Demo invitation saved on this device. No real invitation was sent.");
      invitationDialog.current?.close();
    } catch (error) {
      console.error("Unable to save recipient invitation", error);
      setMessage("The demo invitation could not be saved. Allow browser storage and try again.");
    }
  }

  return (
    <main className={`onboarding-screen care-home ${inter.variable} ${jakarta.variable}`}>
      <StatusBar />
      <CareHomeHeader initials={initials(name)} />
      <div className="onboarding-body care-home__body">
        {setup ? (
          <>
            <h1 className="onboarding-role-heading">Welcome {name === "You" ? "back" : name.split(" ")[0]}.<br />Your care circle is ready for its first hello.</h1>
            <section className="care-card care-home__connect">
              <h2>Connect with {recipient}</h2>
              <p className="care-body-copy">Invite {recipient} to My day for simple check-ins. Nothing is shared from their device until they join.</p>
              <button className="cs-button cs-button--primary care-inline-button" onClick={() => invitationDialog.current?.showModal()} type="button">{setup.recipientInvitePending ? "Invitation pending" : "Send invitation"}</button>
            </section>
            <InvitedMembers members={setup.members} onEdit={() => router.push("/onboarding?step=4")} ready />
            <Link className="care-home__devices" href="/setup">
              <Image alt="" src="/images/care-circle/devices.png" height={29} width={20} />
              <span>Ring and other devices not connected.<br /><small>Setup when ready.</small></span>
              <Image alt="" className="care-chevron-right" src="/images/care-circle/chevron-right.svg" height={18} width={18} />
            </Link>
          </>
        ) : (
          <section className="care-card">
            <h1 className="onboarding-role-heading">Your care circle starts here.</h1>
            <p className="care-body-copy">Finish setup to see your household, invitations, and starting plan.</p>
            <Link className="cs-button cs-button--primary care-inline-button" href="/onboarding">Set up your care circle</Link>
          </section>
        )}
        <Link className="care-text-button" href="/care-circle?view=activity">Preview home activity</Link>
        {message && <p className="care-home__message" role="status">{message}</p>}
      </div>
      <CareHomeFooter />
      <dialog className="care-dialog" ref={invitationDialog}>
        <div className="care-card__heading"><h2>Connect with {recipient}</h2><button aria-label="Close invitation" className="care-close" onClick={() => invitationDialog.current?.close()} type="button"><X aria-hidden="true" size={18} strokeWidth={2} /></button></div>
        <p>This is a local preview. No email, link, or notification will be sent, and nothing is shared from {recipient}’s device.</p>
        <button className="cs-button cs-button--primary care-inline-button" onClick={inviteRecipient} type="button">Save demo invitation</button>
      </dialog>
    </main>
  );
}
