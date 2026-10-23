export type Role = "person_at_home" | "care_lead" | "caregiver" | "view_only";

export type MemberId =
  | "mom"
  | "alex"
  | "sam"
  | "jordan"
  | "mira";

export type AlertType =
  | "night_exit"
  | "unusual_door"
  | "long_open"
  | "rest_window_exit"
  | "quiet_miss"
  | "visit_missed";

export type AlertStatus =
  | "open"
  | "acknowledged"
  | "escalated"
  | "resolved_fine"
  | "resolved_helped"
  | "cleared";

export type AssignmentStatus = "open" | "done" | "cant_do" | "overdue";

export interface Member {
  id: MemberId;
  name: string;
  role: Role;
  phoneLabel: string;
}

export interface DutyDay {
  /** ISO date YYYY-MM-DD */
  date: string;
  onDutyId: MemberId;
  backupId: MemberId;
}

export interface ExpectedVisitor {
  id: string;
  label: string;
  /** 0=Sun … 6=Sat */
  weekday: number;
  startHour: number;
  endHour: number;
  /** Mom’s one-off “someone is coming” — only matches this YYYY-MM-DD */
  oneOffDay?: string;
  recurrence?: {
    unit: "day" | "week" | "month";
    interval: number;
    startsOn: string;
  };
}

export type FeelingLevel = "good" | "okay" | "not_great";

export interface FeelingLog {
  id: string;
  at: string;
  level: FeelingLevel;
}

export interface BreakLog {
  id: string;
  at: string;
  /** Soft pause — caregiver sees she asked for space */
  active: boolean;
}

/** Phone / door-cam stand-in detection */
export type CameraDetectMode = "person" | "motion";
export type CameraSensitivity = "low" | "medium" | "high";
/** pact = only alert on night / rest / unusual rules; always = demo every sighting */
export type CameraAlertPolicy = "pact" | "always";

export interface CarePact {
  quietByHour: number;
  quietByMinute: number;
  nightStartHour: number;
  nightEndHour: number;
  escalationMinutes: number;
  restWindowEnabled: boolean;
  restStartHour: number;
  restEndHour: number;
  doorActivityCountsAsSignOfLife: boolean;
  requireImOkay: boolean;
  cameraDetectMode: CameraDetectMode;
  cameraSensitivity: CameraSensitivity;
  cameraAlertPolicy: CameraAlertPolicy;
}

export interface PlaybookStep {
  id: string;
  label: string;
}

export type PlaybookMap = Record<AlertType, PlaybookStep[]>;

export interface CheckIn {
  id: string;
  at: string;
  note?: string;
}

/** Scheduled meds shown as cards on the recipient (tablet / Show) surface */
export interface Medicine {
  id: string;
  name: string;
  dose: string;
  /** Typical times as "HH:mm" local labels for cards */
  times: string[];
}

export interface MedicineLog {
  id: string;
  medicineId: string;
  at: string;
  timeSlot: string;
}

export interface WalkLog {
  id: string;
  at: string;
  minutes: number;
  note?: string;
}

export interface RingEvent {
  id: string;
  at: string;
  kind: "motion" | "ding" | "open";
  label: string;
  matched: "expected" | "alert" | "ignore";
  alertId?: string;
  /** Where the event came from — shown on Today */
  source?: "playground" | "fixture" | "phone" | "webhook";
}

export interface TimelineEntry {
  id: string;
  at: string;
  text: string;
}

export interface Assignment {
  id: string;
  alertId?: string;
  toId: MemberId;
  fromId: MemberId;
  title: string;
  dueAt: string;
  status: AssignmentStatus;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  summary: string;
  severity: "fyi" | "attention" | "urgent";
  status: AlertStatus;
  createdAt: string;
  onDutyId: MemberId;
  backupId: MemberId;
  ownerId: MemberId;
  acknowledgedAt?: string;
  escalatedAt?: string;
  resolvedAt?: string;
  resolveNote?: string;
  completedSteps: string[];
  timeline: TimelineEntry[];
  linkedAlertIds: string[];
}

export interface HouseholdState {
  careRecipientName: string;
  members: Member[];
  currentUserId: MemberId;
  duty: DutyDay[];
  dutyOverrideId: MemberId | null;
  pact: CarePact;
  visitors: ExpectedVisitor[];
  playbooks: PlaybookMap;
  checkIns: CheckIn[];
  feelingLogs: FeelingLog[];
  breakLogs: BreakLog[];
  medicines: Medicine[];
  medicineLogs: MedicineLog[];
  walkLogs: WalkLog[];
  awayUntil: string | null;
  optOutToday: boolean;
  alerts: Alert[];
  assignments: Assignment[];
  ringEvents: RingEvent[];
  /** Demo clock override ISO string, or null = real now */
  demoNow: string | null;
}
