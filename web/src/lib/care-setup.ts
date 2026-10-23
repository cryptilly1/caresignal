export type SetupMember = {
  id: string;
  name: string;
  email: string;
  access: "member" | "lead";
  status: "pending" | "joined";
};

export type CareSetup = {
  caregiverName: string;
  caregiverPreferredName: string;
  recipientUsername: string;
  recipientName: string;
  recipientPreferredName: string;
  relationship: string;
  profileIcon: string;
  profileColor: string;
  members: SetupMember[];
  dutyShift: string;
  dutyRepeat: string;
  dutyEnabled: boolean;
  backupIds: string[];
  checkInEnabled: boolean;
  checkInTime: string;
  checkInRepeat: string;
  recipientInvitePending: boolean;
};

export const CARE_SETUP_KEY = "caresignal-setup-v1";

export const emptyCareSetup: CareSetup = {
  caregiverName: "",
  caregiverPreferredName: "",
  recipientUsername: "",
  recipientName: "",
  recipientPreferredName: "",
  relationship: "",
  profileIcon: "Sun",
  profileColor: "Amber",
  members: [],
  dutyShift: "10:00 AM - 6:00 PM",
  dutyRepeat: "Every day",
  dutyEnabled: true,
  backupIds: [],
  checkInEnabled: true,
  checkInTime: "10:00 AM",
  checkInRepeat: "Every day",
  recipientInvitePending: false,
};

export function parseCareSetup(raw: string): CareSetup {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Saved care setup is invalid.");
  }
  const setup = { ...emptyCareSetup, ...value };
  if (!("backupIds" in value) && "backupId" in value && typeof value.backupId === "string") {
    setup.backupIds = [value.backupId];
  }
  for (const key of Object.keys(emptyCareSetup) as Array<keyof CareSetup>) {
    if (key === "members" || key === "backupIds") continue;
    if (typeof setup[key] !== typeof emptyCareSetup[key]) {
      throw new Error("Saved care setup contains invalid fields.");
    }
  }
  if (
    !Array.isArray(setup.members) ||
    !setup.members.every(
      (member: unknown): member is SetupMember =>
        !!member &&
        typeof member === "object" &&
        "id" in member && typeof member.id === "string" &&
        "name" in member && typeof member.name === "string" &&
        "email" in member && typeof member.email === "string" &&
        "access" in member && ["member", "lead"].includes(String(member.access)) &&
        "status" in member && ["pending", "joined"].includes(String(member.status)),
    ) ||
    !Array.isArray(setup.backupIds)
  ) {
    throw new Error("Saved care team is invalid.");
  }
  if (new Set(setup.backupIds).size !== setup.backupIds.length || !setup.backupIds.every(
    (id: unknown) => typeof id === "string" && setup.members.some((member) => member.id === id),
  )) {
    throw new Error("Saved backups must belong to the invited care team.");
  }
  return setup;
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

export function recipientLabel(setup: CareSetup) {
  return setup.recipientPreferredName || setup.recipientName || "Evelyn";
}

export function caregiverLabel(setup: CareSetup) {
  return setup.caregiverPreferredName || setup.caregiverName || "You";
}
