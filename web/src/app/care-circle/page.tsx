import { CareCircleHome } from "@/components/CareCircleHome";
import { Suspense } from "react";
import { StoreProvider } from "@/lib/store";

export default function CareCirclePage() {
  return <StoreProvider><Suspense fallback={<main aria-busy="true" aria-label="Loading your care circle" className="onboarding-screen care-home" />}><CareCircleHome /></Suspense></StoreProvider>;
}
