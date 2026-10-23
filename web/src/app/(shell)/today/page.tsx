"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CaregiverDoorAssist } from "@/components/CaregiverDoorAssist";
import { alertStatusLabel, buildMedicationBrief } from "@/lib/agents";
import { buildCareSummary } from "@/lib/agents/care-summary";
import {
  buildHomeContext,
  type HomeContextKind,
} from "@/lib/agents/home-context";
import {
  checkedInToday,
  currentBackup,
  currentOnDuty,
  feelingLabel,
  formatTime,
  hasSignOfLife,
  isAway,
  latestFeeling,
  memberById,
  now,
  openAlerts,
  quietByLabel,
  walkedToday,
} from "@/lib/engine";
import { useStore } from "@/lib/store";
import type { Alert } from "@/lib/types";

type DoorPending = {
  id: string;
  at: string;
  label: string;
  source: string;
} | null;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
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

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const I = {
  heart:
    "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  cloud:
    "M7 18h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.5 3.5 0 0 0 7 18Z",
  bell: "M12 4a5 5 0 0 0-5 5v2.2c0 .6-.2 1.2-.6 1.7L5 15h14l-1.4-2.1c-.4-.5-.6-1.1-.6-1.7V9a5 5 0 0 0-5-5ZM10 18a2 2 0 0 0 4 0",
  chevron: "M9 6l6 6-6 6",
  video: "M4 7h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM15 10l5-2v8l-5-2",
  arrow: "M7 17 17 7M9 7h8v8",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12.2 11 14.7 15.5 10",
  x: "M6 6l12 12M18 6 6 18",
  smile: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 14s1.5 2 4 2 4-2 4-2M9 10h.01M15 10h.01",
  pill: "M8.5 15.5 15.5 8.5a3.5 3.5 0 0 1 5 5l-7 7a3.5 3.5 0 0 1-5-5Z",
  feet: "M7 20c-1.2-2.2-.4-5 1-6.2.8 1.6 2 2.4 2 4.2M16 20c1.2-2.2.4-5-1-6.2-.8 1.6-2 2.4-2 4.2",
  users:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4.5 19c.7-2.4 2.4-3.5 4.5-3.5s3.8 1.1 4.5 3.5M14 19c.3-1.4 1.2-2.3 2.5-2.3 1.3 0 2.2.7 2.6 2.3",
  coffee: "M6 8h10v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8ZM16 10h2a2 2 0 0 1 0 4h-2M8 4v2M12 4v2",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  note: "M7 4h8l4 4v12H7V4ZM15 4v4h4M9 13h6M9 17h4",
  door: "M6 20V6a1 1 0 0 1 1-1h8l3 3v12M14 12h.01",
  wifi: "M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0M12 19h.01",
  battery: "M4 8h14v8H4V8ZM20 11v2",
  tablet: "M6 4h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM11 18h2",
  max: "M8 4H5v3M16 4h3v3M8 20H5v-3M16 20h3v-3",
};

function momentIcon(kind: HomeContextKind) {
  if (kind === "check_in") return I.check;
  if (kind === "feeling") return I.smile;
  if (kind === "medicine") return I.pill;
  if (kind === "walk") return I.feet;
  if (kind === "coming") return I.users;
  if (kind === "ring" || kind === "alert") return I.bell;
  return I.coffee;
}

function clockLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatTime(d);
}

