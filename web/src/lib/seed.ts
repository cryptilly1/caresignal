import type { DutyDay, HouseholdState, PlaybookMap } from "./types";

const playbooks: PlaybookMap = {
  night_exit: [
    { id: "ne1", label: "Call Mom" },
    { id: "ne2", label: "If no answer in 15 min, call neighbor Mira" },
    { id: "ne3", label: "If still worried, consider a wellness check" },
  ],
  unusual_door: [
    { id: "ud1", label: "Check if a guest was expected" },
    { id: "ud2", label: "Call Mom for a quick check-in" },
    { id: "ud3", label: "Ask a nearby neighbor if needed" },
  ],
  long_open: [
    { id: "lo1", label: "Call Mom and ask about the door" },
    { id: "lo2", label: "If no answer, ask Mira to look" },
  ],
  rest_window_exit: [
    { id: "rw1", label: "Call Mom — rest window exit" },
    { id: "rw2", label: "Confirm she’s safe and comfortable" },
  ],
  quiet_miss: [
    { id: "qm1", label: "Call Mom" },
    { id: "qm2", label: "If no answer in 15 min, call neighbor Mira" },
    { id: "qm3", label: "If still no contact, escalate to backup / wellness path" },
  ],
  visit_missed: [
    { id: "vm1", label: "Call Mom — did the visit happen?" },
    { id: "vm2", label: "Call the agency / visitor" },
    { id: "vm3", label: "Assign a sibling to follow up" },
  ],
};

/** Fixed demo epoch so SSR/prerender never reads `Date.now()`. */
const DEMO_EPOCH = Date.UTC(2026, 9, 13, 12, 0, 0);

function dateOffset(days: number): string {
  const d = new Date(DEMO_EPOCH);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function createSeedState(): HouseholdState {
  return {
    careRecipientName: "Mom",
    members: [
      {
        id: "mom",
        name: "Mom",
        role: "person_at_home",
        phoneLabel: "Home line",
      },
      {
        id: "alex",
        name: "Elias",
        role: "care_lead",
        phoneLabel: "Elias · mobile",
      },
      {
        id: "sam",
        name: "Sam",
        role: "caregiver",
        phoneLabel: "Sam · mobile",
      },
      {
        id: "jordan",
        name: "Jordan",
        role: "caregiver",
        phoneLabel: "Jordan · mobile",
      },
      {
        id: "mira",
        name: "Mira",
        role: "caregiver",
        phoneLabel: "Neighbor Mira",
      },
    ],
    currentUserId: "alex",
    duty: [
      { date: dateOffset(0), onDutyId: "alex", backupId: "sam" },
      { date: dateOffset(1), onDutyId: "sam", backupId: "jordan" },
      { date: dateOffset(2), onDutyId: "jordan", backupId: "alex" },
      { date: dateOffset(3), onDutyId: "alex", backupId: "sam" },
      { date: dateOffset(4), onDutyId: "sam", backupId: "alex" },
      { date: dateOffset(5), onDutyId: "jordan", backupId: "sam" },
      { date: dateOffset(6), onDutyId: "alex", backupId: "jordan" },
    ],
    dutyOverrideId: null,
    pact: {
      quietByHour: 12,
      quietByMinute: 30,
      nightStartHour: 23,
      nightEndHour: 6,
      escalationMinutes: 1, // short for demo; setup can raise
      restWindowEnabled: true,
      restStartHour: 9,
      restEndHour: 11,
      doorActivityCountsAsSignOfLife: true,
      requireImOkay: false,
      cameraDetectMode: "person",
      cameraSensitivity: "medium",
      cameraAlertPolicy: "always",
    },
    visitors: [
      {
        id: "nurse-tue",
        label: "Nurse visit",
        weekday: 2,
        startHour: 10,
        endHour: 11,
      },
      {
        id: "cleaner-fri",
        label: "Cleaner",
        weekday: 5,
        startHour: 13,
        endHour: 15,
      },
    ],
    playbooks,
    checkIns: [],
    feelingLogs: [],
    breakLogs: [],
    medicines: [
      {
        id: "med-bp",
        name: "Blood pressure",
        dose: "1 tablet",
        times: ["08:00", "20:00"],
      },
      {
        id: "med-vitd",
        name: "Vitamin D",
        dose: "1 tablet",
        times: ["09:00"],
      },
    ],
    medicineLogs: [],
    walkLogs: [],
    awayUntil: null,
    optOutToday: false,
    alerts: [],
    assignments: [],
    ringEvents: [],
    demoNow: null,
  };
}

export function updateDemoCareLead(state: HouseholdState): HouseholdState {
  const old = state.members.find((member) => member.id === "alex" && member.name === "Alex" && member.phoneLabel === "Alex · mobile");
  if (!old) return state;
  return {
    ...state,
    members: state.members.map((member) => member === old ? { ...member, name: "Elias", phoneLabel: "Elias · mobile" } : member),
  };
}

/** Align duty calendar to the real local week (client hydrate). */
export function withRollingDuty(state: HouseholdState): HouseholdState {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  const pattern = state.duty.length
    ? state.duty
    : createSeedState().duty;
  const duty: DutyDay[] = pattern.slice(0, 7).map((row, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      onDutyId: row.onDutyId,
      backupId: row.backupId,
    };
  });
  return { ...updateDemoCareLead(state), duty };
}
