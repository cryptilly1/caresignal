"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { BottomDrawer } from "./BottomDrawer";
import { accountCallback, supabaseBrowser } from "@/lib/supabase-browser";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-welcome-inter",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-welcome-jakarta",
});

export function WelcomeScreen() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const [showEmailSheet, setShowEmailSheet] = useState(false);
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("signin") === "1") setShowEmailSheet(true);
  }, []);

  async function provider(provider: "google" | "github") {
    if (busy) return;
    setBusy(true); setNotice(""); setAuthError("");
    try {
      const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
      });
      if (!settings.ok) throw new Error("Sign-in providers could not be loaded. Please try again.");
      const config = await settings.json() as { external?: Record<string, boolean> };
      if (!config.external?.[provider]) throw new Error(`${provider === "github" ? "GitHub" : "Google"} sign-in is not enabled in Supabase yet.`);
      const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider, options: { redirectTo: accountCallback() } });
      if (error) throw error;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Provider sign-in could not start.");
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    setBusy(true); setNotice(""); setAuthError("");
    try {
      const client = supabaseBrowser();
      const { data, error } = mode === "signup"
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: accountCallback() } })
        : await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) router.push("/account");
      else {
        form.reset();
        setNotice("Check your email to confirm your account. If you already have an account, sign in instead. Open the confirmation link in this browser.");
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign-in could not be completed.");
    } finally { setBusy(false); }
  }

  return (
    <main className={`welcome-screen ${inter.variable} ${jakarta.variable}`}>
      <div className="welcome-screen__content">
        <div className="welcome-screen__status" aria-label="Device status">
          <span>9:41</span>
          <Image
            src="/images/welcome/device-status.svg"
            width={74}
            height={14}
            alt="Cellular, Wi-Fi, and battery status"
            priority
          />
        </div>

        <header className="welcome-screen__navigation">
          <Link
            href="/"
            className="welcome-screen__brand"
            aria-label="CareSignal home"
          >
            <span className="welcome-screen__brand-mark">
              <Image
                src="/images/welcome/heart-pulse.svg"
                width={22}
                height={19}
                alt=""
              />
            </span>
            <span>CareSignal</span>
          </Link>
          <button
            className="welcome-screen__help"
            type="button"
            aria-label={showHelp ? "Close CareSignal information" : "About CareSignal"}
            aria-expanded={showHelp}
            onClick={() => setShowHelp((open) => !open)}
          >
            <span aria-hidden="true">?</span>
          </button>
          {showHelp && (
            <p className="welcome-screen__help-popover" role="status">
              A simple demo for family check-ins, care updates, and accessible
              door alerts.
            </p>
          )}
        </header>

        <section className="welcome-screen__heading">
          <h1>Welcome to CareSignal</h1>
          <p>
            A calmer way to share care, check
            <br className="welcome-screen__desktop-break" /> in and feel
            connected at home.
          </p>
        </section>
      </div>

      <footer className="welcome-screen__actions">
        <button
          className="cs-button cs-button--glass"
          type="button"
          disabled={busy}
          onClick={() => void provider("google")}
        >
          Continue with Google
        </button>
        <button
          className="cs-button cs-button--primary"
          type="button"
          onClick={() => {
            setNotice("");
            setAuthError("");
            setMode("signin");
            setShowEmailSheet(true);
          }}
        >
          Continue with Email
        </button>
        <p className="welcome-screen__signup">
          Don’t have an account?{" "}
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setAuthError("");
              setMode("signup");
              setShowEmailSheet(true);
            }}
          >
            Sign Up
          </button>
        </p>
        <Link className="welcome-screen__demo" href="/care-circle?view=activity&demo=1">Continue with demo <span aria-hidden="true">→</span></Link>
        <p className="welcome-screen__legal">
          I have read and agree with the <span>terms</span> and{" "}
          <span>privacy policy.</span>
        </p>
        <div className="welcome-screen__home-indicator" aria-hidden="true" />
      </footer>

      {notice && (
        <p className="welcome-screen__notice" role="status">
          {notice}
        </p>
      )}
      {authError && !showEmailSheet && <p className="welcome-screen__notice" role="alert">{authError}</p>}

      {showEmailSheet && (
        <BottomDrawer title={mode === "signup" ? "Create your account" : "Welcome back"} onClose={() => setShowEmailSheet(false)}>
            {notice && (
              <p className="account-sheet__notice" role="status">
                {notice}
              </p>
            )}

            {authError && <p className="account-sheet__notice" role="alert">{authError}</p>}
            <form
              className="account-sheet__form"
              onSubmit={(event) => void submit(event)}
            >
              <label htmlFor="account-email">Email</label>
              <input
                autoComplete="email"
                id="account-email"
                name="email"
                placeholder="jamie@example.com"
                required
                type="email"
              />
              <label htmlFor="account-password">Password</label>
              <input
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                id="account-password"
                name="password"
                placeholder={mode === "signup" ? "Create a password" : "Your password"}
                minLength={mode === "signup" ? 8 : 1}
                maxLength={128}
                required
                type="password"
              />

              <p className="account-sheet__or">Or with</p>
              <div className="account-sheet__providers" aria-label="Other sign-up options">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void provider("google")}
                >
                  <span className="account-sheet__provider-icon account-sheet__provider-icon--google">
                    G
                  </span>
                  Google
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void provider("github")}
                >
                  GitHub
                </button>
              </div>

              <p className="account-sheet__terms">
                By continuing, I agree to the terms and conditions.
              </p>
              <button
                className="cs-button cs-button--primary account-sheet__submit"
                type="submit"
                disabled={busy}
              >
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
              </button>
              <button className="care-text-button" type="button" disabled={busy} onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setAuthError(""); setNotice(""); }}>{mode === "signup" ? "Already have an account? Sign in" : "New to CareSignal? Create an account"}</button>
              {mode === "signin" && <Link className="care-text-button" href="/account">Forgot your password?</Link>}
            </form>
        </BottomDrawer>
      )}
    </main>
  );
}
