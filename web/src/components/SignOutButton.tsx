"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: cause } = await supabaseBrowser().auth.signOut({ scope: "local" });
      if (cause) throw cause;
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Your account was signed out, but shared caregiver access could not be closed. Please try again.");
      window.location.replace("/welcome");
    } catch (cause) {
      console.error("Unable to complete sign-out", cause);
      setError(cause instanceof Error ? cause.message : "Sign-out could not be completed. Please try again.");
      setBusy(false);
    }
  }

  return <div className="settings-form">
    <button className="cs-button cs-button--glass" disabled={busy} onClick={() => void signOut()} type="button">
      <LogOut aria-hidden="true" size={20} />{busy ? "Signing out..." : "Sign out"}
    </button>
    {error && <p className="settings-error" role="alert">{error}</p>}
  </div>;
}
