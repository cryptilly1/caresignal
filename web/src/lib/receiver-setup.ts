export const RECEIVER_SETUP_KEY = "caresignal-receiver-v1";
export const DEMO_INVITE_CODE = "CS-7K4M";

export type ReceiverSetup = {
  joined: boolean;
  preferredName: string;
  reminderChoice: "yes" | "no" | null;
  completed: boolean;
  checkInDate: string | null;
};

export const emptyReceiverSetup: ReceiverSetup = {
  joined: false,
  preferredName: "Evelyn Morgan",
  reminderChoice: null,
  completed: false,
  checkInDate: null,
};

export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase();
}

export function parseReceiverSetup(raw: string): ReceiverSetup {
  const value: unknown = JSON.parse(raw);
  if (
    !value || typeof value !== "object" || Array.isArray(value) ||
    !("joined" in value) || typeof value.joined !== "boolean" ||
    !("preferredName" in value) || typeof value.preferredName !== "string" || !value.preferredName.trim() ||
    !("reminderChoice" in value) || (value.reminderChoice !== null && value.reminderChoice !== "yes" && value.reminderChoice !== "no") ||
    !("completed" in value) || typeof value.completed !== "boolean" ||
    !("checkInDate" in value) ||
    (value.checkInDate !== null && (typeof value.checkInDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.checkInDate))) ||
    (!value.joined && (value.reminderChoice !== null || value.checkInDate !== null))
  ) {
    throw new Error("Saved care receiver setup is invalid.");
  }
  return {
    joined: value.joined,
    preferredName: value.preferredName,
    reminderChoice: value.reminderChoice,
    completed: value.completed,
    checkInDate: value.checkInDate,
  };
}
