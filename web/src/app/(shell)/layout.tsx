import { Providers } from "@/components/Providers";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No Suspense fallback here — a full-screen fallback was flashing as a "refresh"
  // whenever the App Router remounted during Turbopack HMR.
  return <Providers>{children}</Providers>;
}