export default function TodayPage() {
  const { state, acknowledgeAlert, resolveAlert, setCurrentUser } = useStore();
  const [pending, setPending] = useState<DoorPending>(null);
  const [ring, setRing] = useState<{
    online?: boolean;
    name?: string;
    lastSyncAt?: string | null;
  } | null>(null);

  useEffect(() => {
    if (state.currentUserId === "mom") setCurrentUser("alex");
  }, [setCurrentUser, state.currentUserId]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/doorsense", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { pending: DoorPending };
        if (!stop) setPending(data.pending);
      } catch {
        // ignore
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    void fetch("/api/ring/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { online?: boolean; device?: { name?: string }; lastSyncAt?: string | null } | null) => {
        if (!data) return;
        setRing({
          online: data.online,
          name: data.device?.name,
          lastSyncAt: data.lastSyncAt,
        });
      })
      .catch(() => {});
  }, []);

  const at = now(state);
  const onDuty = memberById(state, currentOnDuty(state));
  const backup = memberById(state, currentBackup(state));
  const me = memberById(state, state.currentUserId);
  const initials = (me?.name ?? "Y")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const alerts = openAlerts(state);
  const away = isAway(state);
  const ok = hasSignOfLife(state);
  const feeling = latestFeeling(state);
  const medBrief = buildMedicationBrief(state);
  const summary = buildCareSummary(state);
  const moments = buildHomeContext(state, 6);
  const timeline = buildHomeContext(state, 5);
  const doorAlert = alerts.find((a) =>
    ["unusual_door", "long_open", "night_exit", "rest_window_exit"].includes(
      a.type,
    ),
  );
  const showDoor = Boolean(pending || doorAlert);
  const life =
    away
      ? "Paused for now"
      : ok
        ? checkedInToday(state)
          ? "Checked in this morning"
          : "A sign of life today"
        : `Quiet · check-in by ${quietByLabel(state)}`;
  const attention =
    alerts.length === 0
      ? null
      : alerts.length === 1
        ? "1 thing needs a caregiver"
        : `${alerts.length} things need a caregiver`;

  return (
    <div className="cg-home">
      <div className="cg-land" aria-hidden />
      <div className="cg-veil" aria-hidden />

      <div className="cg-scroll">
        <header className="cg-nav">
          <div className="cg-brand">
            <span className="cg-mark">
              <Icon d={I.heart} size={16} />
            </span>
            <span className="cg-word">CareSignal</span>
          </div>
          <Link href="/setup" className="cg-avatar" aria-label="Your profile">
            {initials}
          </Link>
        </header>

        <section className="cg-hello">
          <p className="cg-date">
            {WEEKDAYS[at.getDay()]} · {MONTHS[at.getMonth()]} {at.getDate()}
          </p>
          <div className="cg-greet">
            <h1>{state.careRecipientName} today</h1>
            <span className="cg-sun">
              <Icon d={I.cloud} size={28} />
            </span>
          </div>
          <p className="cg-life">
            <span className="cg-dot" />
            {life}
            {feeling ? ` · ${feelingLabel(feeling.level)}` : ""}
          </p>
          {attention && <p className="cg-attn">{attention}</p>}
        </section>

        <Link href="/assignments" className="cg-duty">
          <span>
            <span className="cg-role">On duty</span>
            <span className="cg-name cg-name-teal">{onDuty?.name ?? "—"}</span>
          </span>
          <span>
            <span className="cg-role">Backup</span>
            <span className="cg-name">{backup?.name ?? "—"}</span>
          </span>
          <Icon d={I.chevron} size={17} />
        </Link>

        <div className="cg-stack">
          {showDoor && (
            <article className="cg-card cg-door">
              <div className="cg-row">
                <p className="cg-kicker">
                  <Icon d={I.bell} size={16} />
                  DoorSense · needs you
                </p>
                <span className="cg-muted">
                  {clockLabel(pending?.at ?? doorAlert?.createdAt ?? "")}
                </span>
              </div>
              <div>
                <h2 className="cg-card-title">
                  {pending ? "Mom requested door help" : doorAlert?.title}
                </h2>
                <p className="cg-sub">
                  {pending?.label ??
                    doorAlert?.summary ??
                    "Front door needs a look."}
                </p>
              </div>
              <div className="cg-cam">
                <div
                  className="cg-cam-img"
                  style={{
                    backgroundImage: "url(/tv/front-door-visitor.jpg)",
                  }}
                />
                <div className="cg-cam-scrim" />
                <div className="cg-cam-top">
                  <span className="cg-live">
                    <span />
                    Live
                  </span>
                  <span className="cg-max" aria-hidden>
                    <Icon d={I.max} size={16} />
                  </span>
                </div>
                <p className="cg-cam-label">Front door · only you are viewing</p>
              </div>
              <Link href="/today#door-live" className="cg-primary">
                <Icon d={I.video} size={18} />
                Open live view
              </Link>
              <div className="cg-row">
                <span className="cg-own">
                  {doorAlert
                    ? `${memberById(state, doorAlert.ownerId)?.name ?? "Family"} owns this`
                    : "Waiting for a caregiver"}
                </span>
                {doorAlert && (
                  <Link href={`/alerts/${doorAlert.id}`} className="cg-link">
                    Open alert <Icon d={I.arrow} size={14} />
                  </Link>
                )}
              </div>
              <p className="cg-fine">
                Escalates to {backup?.name ?? "backup"} if no one takes it.
              </p>
              <div id="door-live">
                <CaregiverDoorAssist hideIdle />
              </div>
            </article>
          )}

          <section className="cg-block">
            <div className="cg-row">
              <h2 className="cg-h">Care alerts</h2>
              <Link href="/escalation" className="cg-link">
                View all
              </Link>
            </div>
            {alerts.length === 0 ? (
              <div className="cg-card cg-empty">Quiet day. No open alerts.</div>
            ) : (
              alerts.slice(0, 2).map((a) => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  owner={memberById(state, a.ownerId)?.name ?? "Family"}
                  onOwn={() => acknowledgeAlert(a.id)}
                  onClear={() =>
                    resolveAlert(a.id, "resolved_fine", "Cleared from home")
                  }
                />
              ))
            )}
            <p className="cg-fine">
              Take ownership so the family knows who is handling it. Clear only
              when it does not need follow-through.
            </p>
          </section>

          <section className="cg-block">
            <div className="cg-row">
              <h2 className="cg-h">{state.careRecipientName}’s daily log</h2>
              <Link href="/summary" className="cg-link">
                View
              </Link>
            </div>
            <div className="cg-card cg-log">
              {moments.length === 0 ? (
                <p className="cg-empty-inline">Nothing logged yet today.</p>
              ) : (
                moments.map((m, i) => (
                  <div key={m.id}>
                    <div className="cg-moment">
                      <span className="cg-micon">
                        <Icon d={momentIcon(m.kind)} size={18} />
                      </span>
                      <span className="cg-mtext">
                        <span className="cg-mt">{m.text}</span>
                        <span className="cg-md">{m.source}</span>
                      </span>
                      <span className="cg-time">{clockLabel(m.at)}</span>
                    </div>
                    {i < moments.length - 1 && <div className="cg-div" />}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="cg-block">
            <div className="cg-row">
              <h2 className="cg-h">Medicine today</h2>
              <Link href="/summary" className="cg-link">
                Details
              </Link>
            </div>
            <div className="cg-card cg-pad">
              <div className="cg-row">
                <p className="cg-progress">
                  {medBrief.totalCount === 0
                    ? "No doses today"
                    : `${medBrief.takenCount} of ${medBrief.totalCount} logged`}
                </p>
                <span
                  className={
                    medBrief.overdueCount > 0 ? "cg-chip cg-chip-hot" : "cg-chip"
                  }
                >
                  {medBrief.overdueCount > 0
                    ? "Overdue"
                    : medBrief.takenCount === medBrief.totalCount &&
                        medBrief.totalCount > 0
                      ? "On track"
                      : "In progress"}
                </span>
              </div>
              {medBrief.totalCount > 0 && (
                <div className="cg-bars">
                  {medBrief.slots.map((s) => (
                    <span
                      key={`${s.medicineId}-${s.timeSlot}`}
                      className={s.status === "taken" ? "on" : ""}
                    />
                  ))}
                </div>
              )}
              {medBrief.slots.slice(0, 3).map((s) => (
                <div key={`${s.medicineId}-${s.timeSlot}`} className="cg-dose">
                  <span className={s.status === "taken" ? "cg-teal" : "cg-mute"}>
                    <Icon d={s.status === "taken" ? I.check : I.clock} size={18} />
                  </span>
                  <span className="cg-mtext">
                    <span className="cg-mt">
                      {s.name} · {s.timeSlot}
                    </span>
                    <span className="cg-md">{s.dose}</span>
                  </span>
                  <span className={s.status === "taken" ? "cg-teal" : "cg-mute"}>
                    {s.status === "taken"
                      ? "Done"
                      : s.status === "overdue"
                        ? "Late"
                        : "Due"}
                  </span>
                </div>
              ))}
              <p className="cg-fine">{medBrief.caregiverNote}</p>
            </div>
          </section>

          <section className="cg-summary">
            <p className="cg-sum-h">
              <Icon d={I.note} size={18} />
              Care summary
            </p>
            <p className="cg-sum-body">{summary.paragraphs[0]}</p>
            <p className="cg-sum-next">
              {summary.openAlertCount > 0
                ? `${summary.openAlertCount} open · stay with the family until someone owns them.`
                : walkedToday(state)
                  ? "Walk is logged. Evening medicine is the next check."
                  : "Next: Mom’s check-in, then evening medicine."}
            </p>
            <p className="cg-fine">Rules digest · not a diagnosis</p>
          </section>

          <section className="cg-block">
            <div className="cg-row">
              <h2 className="cg-h">Household activity</h2>
              <Link href="/summary" className="cg-link">
                View all
              </Link>
            </div>
            <div className="cg-card cg-pad">
              {timeline.length === 0 ? (
                <p className="cg-empty-inline">No household events yet today.</p>
              ) : (
                timeline.map((line, i) => (
                  <div key={line.id} className="cg-tl">
                    <span className="cg-time">{clockLabel(line.at)}</span>
                    <span className="cg-rail">
                      <span
                        className={
                          line.kind === "alert" || line.kind === "ring"
                            ? "cg-pip hot"
                            : "cg-pip"
                        }
                      />
                      {i < timeline.length - 1 && <span className="cg-stem" />}
                    </span>
                    <span className="cg-mtext">
                      <span className="cg-mt">{line.text}</span>
                      <span className="cg-md">{line.source}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="cg-block">
            <div className="cg-row">
              <h2 className="cg-h">Front door</h2>
              <Link href="/demo" className="cg-link">
                Ring
              </Link>
            </div>
            <div className="cg-card cg-pad">
              <div className="cg-device">
                <span className="cg-dicon">
                  <Icon d={I.door} size={20} />
                </span>
                <span className="cg-mtext">
                  <span className="cg-mt">{ring?.name ?? "Front door"}</span>
                  <span className="cg-md">Ring · DoorSense</span>
                </span>
                <span className={ring?.online === false ? "cg-chip cg-chip-hot" : "cg-chip"}>
                  {ring?.online === false ? "Offline" : "Live"}
                </span>
              </div>
              <div className="cg-div" />
              <div className="cg-row cg-health">
                <span>
                  <Icon d={I.wifi} size={15} /> Wi-Fi{" "}
                  {ring?.online === false ? "weak" : "strong"}
                </span>
                <span>
                  <Icon d={I.battery} size={15} /> Battery steady
                </span>
              </div>
              <p className="cg-sub">
                Motion and doorbells land here. Mom can answer on the TV or
                tablet without anyone watching all day.
              </p>
              <p className="cg-fine">
                {ring?.lastSyncAt
                  ? `Last sync ${clockLabel(ring.lastSyncAt)}`
                  : "Waiting for the next Ring sync"}
              </p>
            </div>
          </section>

          <Link href="/recipient" className="cg-tablet">
            <Icon d={I.tablet} size={22} />
            <span className="cg-mtext">
              <span className="cg-mt">Mom’s tablet</span>
              <span className="cg-md">The cards she sees today</span>
            </span>
            <Icon d={I.chevron} size={18} />
          </Link>

          <p className="cg-reassure">
            <Icon d={I.heart} size={14} />
            Care stays with the family
          </p>
        </div>
      </div>

      <style jsx global>{`
        .cg-home {
          position: relative;
          min-height: 100vh;
          color: #183d3b;
          font-family:
            Inter,
            "SF Pro Text",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif;
        }
        .cg-land {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(90% 42% at 78% 12%, rgba(255, 214, 168, 0.72), transparent 58%),
            radial-gradient(70% 36% at 12% 28%, rgba(196, 214, 196, 0.55), transparent 60%),
            radial-gradient(80% 28% at 50% 78%, rgba(47, 109, 102, 0.45), transparent 70%),
            linear-gradient(180deg, #f6e7d4 0%, #e7efe4 34%, #b7d0c6 58%, #3e7a72 100%);
        }
        .cg-veil {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(250, 247, 239, 0.8) 0%,
            rgba(244, 247, 239, 0.75) 50%,
            rgba(229, 239, 233, 0.92) 100%
          );
        }
        .cg-scroll {
          position: relative;
          z-index: 1;
          padding-bottom: 108px;
        }
        .cg-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 60px;
          padding: 10px 24px;
        }
        .cg-brand {
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .cg-mark {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border-radius: 11px;
          background: #24695e;
          color: #fff;
        }
        .cg-word {
          font-size: 21px;
          line-height: 25px;
          color: #183d3b;
        }
        .cg-avatar {
          display: grid;
          width: 40px;
          height: 40px;
          place-items: center;
          border-radius: 100px;
          background: rgba(255, 255, 255, 0.8);
          color: #24695e;
          font-size: 14px;
          font-weight: 600;
        }
        .cg-hello {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px 24px 18px;
        }
        .cg-date {
          margin: 0;
          font-size: 12px;
          font-weight: 500;
          color: #24695e;
        }
        .cg-greet {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .cg-greet h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 600;
          line-height: 39px;
          letter-spacing: -0.03em;
        }
        .cg-sun {
          color: #24695e;
        }
        .cg-life {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 14px;
        }
        .cg-dot {
          width: 8px;
          height: 8px;
          border-radius: 99px;
          background: #24695e;
        }
        .cg-attn {
          margin: 0;
          font-size: 14px;
          line-height: 1.4;
          color: #984d30;
        }
        .cg-duty {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 0 20px 20px;
          padding: 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.85);
          color: inherit;
          text-decoration: none;
        }
        .cg-duty > span {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 3px;
        }
        .cg-role {
          font-size: 12px;
          color: #536965;
        }
        .cg-name {
          font-size: 15px;
          font-weight: 600;
        }
        .cg-name-teal {
          color: #24695e;
        }
        .cg-duty svg {
          color: #24695e;
        }
        .cg-stack {
          display: flex;
          flex-direction: column;
          gap: 28px;
          padding: 0 20px 24px;
        }
        .cg-block {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cg-h {
          margin: 0;
          font-size: 21px;
          font-weight: 600;
          line-height: 25px;
        }
        .cg-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .cg-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #24695e;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
        }
        .cg-card {
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 6px 24px rgba(36, 76, 57, 0.06);
        }
        .cg-door {
          display: flex;
          flex-direction: column;
          gap: 13px;
          padding: 18px;
          border: 1px solid #e8c4a7;
        }
        .cg-kicker {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 0;
          color: #984d30;
          font-size: 12px;
          font-weight: 600;
        }
        .cg-muted,
        .cg-fine,
        .cg-sub,
        .cg-md {
          color: #536965;
        }
        .cg-muted,
        .cg-fine {
          font-size: 12px;
        }
        .cg-fine {
          margin: 0;
          line-height: 1.4;
        }
        .cg-card-title {
          margin: 0;
          font-size: 23px;
          font-weight: 600;
          line-height: 28px;
        }
        .cg-sub {
          margin: 4px 0 0;
          font-size: 14px;
          line-height: 1.45;
        }
        .cg-cam {
          position: relative;
          height: 190px;
          overflow: hidden;
          border-radius: 14px;
        }
        .cg-cam-img {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
        }
        .cg-cam-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(16, 45, 58, 0.19) 0%,
            rgba(16, 45, 58, 0) 45%,
            rgba(16, 45, 58, 0.67) 100%
          );
        }
        .cg-cam-top {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          padding: 12px;
        }
        .cg-live {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 23px;
          padding: 0 8px;
          border-radius: 8px;
          background: rgba(24, 61, 59, 0.9);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
        }
        .cg-live span {
          width: 6px;
          height: 6px;
          border-radius: 99px;
          background: #c5e2c0;
        }
        .cg-max {
          display: grid;
          width: 30px;
          height: 30px;
          place-items: center;
          border-radius: 8px;
          background: rgba(24, 61, 59, 0.6);
          color: #fff;
        }
        .cg-cam-label {
          position: absolute;
          left: 12px;
          bottom: 12px;
          z-index: 1;
          margin: 0;
          padding: 4px 7px;
          border-radius: 6px;
          background: rgba(24, 61, 59, 0.8);
          color: #fff;
          font-size: 12px;
          font-weight: 500;
        }
        .cg-primary {
          display: flex;
          height: 50px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 14px;
          background: #24695e;
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
        }
        .cg-own {
          color: #984d30;
          font-size: 13px;
        }
        .cg-empty,
        .cg-pad {
          padding: 18px;
        }
        .cg-empty,
        .cg-empty-inline {
          color: #536965;
          font-size: 14px;
        }
        .cg-alert {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 18px;
        }
        .cg-chip {
          display: inline-flex;
          padding: 5px 10px;
          border-radius: 100px;
          background: #e7f0e9;
          color: #24695e;
          font-size: 12px;
          font-weight: 600;
        }
        .cg-chip-hot {
          background: #fcf0e5;
          color: #984d30;
        }
        .cg-at {
          margin: 0;
          font-size: 17px;
          font-weight: 600;
          line-height: 21px;
        }
        .cg-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cg-own-btn {
          display: flex;
          height: 44px;
          flex: 1;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 10px;
          background: #e7f0e9;
          color: #24695e;
          font-size: 14px;
          font-weight: 600;
        }
        .cg-clear {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 0;
          background: transparent;
          color: #536965;
          font-size: 14px;
        }
        .cg-log {
          padding: 6px 18px;
        }
        .cg-moment,
        .cg-dose,
        .cg-device {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cg-moment {
          padding: 14px 0;
        }
        .cg-micon,
        .cg-dicon {
          display: grid;
          flex-shrink: 0;
          place-items: center;
          border-radius: 12px;
          background: #e7f0e9;
          color: #24695e;
        }
        .cg-micon {
          width: 36px;
          height: 40px;
        }
        .cg-dicon {
          width: 44px;
          height: 48px;
          border-radius: 14px;
        }
        .cg-mtext {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          gap: 3px;
        }
        .cg-mt {
          font-size: 15px;
          font-weight: 500;
          line-height: 1.25;
        }
        .cg-md {
          font-size: 13px;
          line-height: 1.4;
        }
        .cg-time {
          flex-shrink: 0;
          color: #536965;
          font-size: 12px;
        }
        .cg-div {
          height: 1px;
          background: #dce5df;
        }
        .cg-progress {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        .cg-bars {
          display: flex;
          gap: 6px;
          margin: 16px 0;
        }
        .cg-bars span {
          height: 6px;
          flex: 1;
          border-radius: 4px;
          background: #e7f0e9;
        }
        .cg-bars span.on {
          background: #24695e;
        }
        .cg-dose {
          margin-bottom: 12px;
        }
        .cg-teal {
          color: #24695e;
          font-size: 13px;
          font-weight: 500;
        }
        .cg-mute {
          color: #536965;
          font-size: 13px;
        }
        .cg-summary {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.85);
          border-radius: 24px;
          background: rgba(231, 240, 233, 0.95);
        }
        .cg-sum-h {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          color: #24695e;
          font-size: 19px;
          font-weight: 600;
        }
        .cg-sum-h svg {
          color: #24695e;
        }
        .cg-sum-body {
          margin: 0;
          font-size: 15px;
          line-height: 1.45;
        }
        .cg-sum-next {
          margin: 0;
          color: #24695e;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.5;
        }
        .cg-tl {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .cg-rail {
          display: flex;
          width: 10px;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .cg-pip {
          width: 8px;
          height: 8px;
          border-radius: 99px;
          background: #a1bbb0;
        }
        .cg-pip.hot {
          background: #984d30;
        }
        .cg-stem {
          width: 1px;
          height: 48px;
          background: #dce5df;
        }
        .cg-tl .cg-mtext {
          padding-bottom: 16px;
        }
        .cg-health {
          margin: 14px 0;
          color: #536965;
          font-size: 13px;
        }
        .cg-health span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #24695e;
        }
        .cg-health span {
          color: #536965;
        }
        .cg-tablet {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.8);
          color: inherit;
          text-decoration: none;
        }
        .cg-tablet > svg {
          color: #24695e;
        }
        .cg-reassure {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin: 0;
          color: #536965;
          font-size: 12px;
        }
        .cg-reassure svg {
          color: #24695e;
        }
      `}</style>
    </div>
  );
}

function AlertCard({
  alert,
  owner,
  onOwn,
  onClear,
}: {
  alert: Alert;
  owner: string;
  onOwn: () => void;
  onClear: () => void;
}) {
  const owned = alert.status === "acknowledged";
  return (
    <article className="cg-card cg-alert">
      <div className="cg-row">
        <span className={owned ? "cg-chip" : "cg-chip cg-chip-hot"}>
          {owned ? `${owner} is on it` : alertStatusLabel(alert.status)}
        </span>
        <span className="cg-time">{clockLabel(alert.createdAt)}</span>
      </div>
      <Link href={`/alerts/${alert.id}`} className="cg-at">
        {alert.title}
      </Link>
      <p className="cg-sub">{alert.summary}</p>
      <div className="cg-actions">
        {owned ? (
          <Link href={`/alerts/${alert.id}`} className="cg-own-btn">
            Open
          </Link>
        ) : (
          <button type="button" className="cg-own-btn" onClick={onOwn}>
            Take ownership
          </button>
        )}
        <button type="button" className="cg-clear" onClick={onClear}>
          <Icon d={I.x} size={14} />
          Clear
        </button>
      </div>
    </article>
  );
}
