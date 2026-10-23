import { CareCircleHome } from "@/components/CareCircleHome";
import { Suspense } from "react";

export default function CareCirclePage() {
  return <Suspense fallback={<main aria-busy="true" aria-label="Loading your care circle" className="onboarding-screen care-home" />}><CareCircleHome /></Suspense>;
}
