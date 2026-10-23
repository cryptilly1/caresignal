/**
 * Care Summary agent — template day digest (no Bedrock required).
 * Rules over Ring + Mom cards + alerts.
 */

import {
  breakActive,
  checkedInToday,
  currentBackup,
  currentOnDuty,
  feelingLabel,
  latestFeeling,
  memberById,
  now,
  openAlerts,
  todayKey,
  visitWindowHint,
  visitorOccursOn,
  walkedToday,
} from "@/lib/engine";
import type { HouseholdState } from "@/lib/types";
import { buildHomeContext } from "./home-context";
import { buildMedicationBrief } from "./medication";

export type CareSummary = {
  headline: string;
  dateKey: string;
  bullets: string[];
  paragraphs: string[];
  openAlertCount: number;
};

export function buildCareSummary(state: HouseholdState): CareSummary {
  const key = todayKey(state);
  const onDutyName = memberById(state, currentOnDuty(state))?.name ?? "On-duty";
  const backupName = memberById(state, currentBackup(state))?.name ?? "Backup";
  const medBrief = buildMedicationBrief(state);
  const feeling = latestFeeling(state);
  const coming = state.visitors.find((v) => v.oneOffDay === key) ?? state.visitors.find((v) => visitorOccursOn(v, now(state)));
  const alerts = openAlerts(state);
  const walkMins = (state.walkLogs ?? [])
    .filter((w) => w.at.slice(0, 10) === key)
    .reduce((n, w) => n + w.minutes, 0);
  const ringToday = state.ringEvents.filter((e) => e.at.slice(0, 10) === key);
  const ringAlerts = ringToday.filter((e) => e.matched === "alert").length;
  const context = buildHomeContext(state, 8);

  const bullets: string[] = [];
  bullets.push(
    checkedInToday(state)
      ? "Mom checked in (I’m okay)."
      : "No I’m-okay check-in yet today.",
  );
  bullets.push(
    feeling
      ? `Feeling: ${feelingLabel(feeling.level)}.`
      : "Feeling not shared yet.",
  );
  bullets.push(
    medBrief.totalCount === 0
      ? "No medicines scheduled."
      : medBrief.overdueCount > 0
        ? `Medicine ${medBrief.takenCount}/${medBrief.totalCount} · ${medBrief.overdueCount} overdue.`
        : `Medicine ${medBrief.takenCount}/${medBrief.totalCount} taken.`,
  );
  bullets.push(
    walkedToday(state)
      ? `Walk logged · ${walkMins} min.`
      : "No walk logged yet.",
  );
  if (coming) {
    bullets.push(
      `Mom expects ${coming.label} (~${coming.startHour}:00–${coming.endHour}:00).`,
    );
  } else {
    bullets.push(visitWindowHint(state));
  }
  if (breakActive(state)) {
    bullets.push("Mom asked for a break — quiet-miss paused.");
  }
  bullets.push(
    ringToday.length === 0
      ? "No Ring events ingested today."
      : `Ring today: ${ringToday.length} event${ringToday.length === 1 ? "" : "s"}${
          ringAlerts ? ` · ${ringAlerts} unusual` : ""
        }.`,
  );
  bullets.push(
    alerts.length === 0
      ? "No open care alerts."
      : `${alerts.length} open alert${alerts.length === 1 ? "" : "s"} still need follow-through.`,
  );

  const paragraphs = [
    `On duty ${onDutyName} · backup ${backupName}. CareSignal turns Ring + Mom’s cards into owned actions — this digest is a rules template, not a model diagnosis.`,
    context.length > 0
      ? `Latest: ${context
          .slice(0, 3)
          .map((l) => l.text)
          .join(" · ")}`
      : "Home context is quiet so far today.",
  ];

  const headline =
    alerts.length > 0
      ? `${alerts.length} open · needs a caregiver`
      : checkedInToday(state) && ringAlerts === 0
        ? "Quiet day so far"
        : "Day in progress";

  return {
    headline,
    dateKey: key,
    bullets,
    paragraphs,
    openAlertCount: alerts.length,
  };
}
