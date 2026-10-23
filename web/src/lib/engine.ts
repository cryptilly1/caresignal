import type {
  Alert,
  AlertType,
  DutyDay,
  ExpectedVisitor,
  FeelingLevel,
  FeelingLog,
  HouseholdState,
  Member,
  MemberId,
  RingEvent,
} from "./types";

export function now(state: HouseholdState): Date {
  return state.demoNow ? new Date(state.demoNow) : new Date();
}

export function todayKey(state: HouseholdState): string {
  return now(state).toISOString().slice(0, 10);
}

export function memberById(
  state: HouseholdState,
  id: MemberId,
): Member | undefined {
  return state.members.find((m) => m.id === id);
}

export function dutyForDate(
  state: HouseholdState,
  date = todayKey(state),
): DutyDay {
  const row = state.duty.find((d) => d.date === date);
  if (row) return row;
  return {
    date,
    onDutyId: "alex",
    backupId: "sam",
  };
}

export function currentOnDuty(state: HouseholdState): MemberId {
  if (state.dutyOverrideId) return state.dutyOverrideId;
  return dutyForDate(state).onDutyId;
}

export function currentBackup(state: HouseholdState): MemberId {
  return dutyForDate(state).backupId;
}

export function isNightHour(state: HouseholdState, at = now(state)): boolean {
  const h = at.getHours();
  const { nightStartHour, nightEndHour } = state.pact;
  if (nightStartHour > nightEndHour) {
    return h >= nightStartHour || h < nightEndHour;
  }
  return h >= nightStartHour && h < nightEndHour;
}

export function isRestWindow(state: HouseholdState, at = now(state)): boolean {
  if (!state.pact.restWindowEnabled) return false;
  const h = at.getHours();
  return h >= state.pact.restStartHour && h < state.pact.restEndHour;
}

export function isAway(state: HouseholdState): boolean {
  if (state.optOutToday) return true;
  if (!state.awayUntil) return false;
  return now(state).getTime() < new Date(state.awayUntil).getTime();
}

export function checkedInToday(state: HouseholdState): boolean {
  const key = todayKey(state);
  return state.checkIns.some((c) => c.at.slice(0, 10) === key);
}

export function doorSignOfLifeToday(state: HouseholdState): boolean {
  if (!state.pact.doorActivityCountsAsSignOfLife) return false;
  const key = todayKey(state);
  return state.ringEvents.some(
    (e) =>
      e.at.slice(0, 10) === key &&
      (e.matched === "expected" || e.matched === "ignore"),
  );
}

export function medicineTakenToday(state: HouseholdState): boolean {
  const key = todayKey(state);
  return (state.medicineLogs ?? []).some((l) => l.at.slice(0, 10) === key);
}

export function walkedToday(state: HouseholdState): boolean {
  const key = todayKey(state);
  return (state.walkLogs ?? []).some((l) => l.at.slice(0, 10) === key);
}

export function hasSignOfLife(state: HouseholdState): boolean {
  if (checkedInToday(state)) return true;
  if (medicineTakenToday(state) || walkedToday(state)) return true;
  if (state.pact.requireImOkay) return false;
  return doorSignOfLifeToday(state);
}

export function medsDueToday(state: HouseholdState) {
  const key = todayKey(state);
  const logs = state.medicineLogs ?? [];
  return (state.medicines ?? []).flatMap((med) =>
    med.times.map((timeSlot) => {
      const taken = logs.some(
        (l) =>
          l.medicineId === med.id &&
          l.timeSlot === timeSlot &&
          l.at.slice(0, 10) === key,
      );
      return { med, timeSlot, taken };
    }),
  );
}

export function pastQuietBy(state: HouseholdState): boolean {
  const t = now(state);
  const quiet = new Date(t);
  quiet.setHours(state.pact.quietByHour, state.pact.quietByMinute, 0, 0);
  return t.getTime() >= quiet.getTime();
}

