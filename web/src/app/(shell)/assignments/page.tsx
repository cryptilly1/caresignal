import { Suspense } from "react";
import { CareCircleTasks } from "@/components/CareCircleTasks";

export default function AssignmentsPage() {
  return <Suspense fallback={<main aria-busy="true" aria-label="Loading Care circle" className="onboarding-screen care-home" />}><CareCircleTasks /></Suspense>;
}
