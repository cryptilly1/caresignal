import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import { AppViewport } from "@/components/AppViewport";
import "./globals.css";
import "./product.css";

export const metadata: Metadata = {
  title: "CareSignal — Ring care with DoorSense",
  description:
    "Ring events + check-ins become owned care actions with escalation. DoorSense makes the doorbell accessible.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">
        <AppViewport><AuthGate>{children}</AuthGate></AppViewport>
      </body>
    </html>
  );
}
