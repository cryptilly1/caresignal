/**
 * Escalation agent — deterministic workflow copy + timing.
 * No LLM. Clarifies who must act and what “accept” means.
 */

import {
  currentBackup,
  currentOnDuty,
  memberById,
  now,
} from "@/lib/engine";
import type { Alert, AlertStatus, HouseholdState } from "@/lib/types";

export function alertStatusLabel(status: AlertStatus): string {
  switch (status) {
    case "open":
      return "Needs accept";
    case "acknowledged":
      return "On it";
    case "escalated":
      return "Escalated to backup";
    case "resolved_fine":
      return "Resolved · fine";
    case "resolved_helped":
      return "Resolved · helped";
    case "cleared":
      return "Cleared";
  }
}

export function minutesUntilEscalate(
  state: HouseholdState,
  alert: Alert,
): number | null {
  if (alert.status !== "open") return null;
  const elapsed =
    now(state).getTime() - new Date(alert.createdAt).getTime();
  const windowMs = state.pact.escalationMinutes * 60_000;
  const left = Math.ceil((windowMs - elapsed) / 60_000);
  return Math.max(0, left);
}

/** One-line next step for caregivers. */
export function escalationNextStep(
  state: HouseholdState,
  alert: Alert,
): string {
  const onDuty = memberById(state, alert.onDutyId)?.name ?? "On-duty";
  const backup = memberById(state, alert.backupId)?.name ?? "Backup";
  const owner = memberById(state, alert.ownerId)?.name ?? "Owner";

  if (alert.status === "open") {
    const mins = minutesUntilEscalate(state, alert);
    if (mins === 0) {
      return `${onDuty} must tap I’m on it now — or ${backup} takes over.`;
    }
    return `${onDuty} must accept (“I’m on it”). Escalates to ${backup} in ~${mins} min if ignored.`;
  }
  if (alert.status === "acknowledged") {
    return `${owner} accepted — work the playbook, assign family, or resolve with a note.`;
  }
  if (alert.status === "escalated") {
    return `${onDuty} didn’t accept in time. ${backup} owns this — accept and follow the playbook.`;
  }
  return alert.status === "cleared" ? "Cleared from the open list. Retained in care history." : `Closed · ${owner} resolved.`;
}

export function escalationInboxBlurb(state: HouseholdState): string {
  const onDuty = memberById(state, currentOnDuty(state))?.name ?? "On-duty";
  const backup = memberById(state, currentBackup(state))?.name ?? "Backup";
  const mins = state.pact.escalationMinutes;
  return `Rule: ${onDuty} accepts each alert. If they don’t within ${mins} min, ownership moves to ${backup}. No AI — timer + duty rota only.`;
}
