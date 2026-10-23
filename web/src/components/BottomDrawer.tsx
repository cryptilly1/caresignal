"use client";

import { Check, ChevronRight, X } from "lucide-react";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { initials } from "@/lib/care-setup";
import type { Member } from "@/lib/types";

export type DrawerChoice<T extends string> = { label: string; value: T; description?: string; avatar?: string };

export function memberDrawerChoice(member: Member): DrawerChoice<Member["id"]> {
  const roles: Record<Member["role"], string> = { care_lead: "Care lead", caregiver: "Caregiver", person_at_home: "Care receiver", view_only: "View only" };
  return { value: member.id, label: member.name, description: roles[member.role], avatar: initials(member.name) };
}

export function DrawerOption({ label, description, avatar, selected, onClick }: {
  label: string; description?: string; avatar?: string; selected?: boolean; onClick: () => void;
}) {
  return <button aria-pressed={selected} className={`drawer-option${avatar ? " drawer-option--member" : ""}`} onClick={onClick} type="button">
    {avatar && <span aria-hidden="true" className="drawer-option__avatar">{avatar}</span>}
    <span className="drawer-option__copy"><strong>{label}</strong>{description && <small>{description}</small>}</span>
    {selected === undefined ? <span aria-hidden="true" className="drawer-option__chevron"><ChevronRight aria-hidden="true" size={18} /></span> : <span className="drawer-option__check" aria-hidden="true">{selected ? <Check aria-hidden="true" size={14} strokeWidth={2.5} /> : null}</span>}
  </button>;
}

export function BottomDrawer({
  title, onClose, children, wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const host = anchorRef.current?.closest("main");
    if (host) setContainer(host);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !container) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const overlay = panel.parentElement;
    const siblings = [...container.children].filter(
      (node): node is HTMLElement => node instanceof HTMLElement && node !== overlay,
    );
    const inertStates = siblings.map((node) => node.inert);
    siblings.forEach((node) => { node.inert = true; });
    const selected = panel.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    (selected || panel.querySelector<HTMLButtonElement>(".drawer-option:not(:disabled), button"))?.focus();

    function handleKey(event: KeyboardEvent) {
      if (!panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary, [tabindex="0"]',
      )].filter((node) => node.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    panel.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      siblings.forEach((node, index) => { node.inert = inertStates[index]; });
      panel.removeEventListener("keydown", handleKey);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [container]);

  return (
    <>
      <span hidden ref={anchorRef} />
      {container && createPortal(
        <div className="account-sheet__backdrop choice-drawer-backdrop" onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}>
          <section aria-labelledby={titleId} aria-modal="true" className={`account-sheet choice-drawer${wide ? " choice-drawer--wide" : ""}`} ref={panelRef} role="dialog">
            <span className="choice-drawer__handle" aria-hidden="true" />
            <header className="account-sheet__header">
              <h2 id={titleId}>{title}</h2>
              <button aria-label={`Close ${title.toLowerCase()}`} className="account-sheet__close" onClick={onClose} type="button"><X aria-hidden="true" size={18} strokeWidth={2} /></button>
            </header>
            <div className="choice-drawer__content">{children}</div>
          </section>
        </div>,
        container,
      )}
    </>
  );
}

export function DrawerSelect<T extends string>({
  label, value, options, onChange, disabled = false, placeholder = "Pick an option",
}: {
  label: string;
  value: T | "";
  options: ReadonlyArray<DrawerChoice<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const valueId = useId();
  return (
    <div className="onboarding-field">
      <span id={labelId}>{label}</span>
      <button aria-labelledby={`${labelId} ${valueId}`} aria-haspopup="dialog" aria-expanded={open} className="drawer-select-trigger" disabled={disabled} onClick={() => setOpen(true)} type="button">
        <span id={valueId}>{options.find((option) => option.value === value)?.label || placeholder}</span>
      </button>
      {open && <BottomDrawer title={label} onClose={() => setOpen(false)}>
        <div className="drawer-options" role="group" aria-label={label}>
          {options.map((option) => <DrawerOption {...option} selected={value === option.value} key={option.value} onClick={() => {
            onChange(option.value);
            setOpen(false);
          }} />)}
        </div>
      </BottomDrawer>}
    </div>
  );
}

export function DurationOptions({ value, presets, onSelect, maxMinutes = 525600 }: {
  value: number;
  presets: { value: number; label: string }[];
  onSelect: (minutes: number) => void;
  maxMinutes?: number;
}) {
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState(String(value));
  const [unit, setUnit] = useState(1);
  const minutes = Number(amount) * unit;
  const valid = amount.trim() !== "" && Number.isInteger(Number(amount)) && Number(amount) > 0 && minutes <= maxMinutes;
  return <div className="drawer-options">
    {presets.map((option) => <DrawerOption label={option.label} selected={!custom && value === option.value} key={option.value} onClick={() => onSelect(option.value)} />)}
    <DrawerOption label="Custom" selected={custom} onClick={() => setCustom(true)} />
    {custom && <form className="settings-form" onSubmit={(event) => { event.preventDefault(); if (valid) onSelect(minutes); }}>
      <label className="onboarding-field"><span>Duration</span><input aria-label="Custom duration amount" type="number" min={1} max={Math.floor(maxMinutes / unit)} step={1} required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <div className="receiver-walk-times" role="group" aria-label="Duration unit">{[{ value: 1, label: "Minutes" }, { value: 60, label: "Hours" }, { value: 1440, label: "Days" }, { value: 10080, label: "Weeks" }].filter((option) => option.value <= maxMinutes).map((option) => <button aria-pressed={unit === option.value} onClick={() => setUnit(option.value)} key={option.value} type="button">{option.label}</button>)}</div>
      <p className="settings-note">Choose a whole number, up to {maxMinutes.toLocaleString()} minutes.</p>
      <button className="cs-button cs-button--primary" disabled={!valid} type="submit">Use custom time</button>
    </form>}
  </div>;
}

export function DurationSelect({ label, value, presets, onChange }: {
  label: string; value: number; presets: { value: number; label: string }[]; onChange: (minutes: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="onboarding-field">
    <span id={id}>{label}</span>
    <button aria-labelledby={`${id} ${id}-value`} aria-haspopup="dialog" aria-expanded={open} className="drawer-select-trigger" onClick={() => setOpen(true)} type="button"><span id={`${id}-value`}>{presets.find((option) => option.value === value)?.label ?? `In ${value.toLocaleString()} minutes`}</span></button>
    {open && <BottomDrawer title={label} onClose={() => setOpen(false)}><DurationOptions value={value} presets={presets} onSelect={(minutes) => { onChange(minutes); setOpen(false); }} /></BottomDrawer>}
  </div>;
}
