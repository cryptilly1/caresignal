"use client";

import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function CareHomeHeader({ initials, onAccount, accountIcon = false, centered = false, back }: {
  initials: string; onAccount?: () => void; accountIcon?: boolean; centered?: boolean; back?: { href: string; label: string };
}) {
  return (
    <header className={`onboarding-role-header care-home__header${centered ? " care-home__header--centered" : ""}`}>
      {back && <Link className="welcome-screen__help care-home__back" href={back.href} aria-label={`Back to ${back.label}`}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>}
      <Link className="onboarding-wordmark" href="/" aria-label="CareSignal welcome"><BrandMark /><span>CareSignal</span></Link>
      {onAccount
        ? <button className="welcome-screen__help care-home__account" onClick={onAccount} type="button" aria-label={accountIcon ? "Open account information" : "Open profile and home preview options"}>{accountIcon ? <Image alt="" src="/images/caregiver-home/circle.svg" width={22} height={22} /> : initials}</button>
        : <Link className="welcome-screen__help care-home__account" href="/onboarding?step=1" aria-label="Edit your care profile">{initials}</Link>}
    </header>
  );
}

export function CareHomeFooter({ onAlerts, active = "home" }: { onAlerts?: () => void; active?: "home" | "settings" | "alerts" | "circle" }) {
  return (
    <footer className="care-home__footer">
      <nav aria-label="CareSignal navigation" className="care-home__nav">
        <Link aria-current={active === "home" ? "page" : undefined} href="/care-circle?view=activity"><Image alt="" src="/images/care-circle/home.svg" height={25} width={26} /><span>Home</span></Link>
        {onAlerts
          ? <button onClick={onAlerts} type="button"><Image alt="" src="/images/care-circle/alerts.svg" height={27} width={27} /><span>Alerts</span></button>
          : <Link aria-current={active === "alerts" ? "page" : undefined} href="/escalation"><Image alt="" src="/images/care-circle/alerts.svg" height={27} width={27} /><span>Alerts</span></Link>}
        <Link aria-current={active === "circle" ? "page" : undefined} href="/assignments"><Image alt="" src="/images/care-circle/care-circle.svg" height={24} width={20} /><span>Care circle</span></Link>
        <Link aria-current={active === "settings" ? "page" : undefined} href="/setup"><Image alt="" src="/images/care-circle/settings.svg" height={24} width={23} /><span>Settings</span></Link>
      </nav>
      <div className="onboarding-home-indicator" aria-hidden="true" />
    </footer>
  );
}
