"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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
      <main className="grid min-h-screen place-items-center bg-[#10251d] text-white">
        <p className="text-sm text-white/65">Connecting to CareSignal…</p>
      </main>
    );
  }

  if (status.authenticated || (!status.required && status.configured)) {
    return children;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#10251d] px-5 py-10 text-white">
      <section className="w-full max-w-sm rounded-[1.75rem] border border-white/15 bg-white/[0.08] p-7 shadow-2xl backdrop-blur-xl">
        <p className="eyebrow text-[var(--accent-brand)]">CareSignal</p>
        <h1 className="display mt-3 text-4xl">Caregiver access</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          Enter the shared caregiver password to open this household.
        </p>
        {!status.configured ? (
          <p role="alert" className="mt-6 rounded-xl bg-[#f4c46a]/10 p-4 text-sm text-[#f4c46a]">
            {status.error ?? "Caregiver access has not been configured."}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium" htmlFor="caregiver-password">
              Password
            </label>
            <input
              id="caregiver-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none focus:border-[var(--accent-brand)]"
            />
            {error && (
              <p role="alert" className="text-sm text-[#f4c46a]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[var(--accent-brand)] px-4 py-3 font-semibold text-[#10251d] disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Continue"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
