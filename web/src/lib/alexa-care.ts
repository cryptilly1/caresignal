/**
 * Shared CareSignal actions for Alexa Skill, Alexa+ MCP, and the simulator.
 * DoorSense hits the same server store as tablet / TV.
 */

import { postAlexaCareEvent } from "@/lib/alexa-events-server";
import {
  getDoorSensePending,
  respondDoorSense,
  type DoorSenseResponse,
} from "@/lib/doorsense-server";

export type CareAction =
  | "im_okay"
  | "medicine"
  | "walk"
  | "expecting"
  | "tell_caregiver"
  | "need_help"
  | "dismiss"
  | "door_status";

export type CareActionSource = "Alexa" | "MCP" | "Simulator";

export type CareActionResult = {
  ok: boolean;
  speech: string;
  action: CareAction;
  doorsense?: {
    pending: ReturnType<typeof getDoorSensePending>;
    response: DoorSenseResponse | null;
  };
};

export function runCareAction(
  action: CareAction,
  source: CareActionSource = "Alexa",
): CareActionResult {
  if (action === "door_status") {
    const pending = getDoorSensePending();
    if (!pending) {
      return {
        ok: true,
        action,
        speech: "Quiet at the door. Nothing is waiting on DoorSense right now.",
      };
    }
    return {
      ok: true,
      action,
      speech: `${pending.label}. You can say tell my caregiver, I need help, I'm expecting someone, or not now.`,
      doorsense: { pending, response: null },
    };
  }

  if (action === "im_okay") {
    postAlexaCareEvent({
      kind: "check_in",
      label: "Mom checked in via Alexa — I’m okay",
      source,
    });
    return {
      ok: true,
      action,
      speech: "Got it. I told your family you're okay.",
    };
  }

  if (action === "medicine") {
    postAlexaCareEvent({
      kind: "medicine",
      label: "Mom logged medicine via Alexa",
      source,
    });
    return {
      ok: true,
      action,
      speech: "Logged your medicine. Nice work.",
    };
  }

  if (action === "walk") {
    postAlexaCareEvent({
      kind: "walk",
      label: "Mom logged a walk via Alexa",
      source,
    });
    return {
      ok: true,
      action,
      speech: "Logged a fifteen minute walk. Your family can see it.",
    };
  }

  const choice = action as DoorSenseResponse["choice"];
  const { pending, response } = respondDoorSense(choice);
  postAlexaCareEvent({
    kind: "doorsense",
    label: response?.label ?? "DoorSense response via Alexa",
    choice,
    source,
  });

  if (!response) {
    return {
      ok: false,
      action,
      speech:
        "Nothing was pending at the door. If you need help anyway, say I need help.",
      doorsense: { pending, response: null },
    };
  }

  const speech: Record<DoorSenseResponse["choice"], string> = {
    expecting: "Okay. You're expecting someone. I won't alert your caregiver.",
    tell_caregiver:
      "I've told your caregiver. They can join the door camera from their phone.",
    need_help: "Help request sent to your caregiver. Hang tight.",
    dismiss: "Okay. Dismissed for now.",
  };

  return {
    ok: true,
    action,
    speech: speech[choice],
    doorsense: { pending, response },
  };
}

/** Map free text (simulator / MCP) to a care action. */
export function parseCareActionText(text: string): CareAction | null {
  const t = text.toLowerCase().trim();
  if (
    /\b(i'?m okay|i am okay|i'?m fine|check[\s-]?in|doing fine)\b/.test(t)
  ) {
    return "im_okay";
  }
  if (/\b(medicine|medication|pills?|took my)\b/.test(t)) {
    return "medicine";
  }
  if (/\b(walk|walking|went for a|stroll)\b/.test(t)) {
    return "walk";
  }
  if (/\b(need help|help me|emergency|urgent)\b/.test(t)) {
    return "need_help";
  }
  if (
    /\b(tell (my )?(caregiver|family)|notify|call (my )?caregiver)\b/.test(t)
  ) {
    return "tell_caregiver";
  }
  if (/\b(expecting|i know|package|delivery)\b/.test(t)) {
    return "expecting";
  }
  if (/\b(not now|dismiss|ignore|never mind|cancel)\b/.test(t)) {
    return "dismiss";
  }
  if (/\b(door|doorbell|anyone at|status|what'?s at)\b/.test(t)) {
    return "door_status";
  }
  return null;
}
