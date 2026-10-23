export const HOME_PREVIEW_KEY = "caresignal-home-preview-v1";
export type PreviewAlertId = "door-help" | "medicine-refill";
export type HomePreviewState = {
  cleared: PreviewAlertId[];
  owned: PreviewAlertId[];
};

export const emptyHomePreview: HomePreviewState = { cleared: [], owned: [] };
const isAlertId = (value: unknown): value is PreviewAlertId =>
  value === "door-help" || value === "medicine-refill";

export function parseHomePreview(raw: string): HomePreviewState {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    !("cleared" in value) || !Array.isArray(value.cleared) ||
    !value.cleared.every(isAlertId) || new Set(value.cleared).size !== value.cleared.length ||
    !("owned" in value) || !Array.isArray(value.owned) ||
    !value.owned.every(isAlertId) || new Set(value.owned).size !== value.owned.length) {
    throw new Error("Saved home preview is invalid.");
  }
  return { cleared: value.cleared, owned: value.owned };
}

export const previewMoments = [
  { icon: "checked", title: "Checked in", detail: "“Good morning!”", time: "8:12" },
  { icon: "smile", title: "Feeling good", detail: "Shared on her tablet", time: "8:13" },
  { icon: "pill", title: "Morning medicine taken", detail: "Confirmed by Mom", time: "8:20" },
  { icon: "walk", title: "A short walk", detail: "20 minutes in the garden", time: "9:10" },
  { icon: "people", title: "Expecting Nina at noon", detail: "Mom’s friend · here for lunch", time: "10:30" },
  { icon: "coffee", title: "Took a quiet break", detail: "Rested from 11:05–11:25", time: "11:25" },
] as const;

export function formatCallDuration(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
