import type { ReactNode } from "react";

/** Standalone — no StoreProvider / AppShell / Suspense (avoids HMR remount loops). */
export default function AlexaLayout({ children }: { children: ReactNode }) {
  return <div className="shell-caregiver min-h-screen">{children}</div>;
}