export function openAlerts(state: HouseholdState): Alert[] {
  return state.alerts.filter(
    (a) =>
      a.status === "open" ||
      a.status === "acknowledged" ||
      a.status === "escalated",
  );
}

export function alertsNeedingEscalation(state: HouseholdState): Alert[] {
  const t = now(state).getTime();
  const ms = state.pact.escalationMinutes * 60_000;
  return state.alerts.filter((a) => {
    if (a.status !== "open") return false;
    return t - new Date(a.createdAt).getTime() >= ms;
  });
}

export function alertTitle(type: AlertType): string {
  switch (type) {
    case "night_exit":
      return "Unusual night exit";
    case "unusual_door":
      return "Unusual door activity";
    case "long_open":
      return "Door may still be open";
    case "rest_window_exit":
      return "Exit during rest window";
    case "quiet_miss":
      return "Unusual quiet — no sign of life";
    case "visit_missed":
      return "Expected visit didn’t show";
  }
}

export function severityFor(type: AlertType): Alert["severity"] {
  switch (type) {
    case "night_exit":
    case "quiet_miss":
    case "long_open":
      return "urgent";
    case "visit_missed":
    case "rest_window_exit":
      return "attention";
    case "unusual_door":
      return "attention";
  }
}

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export function createAlert(
  state: HouseholdState,
  type: AlertType,
  summary: string,
  at = now(state),
): Alert {
  const onDutyId = currentOnDuty(state);
  const backupId = currentBackup(state);
  return {
    id: uid("alert"),
    type,
    title: alertTitle(type),
    summary,
    severity: severityFor(type),
    status: "open",
    createdAt: at.toISOString(),
    onDutyId,
    backupId,
    ownerId: onDutyId,
    completedSteps: [],
    timeline: [
      {
        id: uid("tl"),
        at: at.toISOString(),
        text: `Alert created · on duty: ${memberById(state, onDutyId)?.name ?? onDutyId}`,
      },
    ],
    linkedAlertIds: [],
  };
}

export function visitorOccursOn(visitor: ExpectedVisitor, at: Date): boolean {
  if (visitor.oneOffDay) return visitor.oneOffDay === at.toISOString().slice(0, 10);
  const repeat = visitor.recurrence;
  if (!repeat) return visitor.weekday === at.getDay();
  const [year, month, day] = repeat.startsOn.split("-").map(Number);
  const start = Date.UTC(year, month - 1, day);
  const current = Date.UTC(at.getFullYear(), at.getMonth(), at.getDate());
  if (current < start) return false;
  if (repeat.unit === "month") {
    const months = (at.getFullYear() - year) * 12 + at.getMonth() - (month - 1);
    const lastDay = new Date(at.getFullYear(), at.getMonth() + 1, 0).getDate();
    return months % repeat.interval === 0 && at.getDate() === Math.min(day, lastDay);
  }
  const days = Math.round((current - start) / 86400000);
  return days % (repeat.interval * (repeat.unit === "week" ? 7 : 1)) === 0;
}

export function visitorRepeatLabel(visitor: ExpectedVisitor): string {
  if (visitor.oneOffDay) return `On ${visitor.oneOffDay}`;
  const repeat = visitor.recurrence;
  if (!repeat) return `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][visitor.weekday]}`;
  const label = repeat.interval === 1 ? { day: "Daily", week: "Weekly", month: "Monthly" }[repeat.unit] : `Every ${repeat.interval} ${repeat.unit}s`;
  return `${label} · from ${repeat.startsOn}`;
}

export function matchVisitor(
  state: HouseholdState,
  at: Date,
): { label: string; startHour: number; endHour: number } | null {
  const hour = at.getHours();
  const day = at.toISOString().slice(0, 10);
  // Prefer Mom’s one-off “someone is coming” for today
  const oneOff = state.visitors.find(
    (v) =>
      v.oneOffDay === day &&
      hour >= v.startHour &&
      hour < v.endHour,
  );
  if (oneOff) {
    return {
      label: oneOff.label,
      startHour: oneOff.startHour,
      endHour: oneOff.endHour,
    };
  }
  const hit = state.visitors.find(
    (v) =>
      !v.oneOffDay &&
      visitorOccursOn(v, at) &&
      hour >= v.startHour &&
      hour < v.endHour,
  );
  return hit
    ? { label: hit.label, startHour: hit.startHour, endHour: hit.endHour }
    : null;
}

