"use client";

import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Account sign-in is not configured. Contact the CareSignal administrator.");
  return createBrowserClient(url, key);
}

export function accountCallback(recovery = false) {
  return `${window.location.origin}/auth/callback${recovery ? "?next=recovery" : ""}`;
}
