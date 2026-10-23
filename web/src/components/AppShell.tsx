"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentBackup, currentOnDuty, memberById } from "@/lib/engine";
import {
  isCareReceiverPath,
  isDoorbellPath,
  isTvPath,
} from "@/lib/surfaces";
import { useStore } from "@/lib/store";
import type { MemberId } from "@/lib/types";
import { AlexaWatch } from "./AlexaWatch";
import { BottomNav } from "./BottomNav";
import { CaregiverDoorAssist } from "./CaregiverDoorAssist";
import { DoorWatch } from "./DoorWatch";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, setCurrentUser } = useStore();

  const onDuty = memberById(state, currentOnDuty(state));
  const backup = memberById(state, currentBackup(state));
  const isHome = pathname === "/today";
  const isReceiver = isCareReceiverPath(pathname);
  const isDoorbell = isDoorbellPath(pathname);
  const isTv = isTvPath(pathname);
  const isCam = pathname.startsWith("/cam");
  const isChooser = pathname === "/enter";

  if (pathname === "/" || pathname === "/welcome") {
    return <>{children}</>;
  }

  if (pathname === "/setup" || pathname === "/escalation" || pathname === "/assignments" || pathname.startsWith("/alerts/")) {
    return <><DoorWatch /><AlexaWatch />{children}</>;
  }

  if (pathname === "/recipient" || pathname === "/doorsense") {
    return <><AlexaWatch />{children}</>;
  }

  // Full-bleed living-room overlay — no caregiver chrome / bottom nav
  if (isTv) {
    return <div className="min-h-screen bg-black">{children}</div>;
  }

  // Caregiver home owns its own light chrome; shelf stays via BottomNav
  if (isHome) {
    return (
      <div className="min-h-screen bg-[#c5d2c8]">
        <DoorWatch />
        <AlexaWatch />
        <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#E9EEE5]">
          {children}
        </div>
        <BottomNav />
      </div>
    );
  }

  if (isChooser) {
    return (
      <div className="min-h-screen shell-caregiver">
        {/* Alerts + live assist if Mom escalates while you're on the chooser */}
        <DoorWatch />
        <AlexaWatch />
        <div className="mx-auto max-w-[430px] px-4 pt-4">
          <CaregiverDoorAssist />
        </div>
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        isDoorbell
          ? "shell-caregiver"
          : isReceiver
            ? "shell-receiver"
            : "shell-caregiver"
      }`}
    >
      {!isReceiver && !isDoorbell && (
        <>
          <DoorWatch />
          <AlexaWatch />
        </>
      )}
      {isReceiver && <AlexaWatch />}
      <div
        className={`mx-auto px-4 pt-4 ${
          isReceiver || isCam || isDoorbell
            ? "max-w-3xl pb-28 md:pb-32"
            : "max-w-[430px] md:max-w-3xl pb-28"
        }`}
      >
        {!isReceiver && !isCam && !isDoorbell && (
          <div className="mb-4">
            <CaregiverDoorAssist />
          </div>
        )}
        {!isCam && !isDoorbell && (
          <div
            className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] px-3.5 py-3 border backdrop-blur-md ${
              isReceiver
                ? "bg-[#143528]/85 text-white border-white/15"
                : "bg-black/45 text-white border-white/12"
            }`}
          >
            <div>
              <p className="eyebrow opacity-90">
                {isReceiver ? "Care receiver" : "Caregiver"}
              </p>
              <p className="text-sm font-semibold mt-1 tracking-tight">
                {isReceiver
                  ? `${state.careRecipientName} · tablet cards`
                  : `Caring for ${state.careRecipientName}`}
              </p>
            </div>
            <Link
              href={isReceiver ? "/today" : "/recipient"}
              className={`text-xs font-semibold rounded-full px-3.5 py-2 transition ${
                isReceiver
                  ? "bg-white text-[#143528]"
                  : "bg-[var(--accent-brand)] text-[#06210c]"
              }`}
            >
              {isReceiver ? "Caregiver →" : "Mom’s tablet →"}
            </Link>
          </div>
        )}

        {isDoorbell && (
          <div className="mb-5 rounded-[1.25rem] px-3.5 py-3 bg-[#2a2014]/90 text-white border border-[var(--accent-warn)]/35">
            <p className="eyebrow opacity-90">Doorbell device</p>
            <p className="text-sm font-semibold mt-1">
              Audio only · visitor hears caregiver here
            </p>
          </div>
        )}

        <header className="flex items-start justify-between gap-3 mb-7">
          <div className="min-w-0">
            <h1 className="display text-[2.1rem] sm:text-[2.35rem] text-white">
              {isCam
                ? "Phone cam"
                : isDoorbell
                  ? "Doorbell"
                  : isReceiver
                    ? titleReceiver(pathname)
                    : isHome
                      ? "Today"
                      : titleCaregiver(pathname)}
            </h1>
            <p className="mt-2 text-sm text-white/60 leading-snug max-w-xl">
              {isCam
                ? "Stand-in door camera (not Ring)"
                : isDoorbell
                  ? "Separate browser · caregiver voice to the door"
                  : isReceiver
                    ? "Large cards · check-in · DoorSense"
                    : isHome
                      ? `On duty ${onDuty?.name}${state.dutyOverrideId ? " (override)" : ""} · backup ${backup?.name}`
                      : "Alerts, rota, and follow-through"}
            </p>
          </div>
          {!isCam && !isReceiver && !isDoorbell && (
            <div className="glass-strong flex items-center gap-0.5 rounded-full px-1.5 py-1 shrink-0">
              <Link
                href="/demo"
                className="size-8 grid place-items-center rounded-full text-white/90 hover:bg-white/10 text-sm"
                title="Hackathon demo injector"
              >
                ✦
              </Link>
              <select
                aria-label="Viewing as caregiver"
                className="h-8 max-w-[5.5rem] rounded-full bg-transparent pr-1 text-xs text-white/90 outline-none"
                value={
                  state.currentUserId === "mom" ? "alex" : state.currentUserId
                }
                onChange={(e) =>
                  setCurrentUser(e.target.value as MemberId)
                }
              >
                {state.members
                  .filter((m) => m.role !== "person_at_home")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </header>

        <main>{children}</main>
      </div>

      {!isCam && !isDoorbell && <BottomNav />}
    </div>
  );
}

function titleReceiver(pathname: string): string {
  if (pathname.startsWith("/doorsense")) return "DoorSense";
  return "My day";
}

function titleCaregiver(pathname: string): string {
  if (pathname.startsWith("/escalation") || pathname.startsWith("/alerts"))
    return "Alerts";
  if (pathname.startsWith("/assignments")) return "Family";
  if (pathname.startsWith("/setup")) return "You";
  if (pathname.startsWith("/demo")) return "Demo";
  if (pathname.startsWith("/summary")) return "Care summary";
  return "CareSignal";
}
