"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  alertsNeedingEscalation,
  checkedInToday,
  classifyRingEvent,
  createAlert,
  currentBackup,
  currentOnDuty,
  hasSignOfLife,
  isAway,
  now,
  todayKey,
  uid,
} from "./engine";
import { createSeedState, updateDemoCareLead, withRollingDuty } from "./seed";
import type {
  AlertType,
  Assignment,
  CarePact,
  ExpectedVisitor,
  FeelingLevel,
  HouseholdState,
  MemberId,
  RingEvent,
} from "./types";

const STORAGE_KEY = "porchlight-v2";

type Store = {
  state: HouseholdState;
  hydrated: boolean;
  setCurrentUser: (id: MemberId) => void;
  imOkay: (note?: string) => void;
  logFeeling: (level: FeelingLevel) => void;
  logSomeoneComing: (label: string) => void;
  requestBreak: () => void;
  clearBreak: () => void;
  requestHelp: () => string | null;
  logMedicine: (medicineId: string, timeSlot: string) => void;
  logWalk: (minutes: number, note?: string) => void;
  setAway: (untilIso: string | null) => void;
  setOptOutToday: (value: boolean) => void;
  updatePact: (patch: Partial<CarePact>) => void;
  setDuty: (date: string, onDutyId: MemberId, backupId: MemberId) => void;
  setDutyOverride: (id: MemberId | null) => void;
  saveVisitor: (visitor: ExpectedVisitor) => void;
  removeVisitor: (id: string) => void;
  updatePlaybook: (type: AlertType, labels: string[]) => void;
  acknowledgeAlert: (alertId: string) => void;
  clearAlert: (alertId: string) => void;
  completeStep: (alertId: string, stepId: string) => void;
  assignTask: (input: {
    alertId?: string;
    toId: MemberId;
    title: string;
    dueMinutes: number;
  }) => void;
  completeAssignment: (id: string, status: Assignment["status"]) => void;
  handOffAlert: (alertId: string, toId: MemberId) => void;
  resolveAlert: (
    alertId: string,
    kind: "resolved_fine" | "resolved_helped",
    note?: string,
  ) => void;
  escalateAlert: (alertId: string) => void;
  runEscalationPass: () => void;
  injectQuietMiss: () => void;
  injectRing: (kind: RingEvent["kind"], label: string, at?: Date) => void;
  /** Ring Playground / webhook event → care timeline (+ alert when pact says so). */
  ingestRingApiEvent: (input: {
    id: string;
    kind: RingEvent["kind"];
    label: string;
    at?: string;
    source?: RingEvent["source"];
  }) => boolean;
  /** Phone camera sighting → alert per cameraAlertPolicy. Returns true if Today alert created. */
  ingestPhoneSighting: (label: string) => boolean;
  injectVisitMissed: () => void;
  clearAllAlerts: () => void;
  resetDemo: () => void;
  setDemoNow: (iso: string | null) => void;
};

const Ctx = createContext<Store | null>(null);

