"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { openAlerts } from "@/lib/engine";
import { isCareReceiverPath } from "@/lib/surfaces";
import { useStore } from "@/lib/store";

type Tab = {
  href: string;
  label: string;
  match?: string[];
  icon: (active: boolean) => React.ReactNode;
  badge?: number | "dot";
};

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path
        d="M8.5 12.5 11 15l4.5-5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDoor({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
      <path
        d="M4 20h16"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
      <circle cx="13.5" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconAlerts({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4a6 6 0 0 1 6 6v2.2c0 .7.2 1.4.6 2L20 16H4l1.4-1.8c.4-.6.6-1.3.6-2V10a6 6 0 0 1 6-6Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
      <path
        d="M10 18a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFamily({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="9"
        cy="8"
        r="2.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <circle
        cx="16"
        cy="9"
        r="2"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path
        d="M4.5 18c.6-2.4 2.4-3.5 4.5-3.5s3.9 1.1 4.5 3.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
      <path
        d="M13.5 18c.3-1.5 1.2-2.4 2.5-2.4 1.4 0 2.4.8 2.8 2.4"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function NavBar({
  tabs,
  wide,
  tone,
  shelf,
}: {
  tabs: Tab[];
  wide?: boolean;
  tone: "caregiver" | "receiver";
  /** Light full-width bar used on the caregiver home. */
  shelf?: boolean;
}) {
  const pathname = usePathname();
  if (shelf) {
    return (
      <nav
        className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-[#DCE5DF] bg-[rgba(255,255,255,0.96)] px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-3"
        aria-label="Caregiver"
      >
        <div className="flex items-start">
          {tabs.map((tab) => {
            const paths = tab.match ?? [tab.href];
            const active = paths.some(
              (p) =>
                pathname === p || (p !== "/" && pathname.startsWith(p + "/")),
            );
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex flex-1 flex-col items-center gap-[5px]"
              >
                <span
                  className="relative grid h-[25px] place-items-center"
                  style={{ color: active ? "#24695E" : "#536965" }}
                >
                  {tab.icon(active)}
                  {tab.badge !== undefined && tab.badge !== "dot" && (
                    <span className="absolute -right-2 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#984D30] px-1 text-[10px] font-semibold leading-none text-white">
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  )}
                </span>
                <span
                  className="text-[12px] leading-[15px]"
                  style={{
                    color: active ? "#24695E" : "#536965",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }
  return (
    <nav
      className={`fixed bottom-4 left-1/2 z-40 -translate-x-1/2 ${
        wide ? "w-[min(100%-1.5rem,36rem)]" : "w-[min(100%-1.5rem,430px)]"
      }`}
      aria-label={tone === "receiver" ? "Care receiver" : "Caregiver"}
    >
      <div
        className="flex items-stretch justify-between gap-0.5 rounded-full px-1.5 py-1.5"
        style={{
          background:
            tone === "receiver"
              ? "rgba(16, 52, 38, 0.92)"
              : "rgba(14, 16, 20, 0.88)",
          border:
            tone === "receiver"
              ? "1px solid rgba(255,255,255,0.18)"
              : "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(28px) saturate(1.3)",
          WebkitBackdropFilter: "blur(28px) saturate(1.3)",
          boxShadow: "0 14px 44px rgba(0,0,0,0.32)",
        }}
      >
        {tabs.map((tab) => {
          const paths = tab.match ?? [tab.href];
          const active = paths.some(
            (p) =>
              pathname === p || (p !== "/" && pathname.startsWith(p + "/")),
          );
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-white"
            >
              <span
                className={`relative grid place-items-center rounded-full px-3.5 py-1.5 ${
                  active ? "bg-white/18" : ""
                }`}
              >
                {tab.icon(active)}
                {tab.badge !== undefined && (
                  <span
                    className="absolute -right-0.5 -top-0.5 min-w-[16px] h-4 px-1 rounded-full grid place-items-center text-[10px] font-bold text-black"
                    style={{ background: "#25D366" }}
                  >
                    {tab.badge === "dot"
                      ? ""
                      : tab.badge > 99
                        ? "99+"
                        : tab.badge}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  active ? "text-white" : "text-white/70"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { state } = useStore();
  const alertCount = openAlerts(state).length;
  const me = state.members.find((m) => m.id === state.currentUserId);
  const initial = (me?.name ?? "Y").slice(0, 1).toUpperCase();
  const receiver = isCareReceiverPath(pathname);

  if (receiver) {
    const tabs: Tab[] = [
      {
        href: "/recipient",
        label: "My day",
        match: ["/recipient", "/home"],
        icon: (a) => <IconCheck active={a} />,
      },
      {
        href: "/doorsense",
        label: "Door",
        match: ["/doorsense"],
        icon: (a) => <IconDoor active={a} />,
      },
    ];
    return <NavBar tabs={tabs} wide tone="receiver" />;
  }

  const tabs: Tab[] = [
    {
      href: "/today",
      label: "Home",
      match: ["/", "/today"],
      icon: (a) => <IconHome active={a} />,
    },
    {
      href: "/escalation",
      label: "Alerts",
      match: ["/escalation", "/alerts"],
      icon: (a) => <IconAlerts active={a} />,
      badge: alertCount > 0 ? alertCount : undefined,
    },
    {
      href: "/assignments",
      label: "Care circle",
      icon: (a) => <IconFamily active={a} />,
    },
    {
      href: "/setup",
      label: "Settings",
      match: ["/setup", "/demo"],
      icon: () => (
        <span className="size-[22px] rounded-full bg-white/20 grid place-items-center text-[11px] font-bold">
          {initial}
        </span>
      ),
    },
  ];

  return (
    <NavBar tabs={tabs} tone="caregiver" shelf={pathname === "/today"} />
  );
}
