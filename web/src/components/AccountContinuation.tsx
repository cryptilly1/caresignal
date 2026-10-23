"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accountDestination, completedAccountRole } from "@/lib/account-navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function AccountContinuation() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function continueToApp() {
      try {
        const client = supabaseBrowser();
        const { data, error: cause } = await client.auth.getUser();
        if (!active) return;
        if (cause || !data.user) throw cause ?? new Error("Your sign-in session is missing. Please sign in again.");
        const role = completedAccountRole(data.user, window.localStorage);
        const destination = accountDestination(data.user, new URLSearchParams(window.location.search).get("intent"), role);
        if (destination === "/onboarding" && data.user.user_metadata.caresignal_onboarding_completed !== false) {
          const { error: updateError } = await client.auth.updateUser({
            data: { caresignal_onboarding_completed: false },
          });
          if (updateError) throw updateError;
        }
        if (active) router.replace(destination);
      } catch (cause) {
        console.error("Unable to continue account sign-in", cause);
        if (active) setError(cause instanceof Error ? cause.message : "Your account could not be opened. Please try signing in again.");
      }
    }
    void continueToApp();
    return () => { active = false; };
  }, [router]);
  return <main className="onboarding-screen care-home account-screen">
    <section className="care-card" style={{ margin: "80px auto", maxWidth: 480, padding: 28 }}>
      <h1>{error ? "We couldn't open your account" : "Opening your CareSignal app..."}</h1>
      {error ? <><p className="settings-error" role="alert">{error}</p><Link className="cs-button cs-button--primary" href="/account">Open account</Link></> : <p role="status">Checking your saved setup. You won&apos;t need to repeat completed onboarding.</p>}
    </section>
  </main>;
}