function loadState(): HouseholdState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const seed = createSeedState();
    if (!raw) return withRollingDuty(seed);
    const parsed = JSON.parse(raw) as Partial<HouseholdState>;
    return withRollingDuty({
      ...seed,
      ...parsed,
      medicines: parsed.medicines ?? seed.medicines,
      medicineLogs: parsed.medicineLogs ?? [],
      walkLogs: parsed.walkLogs ?? [],
      feelingLogs: parsed.feelingLogs ?? [],
      breakLogs: parsed.breakLogs ?? [],
      members: parsed.members ?? seed.members,
      pact: { ...seed.pact, ...(parsed.pact ?? {}) },
      playbooks: parsed.playbooks ?? seed.playbooks,
    } as HouseholdState);
  } catch {
    return withRollingDuty(createSeedState());
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // Always have seed state so mobile never sits on an endless "Loading…" screen
  // if hydration is slow. Server household syncs Mac + phone after mount.
  const [state, setState] = useState<HouseholdState>(createSeedState);
  const [hydrated, setHydrated] = useState(false);
  const serverVersionRef = useRef(0);
  const skipPushRef = useRef(false);
  const pushTimerRef = useRef<number | null>(null);
  const currentUserRef = useRef<MemberId>("alex");

  useEffect(() => {
    currentUserRef.current = state.currentUserId;
  }, [state.currentUserId]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const local = (() => {
        try {
          return loadState();
        } catch {
          return withRollingDuty(createSeedState());
        }
      })();

      try {
        const res = await fetch("/api/household", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as {
            version: number;
            state: HouseholdState;
          };
          if (!cancelled && data?.state) {
            serverVersionRef.current = data.version;
            skipPushRef.current = true;
            // Device role stays local; household facts come from server
            setState({
              ...updateDemoCareLead(data.state),
              currentUserId: local.currentUserId ?? data.state.currentUserId,
            });
            setHydrated(true);
            return;
          }
        }
      } catch {
        // fall through to local + seed server
      }

      if (cancelled) return;
      setState(local);
      setHydrated(true);
      // Seed shared server so the other device has something to pull
      try {
        const res = await fetch("/api/household", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: local }),
        });
        if (res.ok) {
          const data = (await res.json()) as { version: number };
          serverVersionRef.current = data.version ?? 1;
        }
      } catch {
        // offline demo — local only
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cache locally + push to shared server (debounced)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode / quota
    }

    if (skipPushRef.current) {
      skipPushRef.current = false;
      return;
    }

    if (pushTimerRef.current != null) {
      window.clearTimeout(pushTimerRef.current);
    }
    pushTimerRef.current = window.setTimeout(() => {
      void fetch("/api/household", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      })
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as { version: number };
          if (typeof data.version === "number") {
            serverVersionRef.current = data.version;
          }
        })
        .catch(() => {});
    }, 280);

    return () => {
      if (pushTimerRef.current != null) {
        window.clearTimeout(pushTimerRef.current);
      }
    };
  }, [state, hydrated]);

  // Pull shared household from the other device
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/household?since=${serverVersionRef.current}&_=${Date.now()}`,
          { cache: "no-store" },
        );
        if (cancelled || res.status === 204 || !res.ok) return;
        const data = (await res.json()) as {
          version: number;
          state: HouseholdState;
        };
        if (!data?.state || data.version <= serverVersionRef.current) return;
        serverVersionRef.current = data.version;
        skipPushRef.current = true;
        setState({
          ...updateDemoCareLead(data.state),
          currentUserId: currentUserRef.current,
        });
      } catch {
        // ignore blips
      }
    };

    void tick();
    const id = window.setInterval(tick, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hydrated]);

  // Push camera settings to the phone-cam page (shared via API, not localStorage)
  useEffect(() => {
    if (!hydrated) return;
    const { cameraDetectMode, cameraSensitivity, cameraAlertPolicy } =
      state.pact;
    void fetch("/api/camera-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: cameraDetectMode,
        sensitivity: cameraSensitivity,
        alertPolicy: cameraAlertPolicy,
      }),
    }).catch(() => {});
  }, [
    hydrated,
    state.pact.cameraDetectMode,
    state.pact.cameraSensitivity,
    state.pact.cameraAlertPolicy,
  ]);

  // Auto-escalation ticker (don't depend on state.alerts — that restarted the timer on every alert write)
  useEffect(() => {
    if (!hydrated) return;
    const tick = () => {
      setState((prev) => {
        const due = alertsNeedingEscalation(prev);
        if (due.length === 0) return prev;
        let next = prev;
        for (const a of due) {
          next = escalateInState(next, a.id);
        }
        return next;
      });
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [hydrated, state.pact.escalationMinutes]);

  const setCurrentUser = useCallback((id: MemberId) => {
    setState((s) => ({ ...s, currentUserId: id }));
  }, []);

  const imOkay = useCallback((note?: string) => {
    setState((s) => ({
      ...s,
      checkIns: [
        {
          id: uid("check"),
          at: now(s).toISOString(),
          note,
        },
        ...s.checkIns,
      ],
    }));
  }, []);

  const logFeeling = useCallback((level: FeelingLevel) => {
    setState((s) => ({
      ...s,
      feelingLogs: [
        {
          id: uid("feel"),
          at: now(s).toISOString(),
          level,
        },
        ...(s.feelingLogs ?? []),
      ],
    }));
  }, []);

  const logSomeoneComing = useCallback((label: string) => {
    setState((s) => {
      const at = now(s);
      const day = todayKey(s);
      const startHour = at.getHours();
      const endHour = Math.min(24, startHour + 2);
      const clean = label.trim() || "Expected visitor";
      // Drop prior one-offs for today, keep recurring schedule
      const visitors = [
        {
          id: uid("come"),
          label: clean,
          weekday: at.getDay(),
          startHour,
          endHour,
          oneOffDay: day,
        },
        ...s.visitors.filter((v) => !(v.oneOffDay === day)),
      ];
      return { ...s, visitors };
    });
  }, []);

  const requestBreak = useCallback(() => {
    setState((s) => ({
      ...s,
      optOutToday: true,
      breakLogs: [
        {
          id: uid("break"),
          at: now(s).toISOString(),
          active: true,
        },
        ...(s.breakLogs ?? []).map((b) =>
          b.at.slice(0, 10) === todayKey(s) ? { ...b, active: false } : b,
        ),
      ],
    }));
  }, []);

  const clearBreak = useCallback(() => {
    setState((s) => ({
      ...s,
      optOutToday: false,
      breakLogs: (s.breakLogs ?? []).map((b) =>
        b.at.slice(0, 10) === todayKey(s) ? { ...b, active: false } : b,
      ),
    }));
  }, []);

  const requestHelp = useCallback((): string | null => {
    let alertId: string | null = null;
    setState((s) => {
      const alert = createAlert(
        s,
        "unusual_door",
        `${s.careRecipientName} asked for help — please check in.`,
      );
      alertId = alert.id;
      alert.title = `${s.careRecipientName} needs help`;
      alert.severity = "urgent";
      alert.timeline = [
        ...alert.timeline,
        {
          id: uid("tl"),
          at: now(s).toISOString(),
          text: "Resident tapped I need help on care-receiver cards",
        },
      ];
      return { ...s, alerts: [alert, ...s.alerts] };
    });
    return alertId;
  }, []);

  const logMedicine = useCallback((medicineId: string, timeSlot: string) => {
    setState((s) => {
      const key = todayKey(s);
      const already = (s.medicineLogs ?? []).some(
        (l) =>
          l.medicineId === medicineId &&
          l.timeSlot === timeSlot &&
          l.at.slice(0, 10) === key,
      );
      if (already) return s;
      return {
        ...s,
        medicineLogs: [
          {
            id: uid("medlog"),
            medicineId,
            timeSlot,
            at: now(s).toISOString(),
          },
          ...(s.medicineLogs ?? []),
        ],
      };
    });
  }, []);

  const logWalk = useCallback((minutes: number, note?: string) => {
    setState((s) => ({
      ...s,
      walkLogs: [
        {
          id: uid("walk"),
          at: now(s).toISOString(),
          minutes,
          note,
        },
        ...(s.walkLogs ?? []),
      ],
    }));
  }, []);

  const setAway = useCallback((untilIso: string | null) => {
    setState((s) => ({ ...s, awayUntil: untilIso }));
  }, []);

  const setOptOutToday = useCallback((value: boolean) => {
    setState((s) => ({ ...s, optOutToday: value }));
  }, []);

  const updatePact = useCallback((patch: Partial<CarePact>) => {
    setState((s) => ({ ...s, pact: { ...s.pact, ...patch } }));
  }, []);

  const setDuty = useCallback(
    (date: string, onDutyId: MemberId, backupId: MemberId) => {
      setState((s) => {
        const rest = s.duty.filter((d) => d.date !== date);
        return {
          ...s,
          duty: [...rest, { date, onDutyId, backupId }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        };
      });
    },
    [],
  );

  const setDutyOverride = useCallback((id: MemberId | null) => {
    setState((s) => ({ ...s, dutyOverrideId: id }));
  }, []);

  const saveVisitor = useCallback((visitor: ExpectedVisitor) => {
    setState((s) => ({ ...s, visitors: [...s.visitors.filter((v) => v.id !== visitor.id), visitor] }));
  }, []);

  const removeVisitor = useCallback((id: string) => {
    setState((s) => ({ ...s, visitors: s.visitors.filter((v) => v.id !== id) }));
  }, []);

  const updatePlaybook = useCallback((type: AlertType, labels: string[]) => {
    setState((s) => ({
      ...s,
      playbooks: { ...s.playbooks, [type]: labels.map((label, index) => ({ id: s.playbooks[type][index]?.id ?? uid("step"), label })) },
    }));
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setState((s) => {
      return {
        ...s,
        alerts: s.alerts.map((a) => {
          if (a.id !== alertId) return a;
          if (a.status !== "open" && a.status !== "escalated") return a;
          const at = now(s).toISOString();
          return {
            ...a,
            status: "acknowledged" as const,
            ownerId: s.currentUserId,
            acknowledgedAt: at,
            timeline: [
              ...a.timeline,
              {
                id: uid("tl"),
                at,
                text: `${s.members.find((m) => m.id === s.currentUserId)?.name} is on it`,
              },
            ],
          };
        }),
      };
    });
  }, []);

  const clearAlert = useCallback((alertId: string) => {
    setState((s) => ({
      ...s,
      alerts: s.alerts.map((alert) => {
        if (alert.id !== alertId || !["open", "acknowledged", "escalated"].includes(alert.status)) return alert;
        const at = now(s).toISOString();
        return { ...alert, status: "cleared" as const, resolvedAt: at, timeline: [...alert.timeline, { id: uid("tl"), at, text: "Cleared from open alerts. Event retained in care history." }] };
      }),
    }));
  }, []);

  const completeStep = useCallback((alertId: string, stepId: string) => {
    setState((s) => {
      return {
        ...s,
        alerts: s.alerts.map((a) => {
          if (a.id !== alertId) return a;
          if (!["open", "acknowledged", "escalated"].includes(a.status)) return a;
          if (a.completedSteps.includes(stepId)) return a;
          const at = now(s).toISOString();
          const step = s.playbooks[a.type].find((p) => p.id === stepId);
          if (!step) return a;
          return {
            ...a,
            completedSteps: [...a.completedSteps, stepId],
            timeline: [
              ...a.timeline,
              {
                id: uid("tl"),
                at,
                text: `Playbook: ${step?.label ?? stepId}`,
              },
            ],
          };
        }),
      };
    });
  }, []);

  const assignTask = useCallback(
    (input: {
      alertId?: string;
      toId: MemberId;
      title: string;
      dueMinutes: number;
    }) => {
      setState((s) => {
        const due = new Date(now(s).getTime() + input.dueMinutes * 60_000);
        const assignment: Assignment = {
          id: uid("asg"),
          alertId: input.alertId,
          toId: input.toId,
          fromId: s.currentUserId,
          title: input.title,
          dueAt: due.toISOString(),
          status: "open",
          createdAt: now(s).toISOString(),
        };
        const alerts = input.alertId
          ? s.alerts.map((a) =>
              a.id === input.alertId
                ? {
                    ...a,
                    timeline: [
                      ...a.timeline,
                      {
                        id: uid("tl"),
                        at: assignment.createdAt,
                        text: `Assigned “${input.title}” to ${s.members.find((m) => m.id === input.toId)?.name}`,
                      },
                    ],
                  }
                : a,
            )
          : s.alerts;
        return {
          ...s,
          assignments: [assignment, ...s.assignments],
          alerts,
        };
      });
    },
    [],
  );

  const completeAssignment = useCallback(
    (id: string, status: Assignment["status"]) => {
      setState((s) =>
        s
          ? {
              ...s,
              assignments: s.assignments.map((a) =>
                a.id === id ? { ...a, status } : a,
              ),
            }
          : s,
      );
    },
    [],
  );

  const handOffAlert = useCallback((alertId: string, toId: MemberId) => {
    setState((s) => {
      return {
        ...s,
        alerts: s.alerts.map((a) => {
          if (a.id !== alertId) return a;
          if (a.status !== "acknowledged") return a;
          const at = now(s).toISOString();
          return {
            ...a,
            ownerId: toId,
            timeline: [
              ...a.timeline,
              {
                id: uid("tl"),
                at,
                text: `Handed off to ${s.members.find((m) => m.id === toId)?.name}`,
              },
            ],
          };
        }),
      };
    });
  }, []);

  const resolveAlert = useCallback(
    (
      alertId: string,
      kind: "resolved_fine" | "resolved_helped",
      note?: string,
    ) => {
      setState((s) => {
        return {
          ...s,
          alerts: s.alerts.map((a) => {
            if (a.id !== alertId) return a;
            if (!["open", "acknowledged", "escalated"].includes(a.status)) return a;
            const at = now(s).toISOString();
            return {
              ...a,
              status: kind,
              resolvedAt: at,
              resolveNote: note,
              timeline: [
                ...a.timeline,
                {
                  id: uid("tl"),
                  at,
                  text:
                    kind === "resolved_fine"
                      ? `Marked fine${note ? `: ${note}` : ""}`
                      : `Needed check${note ? `: ${note}` : ""}`,
                },
              ],
            };
          }),
        };
      });
    },
    [],
  );

  const escalateAlert = useCallback((alertId: string) => {
    setState((s) => (s ? escalateInState(s, alertId) : s));
  }, []);

  const runEscalationPass = useCallback(() => {
    setState((s) => {
      let next = s;
      for (const a of alertsNeedingEscalation(s)) {
        next = escalateInState(next, a.id);
      }
      return next;
    });
  }, []);

  const injectQuietMiss = useCallback(() => {
    setState((s) => {
      if (!s || isAway(s)) return s;
      const demo = new Date(now(s));
      demo.setHours(s.pact.quietByHour, s.pact.quietByMinute + 5, 0, 0);
      const forced: HouseholdState = {
        ...s,
        demoNow: demo.toISOString(),
        checkIns: s.checkIns.filter((c) => c.at.slice(0, 10) !== todayKey(s)),
      };
      const existing = forced.alerts.find(
        (a) =>
          a.type === "quiet_miss" &&
          a.createdAt.slice(0, 10) === todayKey(forced) &&
          (a.status === "open" ||
            a.status === "acknowledged" ||
            a.status === "escalated"),
      );
      if (existing) return forced;
      const alert = createAlert(
        forced,
        "quiet_miss",
        `No “I’m okay” and no expected door life by quiet-by time.`,
        demo,
      );
      return { ...forced, alerts: [alert, ...forced.alerts] };
    });
  }, []);

  const injectRing = useCallback(
    (kind: RingEvent["kind"], label: string, at?: Date) => {
      setState((s) => {
        const when = at ?? now(s);
        const classified = classifyRingEvent(s, when, kind);
        let alerts = s.alerts;
        let alertId: string | undefined;
        if (classified.matched === "alert" && classified.alertType) {
          const alert = createAlert(
            s,
            classified.alertType,
            classified.summary,
            when,
          );
          alertId = alert.id;
          alerts = [alert, ...alerts];
        }
        const event: RingEvent = {
          id: uid("ring"),
          at: when.toISOString(),
          kind,
          label,
          matched: classified.matched,
          alertId,
          source: "fixture",
        };
        return {
          ...s,
          ringEvents: [event, ...s.ringEvents],
          alerts,
        };
      });
    },
    [],
  );

  const ingestRingApiEvent = useCallback(
    (input: {
      id: string;
      kind: RingEvent["kind"];
      label: string;
      at?: string;
      source?: RingEvent["source"];
    }) => {
      let alerted = false;
      setState((s) => {
        // Dedupe by Ring event id
        if (s.ringEvents.some((e) => e.id === input.id)) {
          return s;
        }
        const when = input.at ? new Date(input.at) : now(s);
        const whenSafe = Number.isNaN(when.getTime()) ? now(s) : when;
        let classified = classifyRingEvent(s, whenSafe, input.kind);
        // Playground / live Ring: honor "always" camera policy for motion (like phone cam)
        if (
          classified.matched === "ignore" &&
          input.kind === "motion" &&
          s.pact.cameraAlertPolicy === "always"
        ) {
          classified = {
            matched: "alert",
            alertType: "unusual_door",
            summary: input.label || "Motion at the door · Ring",
          };
        }
        let alerts = s.alerts;
        let alertId: string | undefined;
        if (classified.matched === "alert" && classified.alertType) {
          alerted = true;
          const coalesceMs = 45_000;
          const summary = classified.summary || input.label;
          const recent = s.alerts.find((a) => {
            if (
              a.type !== classified.alertType ||
              (a.status !== "open" &&
                a.status !== "acknowledged" &&
                a.status !== "escalated")
            ) {
              return false;
            }
            const lastAt =
              a.timeline[a.timeline.length - 1]?.at ?? a.createdAt;
            return (
              whenSafe.getTime() - new Date(lastAt).getTime() < coalesceMs
            );
          });
          if (recent) {
            alertId = recent.id;
            alerts = s.alerts.map((a) =>
              a.id !== recent.id
                ? a
                : {
                    ...a,
                    summary,
                    timeline: [
                      ...a.timeline,
                      {
                        id: uid("tl"),
                        at: whenSafe.toISOString(),
                        text: `Same door concern · ${summary}`,
                      },
                    ],
                  },
            );
          } else {
            const openDoor = s.alerts.filter(
              (a) =>
                a.type === "unusual_door" &&
                (a.status === "open" ||
                  a.status === "acknowledged" ||
                  a.status === "escalated"),
            ).length;
            // Cap concurrent door alerts so demo doesn’t explode
            if (
              classified.alertType === "unusual_door" &&
              openDoor >= 3 &&
              openDoor > 0
            ) {
              const newest = s.alerts.find(
                (a) =>
                  a.type === "unusual_door" &&
                  (a.status === "open" ||
                    a.status === "acknowledged" ||
                    a.status === "escalated"),
              );
              if (newest) {
                alertId = newest.id;
                alerts = s.alerts.map((a) =>
                  a.id !== newest.id
                    ? a
                    : {
                        ...a,
                        summary,
                        timeline: [
                          ...a.timeline,
                          {
                            id: uid("tl"),
                            at: whenSafe.toISOString(),
                            text: `Capped · folded into open alert · ${summary}`,
                          },
                        ],
                      },
                );
              }
            } else {
              const alert = createAlert(
                s,
                classified.alertType,
                summary,
                whenSafe,
              );
              alertId = alert.id;
              alerts = [alert, ...alerts].slice(0, 40);
            }
          }
        }
        const event: RingEvent = {
          id: input.id,
          at: whenSafe.toISOString(),
          kind: input.kind,
          label: input.label,
          matched: classified.matched,
          alertId,
          source: input.source ?? "playground",
        };
        return {
          ...s,
          ringEvents: [event, ...s.ringEvents].slice(0, 40),
          alerts,
        };
      });
      return alerted;
    },
    [],
  );

  const ingestPhoneSighting = useCallback((label: string) => {
    let alerted = false;
    setState((s) => {
      const when = now(s);
      const summary = label || "Sighting at the door · phone camera";
      // Coalesce brief repeats so demo doesn’t spam alerts.
      const coalesceMs = 45_000;
      const recent = s.alerts.find((a) => {
        if (
          a.type !== "unusual_door" ||
          (a.status !== "open" &&
            a.status !== "acknowledged" &&
            a.status !== "escalated")
        ) {
          return false;
        }
        const lastAt =
          a.timeline[a.timeline.length - 1]?.at ?? a.createdAt;
        return when.getTime() - new Date(lastAt).getTime() < coalesceMs;
      });
      if (recent) {
        alerted = true;
        const ring: RingEvent = {
          id: uid("ring"),
          at: when.toISOString(),
          kind: "motion",
          label: summary,
          matched: "alert",
          alertId: recent.id,
          source: "phone",
        };
        return {
          ...s,
          ringEvents: [ring, ...s.ringEvents].slice(0, 40),
          alerts: s.alerts.map((a) =>
            a.id !== recent.id
              ? a
              : {
                  ...a,
                  summary,
                  timeline: [
                    ...a.timeline,
                    {
                      id: uid("tl"),
                      at: when.toISOString(),
                      text: `Seen again · ${summary}`,
                    },
                  ],
                },
          ),
        };
      }
      alerted = true;
      const alert = createAlert(s, "unusual_door", summary, when);
      const event: RingEvent = {
        id: uid("ring"),
        at: when.toISOString(),
        kind: "motion",
        label: summary,
        matched: "alert",
        alertId: alert.id,
        source: "phone",
      };
      return {
        ...s,
        ringEvents: [event, ...s.ringEvents].slice(0, 40),
        // Cap so localStorage / Today never piles up to 100+
        alerts: [alert, ...s.alerts].slice(0, 40),
      };
    });
    return alerted;
  }, []);

  const injectVisitMissed = useCallback(() => {
    setState((s) => {
      const alert = createAlert(
        s,
        "visit_missed",
        "Nurse was expected this morning — no matching door activity.",
      );
      return { ...s, alerts: [alert, ...s.alerts] };
    });
  }, []);

  const clearAllAlerts = useCallback(() => {
    setState((s) => ({
      ...s,
      alerts: [],
      // Drop open tasks that were tied to alerts so the inbox stays clean
      assignments: s.assignments.filter(
        (a) => !a.alertId || a.status === "done",
      ),
    }));
  }, []);

  const resetDemo = useCallback(() => {
    void (async () => {
      try {
        const res = await fetch("/api/household", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset" }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            version: number;
            state: HouseholdState;
          };
          serverVersionRef.current = data.version;
          skipPushRef.current = true;
          setState({
            ...data.state,
            currentUserId: currentUserRef.current,
          });
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              ...data.state,
              currentUserId: currentUserRef.current,
            }),
          );
          return;
        }
      } catch {
        // fall through
      }
      const fresh = withRollingDuty(createSeedState());
      setState({ ...fresh, currentUserId: currentUserRef.current });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    })();
  }, []);

  const setDemoNow = useCallback((iso: string | null) => {
    setState((s) => ({ ...s, demoNow: iso }));
  }, []);

  const value = useMemo(() => {
    return {
      state,
      hydrated,
      setCurrentUser,
      imOkay,
      logFeeling,
      logSomeoneComing,
      requestBreak,
      clearBreak,
      requestHelp,
      logMedicine,
      logWalk,
      setAway,
      setOptOutToday,
      updatePact,
      setDuty,
      setDutyOverride,
      saveVisitor,
      removeVisitor,
      updatePlaybook,
      acknowledgeAlert,
      clearAlert,
      completeStep,
      assignTask,
      completeAssignment,
      handOffAlert,
      resolveAlert,
      escalateAlert,
      runEscalationPass,
      injectQuietMiss,
      injectRing,
      ingestRingApiEvent,
      ingestPhoneSighting,
      injectVisitMissed,
      clearAllAlerts,
      resetDemo,
      setDemoNow,
    } satisfies Store;
  }, [
    state,
    hydrated,
    setCurrentUser,
    imOkay,
    logFeeling,
    logSomeoneComing,
    requestBreak,
    clearBreak,
    requestHelp,
    logMedicine,
    logWalk,
    setAway,
    setOptOutToday,
    updatePact,
    setDuty,
    setDutyOverride,
    saveVisitor,
    removeVisitor,
    updatePlaybook,
    acknowledgeAlert,
    clearAlert,
    completeStep,
    assignTask,
    completeAssignment,
    handOffAlert,
    resolveAlert,
    escalateAlert,
    runEscalationPass,
    injectQuietMiss,
    injectRing,
    ingestRingApiEvent,
    ingestPhoneSighting,
    injectVisitMissed,
    clearAllAlerts,
    resetDemo,
    setDemoNow,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function escalateInState(s: HouseholdState, alertId: string): HouseholdState {
  return {
    ...s,
    alerts: s.alerts.map((a) => {
      if (a.id !== alertId || a.status !== "open") return a;
      const at = now(s).toISOString();
      const backup = a.backupId;
      return {
        ...a,
        status: "escalated" as const,
        escalatedAt: at,
        ownerId: backup,
        timeline: [
          ...a.timeline,
          {
            id: uid("tl"),
            at,
            text: `Escalated to backup ${s.members.find((m) => m.id === backup)?.name} — on-duty did not respond`,
          },
        ],
      };
    }),
  };
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function useOptionalDerived() {
  const { state } = useStore();
  return {
    onDutyId: currentOnDuty(state),
    backupId: currentBackup(state),
    away: isAway(state),
    signedInToday: hasSignOfLife(state),
    checkedIn: checkedInToday(state),
  };
}

// silence unused import if tree-shaken oddly
export type { AlertType };
