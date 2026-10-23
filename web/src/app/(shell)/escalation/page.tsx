import { Suspense } from "react";
import { CareAlerts } from "@/components/CareAlerts";

export default function EscalationPage() {
  return <Suspense fallback={<main aria-busy="true" aria-label="Loading alerts" className="onboarding-screen care-home" />}><CareAlerts /></Suspense>;
}
