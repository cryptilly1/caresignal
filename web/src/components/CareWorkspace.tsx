"use client";

import { Check } from "lucide-react";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { BottomDrawer, DrawerOption, memberDrawerChoice } from "./BottomDrawer";
import { CareHomeHeader, CareHomeFooter } from "./CareHomeChrome";
import { CaregiverDoorAssist } from "./CaregiverDoorAssist";
import { inter, jakarta, StatusBar } from "./OnboardingFlow";

export function CareWorkspace({ title, active, back, action, children }: {
  title: string; active: "alerts" | "circle"; back?: { href: string; label: string }; action?: ReactNode; children: ReactNode;
}) {
  const { state, setCurrentUser } = useStore();
  const [account, setAccount] = useState(false);
  return <main className={`onboarding-screen care-home caregiver-home settings-screen care-workspace ${inter.variable} ${jakarta.variable}`}>
    <StatusBar />
    <CareHomeHeader accountIcon centered back={back} initials="" onAccount={() => setAccount(true)} />
    <div className="onboarding-body caregiver-home__body workspace-body">
      <header className="settings-heading workspace-heading"><h1>{title}</h1>{action}</header>
      <CaregiverDoorAssist hideIdle />
      {children}
    </div>
    <CareHomeFooter active={active} />
    {account && <BottomDrawer title="Caregiver view" onClose={() => setAccount(false)}>
      <p className="care-body-copy">Demo household view only. Choosing a member does not sign you in as that person. Individual accounts are not connected yet.</p>
      <div aria-label="Demo caregiver" className="drawer-options workspace-account-options">{state.members.filter((member) => member.role === "care_lead" || member.role === "caregiver").map((member) => <DrawerOption {...memberDrawerChoice(member)} selected={state.currentUserId === member.id} key={member.id} onClick={() => { setCurrentUser(member.id); setAccount(false); }} />)}</div>
      <Link className="care-text-button" href="/setup?section=account">Account information</Link>
    </BottomDrawer>}
  </main>;
}

export function CareSection({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`care-card workspace-card ${className}`}><header className="home-section-heading"><h2>{title}</h2>{action}</header>{children}</section>;
}

export function EmptyCareState({ title, detail }: { title: string; detail: string }) {
  return <div className="workspace-empty"><span aria-hidden="true"><Check aria-hidden="true" size={18} strokeWidth={2} /></span><h3>{title}</h3><p>{detail}</p></div>;
}

export function CarePills<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; count?: number }[]; onChange: (value: T) => void }) {
  return <div className="onboarding-segmented workspace-pills" role="group" aria-label={label}>{options.map((option) => <button aria-pressed={option.value === value} key={option.value} onClick={(event) => { onChange(option.value); event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" }); }} type="button">{option.label}{option.count !== undefined && <span>{option.count}</span>}</button>)}</div>;
}
