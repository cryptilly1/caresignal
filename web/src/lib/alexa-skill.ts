/**
 * Alexa Skills Kit request → CareSignal speech response.
 * Endpoint: POST /api/alexa
 */

import {
  parseCareActionText,
  runCareAction,
  type CareAction,
} from "@/lib/alexa-care";

type AlexaSlot = { name?: string; value?: string };
type AlexaIntent = {
  name: string;
  slots?: Record<string, AlexaSlot>;
};
type AlexaRequest = {
  type: string;
  intent?: AlexaIntent;
  requestId?: string;
  timestamp?: string;
};

export type AlexaEnvelope = {
  version?: string;
  session?: { new?: boolean; sessionId?: string };
  context?: {
    System?: { application?: { applicationId?: string } };
  };
  request: AlexaRequest;
};

function speechResponse(text: string, end = true) {
  return {
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText" as const, text },
      shouldEndSession: end,
      reprompt: end
        ? undefined
        : {
            outputSpeech: {
              type: "PlainText" as const,
              text: "You can say I'm okay, tell my caregiver, I need help, or what's at the door.",
            },
          },
    },
  };
}

const INTENT_MAP: Record<string, CareAction> = {
  ImOkayIntent: "im_okay",
  TookMedicineIntent: "medicine",
  WentForWalkIntent: "walk",
  DoorExpectingIntent: "expecting",
  TellCaregiverIntent: "tell_caregiver",
  NeedHelpIntent: "need_help",
  DismissDoorIntent: "dismiss",
  DoorStatusIntent: "door_status",
};

export function handleAlexaEnvelope(body: AlexaEnvelope) {
  const req = body.request;
  if (!req) {
    return speechResponse("Sorry, I didn't get that request.");
  }

  if (req.type === "LaunchRequest") {
    return speechResponse(
      "CareSignal here. You can say I'm okay, I took my medicine, tell my caregiver, I need help, or what's at the door.",
      false,
    );
  }

  if (req.type === "SessionEndedRequest") {
    return { version: "1.0", response: { shouldEndSession: true } };
  }

  if (req.type === "IntentRequest" && req.intent) {
    const name = req.intent.name;

    if (name === "AMAZON.HelpIntent") {
      return speechResponse(
        "With CareSignal you can check in, log medicine or a walk, and answer the door. Try: tell my caregiver, or I'm okay.",
        false,
      );
    }
    if (
      name === "AMAZON.CancelIntent" ||
      name === "AMAZON.StopIntent" ||
      name === "AMAZON.NavigateHomeIntent"
    ) {
      return speechResponse("Okay. Goodbye.");
    }
    if (name === "AMAZON.FallbackIntent") {
      return speechResponse(
        "I didn't catch that. Try I'm okay, tell my caregiver, I need help, or what's at the door.",
        false,
      );
    }

    // Free-form CatchAll slot (optional)
    if (name === "CatchAllIntent") {
      const raw =
        req.intent.slots?.phrase?.value ??
        req.intent.slots?.query?.value ??
        "";
      const parsed = parseCareActionText(raw);
      if (!parsed) {
        return speechResponse(
          "I heard you, but I'm not sure what to do. Try tell my caregiver, or I'm okay.",
          false,
        );
      }
      const result = runCareAction(parsed, "Alexa");
      return speechResponse(result.speech, true);
    }

    const action = INTENT_MAP[name];
    if (action) {
      const result = runCareAction(action, "Alexa");
      return speechResponse(result.speech, true);
    }

    return speechResponse(
      "That command isn't set up yet. Try I'm okay, or tell my caregiver.",
      false,
    );
  }

  return speechResponse("CareSignal is ready. What would you like to do?", false);
}
