import { Suspense } from "react";
import { SettingsScreens } from "@/components/SettingsScreens";

export default function SetupPage() {
  return <Suspense fallback={<main aria-busy="true" aria-label="Loading settings" className="onboarding-screen care-home" />}><SettingsScreens /></Suspense>;
}
