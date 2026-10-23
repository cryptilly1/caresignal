"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Check, LogOut, ShieldCheck } from "lucide-react";
import { CareHomeHeader } from "./CareHomeChrome";
import { inter, jakarta } from "./OnboardingFlow";
import { accountCallback, supabaseBrowser } from "@/lib/supabase-browser";

export function AccountScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    async function load() {
      try {
        const query = new URLSearchParams(window.location.search);
        if (query.get("auth") === "failed") setError("Sign-in could not be completed. The link may have expired. Please try again in the browser where you started.");
        setRecovery(query.get("password") === "update");
        const client = supabaseBrowser();
        const { data, error: cause } = await client.auth.getUser();
        if (!active) return;
        if (cause && cause.name !== "AuthSessionMissingError") throw cause;
        setUser(data.user);
        const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
          if (active) setUser(session?.user ?? null);
        });
        unsubscribe = () => listener.subscription.unsubscribe();
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Your account could not be loaded.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; unsubscribe?.(); };
  }, []);

  async function action(run: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await run(); } catch (cause) { setError(cause instanceof Error ? cause.message : "The account action failed. Try again."); }
    finally { setBusy(false); }
  }

  return <main className={`onboarding-screen care-home caregiver-home settings-screen account-screen ${inter.variable} ${jakarta.variable}`}>
    <CareHomeHeader centered back={{ href: "/", label: "welcome" }} initials={user?.email?.slice(0, 2).toUpperCase() ?? "CS"} />
    <div className="onboarding-body account-screen__body" aria-busy={loading || busy}>
      <header className="receiver-setup-day__greeting"><h1>{loading ? "Checking your account" : user ? "You’re signed in." : "Your CareSignal account"}</h1></header>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {message && <p className="settings-notice" role="status">{message}</p>}
      {!loading && <section className="care-card">
        {user ? <>
          <span className="receiver-setup-day__icon"><Check size={24} aria-hidden="true" /></span><h2>{user.email ?? "Your account"}</h2>
          <p className="care-body-copy">Your login is connected. Household invitations and caregiver/receiver permissions are not connected to this account yet.</p>
          {recovery && <form className="settings-form" onSubmit={(event) => {
            event.preventDefault();
            void action(async () => {
              const { error: cause } = await supabaseBrowser().auth.updateUser({ password });
              if (cause) throw cause;
              setPassword(""); setRecovery(false); window.history.replaceState(null, "", "/account"); setMessage("Password updated.");
            });
          }}><label className="onboarding-field">New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="cs-button cs-button--primary" disabled={busy}>Save new password</button></form>}
          <Link className="cs-button cs-button--primary" href="/onboarding">Continue to setup preview</Link>
          <button className="cs-button cs-button--glass" type="button" disabled={busy} onClick={() => void action(async () => {
            const { error: cause } = await supabaseBrowser().auth.signOut({ scope: "local" });
            if (cause) throw cause;
            setUser(null); setRecovery(false); setMessage("Signed out on this device.");
          })}><LogOut size={20} aria-hidden="true" />Sign out</button>
        </> : <>
          <h2>Sign in to get started</h2><p className="care-body-copy">Use email and password or an enabled sign-in provider.</p>
          <Link className="cs-button cs-button--primary" href="/welcome?signin=1">Sign in</Link>
          <form className="settings-form" onSubmit={(event) => {
            event.preventDefault();
            const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
            void action(async () => {
              const { error: cause } = await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: accountCallback(true) });
              if (cause) throw cause;
              setMessage("If an account exists for that email, you’ll receive a password reset link. Open it in this browser.");
            });
          }}><label className="onboarding-field">Forgot your password?<input name="email" type="email" autoComplete="email" required placeholder="Your email address" /></label><button className="cs-button cs-button--glass" disabled={busy}>Send reset link</button></form>
        </>}
      </section>}
      <p className="receiver-setup-day__preview-note"><ShieldCheck aria-hidden="true" size={18} />Household access remains separately protected.</p>
    </div>
  </main>;
}
