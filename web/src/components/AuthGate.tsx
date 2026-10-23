"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { inter, jakarta } from "./OnboardingFlow";

type AuthStatus = {
  authenticated: boolean;
  configured: boolean;
  required: boolean;
  error?: string;
};

async function fetchStatus(): Promise<AuthStatus> {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    return (await response.json()) as AuthStatus;
  } catch {
    return {
      authenticated: false,
      configured: false,
      required: true,
      error: "Could not reach the CareSignal server.",
    };
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refreshStatus() {
    setStatus(await fetchStatus());
  }

  useEffect(() => {
    let active = true;
    void fetchStatus().then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, []);

  if (pathname === "/" || pathname === "/welcome" || pathname === "/account" || pathname.startsWith("/auth/") || pathname.startsWith("/onboarding") || pathname === "/care-circle") {
    return children;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Could not sign in.");
        return;
      }
      setPassword("");
      await refreshStatus();
    } catch {
      setError("Could not reach the CareSignal server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) {
    return (
      <main className={`access-screen ${inter.variable} ${jakarta.variable}`}>
        <div className="access-loading" role="status"><BrandMark /><p>Opening your care circle...</p></div>
      </main>
    );
  }

  if (status.authenticated || (!status.required && status.configured)) {
    return children;
  }

  return (
    <main className={`access-screen ${inter.variable} ${jakarta.variable}`}>
      <section className="access-card" aria-labelledby="access-heading">
        <Link href="/" className="access-brand"><BrandMark /><span>CareSignal</span></Link>
        <span className="access-icon" aria-hidden="true"><LockKeyhole size={26} /></span>
        <div className="access-heading"><p className="access-eyebrow">A little closer. Even from afar.</p><h1 id="access-heading">Find your way in.</h1><p>Explore the demo or sign in to your account. Your care circle starts here.</p></div>
        <div className="access-actions">
          <Link className="cs-button cs-button--primary" href="/care-circle?view=activity&demo=1">Continue with demo <ArrowUpRight size={18} /></Link>
          <Link className="cs-button cs-button--glass" href="/welcome">Sign in to your account</Link>
        </div>
        {status.error && <p className="access-error" role="alert">We couldn&apos;t open this household. Please try again later.</p>}
        {status.configured && <details className="access-operator">
          <summary>Live household access</summary>
          <form onSubmit={submit} className="access-form">
            <label className="onboarding-field" htmlFor="caregiver-password"><span>Household password</span>
            <input
              id="caregiver-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            </label>
            {error && (
              <p role="alert" className="access-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="cs-button cs-button--primary"
            >
              {submitting ? "Opening..." : "Open live household"}
            </button>
          </form>
        </details>}
      </section>
    </main>
  );
}
