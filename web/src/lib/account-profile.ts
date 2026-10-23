"use client";

import { supabaseBrowser } from "./supabase-browser";

export function accountProfileName(metadata: Record<string, unknown>) {
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const fullName = text(metadata.full_name) || text(metadata.name);
  const preferredName = text(metadata.given_name) || fullName.split(/\s+/)[0];
  return { fullName, preferredName };
}

export async function signedInAccountName() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  const client = supabaseBrowser();
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session.session) return null;
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user ? accountProfileName(data.user.user_metadata) : null;
}
