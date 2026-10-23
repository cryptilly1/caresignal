import type { User } from "@supabase/supabase-js";

export type AccountRole = "caregiver" | "receiver";
export const CAREGIVER_HOME = "/care-circle?view=activity";
export const accountSetupKey = (userId: string) => `caresignal-account-setup-v1:${userId}`;

export function completedAccountRole(user: User, storage?: Pick<Storage, "getItem">): AccountRole | null {
  const role = user.user_metadata.caresignal_role;
  if (user.user_metadata.caresignal_onboarding_completed === true && (role === "caregiver" || role === "receiver")) return role;
  if (!storage) return null;
  const saved = storage.getItem(accountSetupKey(user.id));
  if (!saved) return null;
  const value: unknown = JSON.parse(saved);
  if (value !== "caregiver" && value !== "receiver") throw new Error("Your saved account role is invalid. Please open Account settings to complete setup again.");
  return value;
}

export function accountDestination(user: User, intent: string | null, role: AccountRole | null): string {
  if (role === "receiver") return "/onboarding/my-day";
  if (role === "caregiver") return CAREGIVER_HOME;
  if (user.user_metadata.caresignal_onboarding_completed === false) return "/onboarding";
  if (intent === "signup") return "/onboarding";
  if (intent === "google" || (!intent && user.app_metadata.provider === "google")) {
    const created = Date.parse(user.created_at);
    const signedIn = Date.parse(user.last_sign_in_at ?? "");
    if (Number.isFinite(created) && Number.isFinite(signedIn) && signedIn >= created && signedIn - created < 60_000) return "/onboarding";
  }
  return CAREGIVER_HOME;
}