export function latestFeeling(state: HouseholdState): FeelingLog | null {
  const key = todayKey(state);
  return (
    (state.feelingLogs ?? []).find((f) => f.at.slice(0, 10) === key) ?? null
  );
}

export function breakActive(state: HouseholdState): boolean {
  return (
    state.optOutToday ||
    (state.breakLogs ?? []).some(
      (b) => b.active && b.at.slice(0, 10) === todayKey(state),
    )
  );
}

export function feelingLabel(level: FeelingLevel): string {
  if (level === "good") return "Feeling good";
  if (level === "okay") return "So-so";
  return "Not great";
}

/** Schedule hint only — never claims visitor identity. */
export function visitWindowHint(
  state: HouseholdState,
  at = now(state),
): string {
  const hit = matchVisitor(state, at);
  if (hit) {
    return `Expected visit window: ${hit.label} (${formatHourMinute(hit.startHour, 0)}–${formatHourMinute(hit.endHour, 0)})`;
  }
  return "No expected visit window right now — treat as unexpected unless you know them.";
}

/** Open alerts that still need someone to accept responsibility. */
export function awaitingAccept(state: HouseholdState): Alert[] {
  return state.alerts.filter((a) => a.status === "open");
}

export function coverageGapMessage(state: HouseholdState): string | null {
  const open = awaitingAccept(state);
  if (open.length === 0) return null;
  const owner = memberById(state, currentOnDuty(state));
  if (open.length === 1) {
    return `${owner?.name ?? "On-duty"} hasn’t accepted responsibility yet — tap Accept on the alert.`;
  }
  return `${open.length} alerts waiting for accept · on duty ${owner?.name ?? "—"}.`;
}

export function classifyRingEvent(
  state: HouseholdState,
  at: Date,
  kind: RingEvent["kind"],
): { matched: RingEvent["matched"]; alertType?: AlertType; summary: string } {
  if (isAway(state)) {
    return {
      matched: "ignore",
      summary: "Household opted out / away — logged only",
    };
  }

  const visitor = matchVisitor(state, at);
  if (visitor) {
    return {
      matched: "expected",
      summary: `Expected: ${visitor.label}`,
    };
  }

  if (isNightHour(state, at)) {
    return {
      matched: "alert",
      alertType: "night_exit",
      summary: `Door ${kind} at ${formatTime(at)} (night window)`,
    };
  }

  if (isRestWindow(state, at)) {
    return {
      matched: "alert",
      alertType: "rest_window_exit",
      summary: `Door ${kind} during rest window (${formatTime(at)})`,
    };
  }

  if (kind === "open") {
    return {
      matched: "alert",
      alertType: "long_open",
      summary: `Door opened at ${formatTime(at)} — confirm it closed`,
    };
  }

  if (kind === "ding") {
    return {
      matched: "alert",
      alertType: "unusual_door",
      summary: `Unexpected doorbell at ${formatTime(at)} · no visit window`,
    };
  }

  return {
    matched: "ignore",
    summary: `Daytime motion at ${formatTime(at)} — no pact break`,
  };
}

/** Fixed en-US style — avoids SSR/client locale mismatches (e.g. "12:30" vs "12:30 PM"). */
export function formatHourMinute(hour24: number, minute: number): string {
  const h = ((hour24 % 24) + 24) % 24;
  const m = Math.max(0, Math.min(59, minute | 0));
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatTime(d: Date): string {
  return formatHourMinute(d.getHours(), d.getMinutes());
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()} · ${formatTime(d)}`;
}

export function quietByLabel(state: HouseholdState): string {
  return formatHourMinute(state.pact.quietByHour, state.pact.quietByMinute);
}
