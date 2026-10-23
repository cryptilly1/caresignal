/**
 * Shared household state (Mac + phone via same Next origin / tunnel).
 * In-memory for hackathon — last-write-wins with monotonic version.
 */

import { createSeedState, withRollingDuty } from "@/lib/seed";
import type { HouseholdState } from "@/lib/types";

export type HouseholdEnvelope = {
  version: number;
  updatedAt: string;
  state: HouseholdState;
};

type Store = {
  envelope: HouseholdEnvelope;
};

const g = globalThis as typeof globalThis & {
  __caresignalHousehold?: Store;
};

function store(): Store {
  if (!g.__caresignalHousehold) {
    const state = withRollingDuty(createSeedState());
    g.__caresignalHousehold = {
      envelope: {
        version: 1,
        updatedAt: new Date().toISOString(),
        state,
      },
    };
  }
  return g.__caresignalHousehold;
}

export function getHousehold(): HouseholdEnvelope {
  return store().envelope;
}

export function putHousehold(state: HouseholdState): HouseholdEnvelope {
  const s = store();
  const next: HouseholdEnvelope = {
    version: s.envelope.version + 1,
    updatedAt: new Date().toISOString(),
    state,
  };
  s.envelope = next;
  return next;
}

/** Replace with seed (demo reset). */
export function resetHousehold(): HouseholdEnvelope {
  const state = withRollingDuty(createSeedState());
  const s = store();
  const next: HouseholdEnvelope = {
    version: s.envelope.version + 1,
    updatedAt: new Date().toISOString(),
    state,
  };
  s.envelope = next;
  return next;
}
