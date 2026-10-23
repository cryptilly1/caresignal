"use client";

import { X } from "lucide-react";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { caregiverLabel, initials, recipientLabel, type CareSetup, type SetupMember } from "@/lib/care-setup";
import { BottomDrawer, DrawerSelect } from "./BottomDrawer";

const contacts = [
  { id: "mark", name: "Mark Doe", email: "mark.doe@example.com" },
  { id: "jasmine", name: "Jasmine Smith", email: "jasmine.smith@example.com" },
  { id: "alan", name: "Alan Turing", email: "alan.turing@example.com" },
  { id: "laura", name: "Laura Roberts", email: "laura.roberts@example.com" },
  { id: "quinn", name: "Quinn Taylor", email: "quinn.taylor@example.com" },
];

export function CareNotice({ children, devices = false }: { children: ReactNode; devices?: boolean }) {
  return (
    <div className="onboarding-reassurance">
      <span className="onboarding-reassurance__lock" aria-hidden="true">
        <Image alt="" src={`/images/care-circle/${devices ? "devices" : "clock"}.png`} width={devices ? 20 : 24} height={devices ? 29 : 24} />
      </span>
      <p>{children}</p>
    </div>
  );
}

export function MemberRow({
  member, children, muted = false,
}: {
  member: Pick<SetupMember, "name" | "email">;
  children?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={`care-member${muted ? " care-member--pending" : ""}`}>
      <span className="care-member__avatar" aria-hidden="true">{initials(member.name)}</span>
      <span className="care-member__details">
        <strong>{member.name}</strong>
        <small>{member.email}</small>
      </span>
      {children}
    </div>
  );
}

export function InvitedMembers({
  members, editing, onEdit, onRemove, onResend, ready = false,
}: {
  members: SetupMember[];
  editing?: boolean;
  onEdit: () => void;
  onRemove?: (id: string) => void;
  onResend?: (member: SetupMember) => void;
  ready?: boolean;
}) {
  const pending = members.filter((member) => member.status === "pending");
  return (
    <section className="care-card care-invited" aria-label="Invited care team members">
      <div className="care-card__heading care-card__heading--divider">
        <h2>Care team member invited</h2>
        <button className="care-text-button care-text-button--red" onClick={onEdit} type="button">{ready ? "Manage" : editing ? "Done" : "Edit"}</button>
      </div>
      {pending.length === 0 && <p className="care-muted">No invitations yet. Add someone when you’re ready.</p>}
      {pending.map((member) => (
        <MemberRow key={member.id} member={member} muted>
          {editing && onRemove ? (
            <button aria-label={`Remove invitation for ${member.name}`} className="care-chip care-chip--remove" onClick={() => onRemove(member.id)} type="button">Remove</button>
          ) : ready ? (
            <span className="care-chip">Pending</span>
          ) : (
            <button aria-label={`Resend invitation to ${member.name}`} className="care-chip" onClick={() => onResend?.(member)} type="button">Resend Invite</button>
          )}
        </MemberRow>
      ))}
    </section>
  );
}

export function InviteMembers({
  members, onChange, onMessage,
}: {
  members: SetupMember[];
  onChange: (members: SetupMember[]) => void;
  onMessage: (message: string) => void;
}) {
  const [tab, setTab] = useState<"members" | "contacts">("members");
  const [showInviteMethods, setShowInviteMethods] = useState(members.length === 0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<"" | SetupMember["access"]>("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  function addMember(name: string, address: string, memberAccess: SetupMember["access"]) {
    if (members.some((member) => member.email.toLowerCase() === address.toLowerCase())) {
      onMessage("This person already has a local demo invitation. No email was sent.");
      return false;
    }
    onChange([...members, {
      id: crypto.randomUUID(), name, email: address, access: memberAccess, status: "pending",
    }]);
    setShowInviteMethods(false);
    onMessage("Demo invitation added. Finish Setup to save it on this device. No email was sent.");
    return true;
  }

  return (
    <div className="care-stack">
      <div className="onboarding-segmented" aria-label="Invite method" role="group">
        <button aria-pressed={tab === "members"} onClick={() => setTab("members")} type="button">Add members</button>
        <button aria-pressed={tab === "contacts"} onClick={() => setTab("contacts")} type="button">Invite from Contacts</button>
      </div>
      {tab === "members" && (formOpen ? (
        <form className="care-card care-invite-form" onSubmit={(event) => {
          event.preventDefault();
          const name = username.trim().replace(/^@/, "");
          if (!name || !email.trim() || !access) {
            setError("Enter a username, email, and access level.");
            return;
          }
          if (addMember(name, email.trim(), access)) {
            setUsername(""); setEmail(""); setAccess(""); setError(""); setFormOpen(false);
          }
        }}>
          <div className="care-card__heading">
            <h2>Care team member</h2>
            <button aria-label="Close member invitation" className="care-close" onClick={() => { setFormOpen(false); setError(""); }} type="button"><X aria-hidden="true" size={18} strokeWidth={2} /></button>
          </div>
          <label className="onboarding-field">
            <span>Username</span>
            <input autoComplete="off" autoFocus onChange={(event) => setUsername(event.target.value)} placeholder="@JamieMorgan" required value={username} />
          </label>
          <label className="onboarding-field">
            <span>Email for invitation</span>
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="jamie@example.com" required type="email" value={email} />
          </label>
          <DrawerSelect<SetupMember["access"]> label="Access Level" onChange={setAccess} placeholder="Choose access level" value={access} options={[{ value: "member", label: "Care team member" }, { value: "lead", label: "Care lead" }]} />
          <p className="care-body-copy">{access === "lead" ? "Can manage care circle access, settings and connections." : "Can share tasks and take duty or backup shifts. Can’t change care circle access or connections."}</p>
          {error && <p className="care-error" role="alert">{error}</p>}
          <button className="cs-button cs-button--primary care-inline-button" type="submit">Send Invite</button>
        </form>
      ) : showInviteMethods ? (
        <section className="onboarding-invite-card" aria-label="Ways to invite your care team">
          <button className="onboarding-invite-action" onClick={() => setFormOpen(true)} type="button"><span aria-hidden="true" className="invite-icon invite-icon--person" />Invite using username or email</button>
          <button className="onboarding-invite-action" onClick={() => onMessage("Invite links are not connected yet. You can preview a local invitation using username or email.")} type="button"><span aria-hidden="true" className="invite-icon invite-icon--link" />Invite using link</button>
          <span className="onboarding-invite-divider" />
          <button className="onboarding-invite-action" onClick={() => onMessage("Invite sharing is not connected yet. No link has been shared.")} type="button"><span aria-hidden="true" className="invite-icon invite-icon--share" />Share invite link</button>
        </section>
      ) : (
        <button className="cs-button cs-button--glass care-add-member" onClick={() => setFormOpen(true)} type="button">
          <Image alt="" src="/images/care-circle/plus.svg" width={20} height={20} /> Add a team member
        </button>
      ))}
      {tab === "contacts" && (
        <section className="care-card care-contacts" aria-label="Demo contacts">
          <label className="care-search">
            <span className="care-search__icon" aria-hidden="true" />
            <input aria-label="Search demo contacts" onChange={(event) => setQuery(event.target.value)} placeholder="Search" ref={searchRef} type="search" value={query} />
          </label>
          {contacts.filter((contact) => `${contact.name} ${contact.email}`.toLowerCase().includes(query.toLowerCase())).map((contact) => {
            const invited = members.some((member) => member.email.toLowerCase() === contact.email.toLowerCase());
            return (
              <MemberRow key={contact.id} member={contact}>
                <button aria-label={`${invited ? "Resend invitation to" : "Invite"} ${contact.name}`} className={`care-chip${invited ? "" : " care-chip--blue"}`} onClick={() => addMember(contact.name, contact.email, "member")} type="button">{invited ? "Resend Invite" : "Invite"}</button>
              </MemberRow>
            );
          })}
          {!contacts.some((contact) => `${contact.name} ${contact.email}`.toLowerCase().includes(query.toLowerCase())) && <p className="care-muted">No matching contacts.</p>}
        </section>
      )}
      {(!showInviteMethods || members.length > 0) && <InvitedMembers members={members} editing={editing} onEdit={() => setEditing(!editing)} onRemove={(id) => onChange(members.filter((member) => member.id !== id))} onResend={(member) => onMessage(`Demo invitation for ${member.name} is still pending. No email was sent.`)} />}
      <CareNotice>Pending members can’t see care activity or take duty until they accept their invitation.</CareNotice>
    </div>
  );
}

export function SetupSelect({
  label, value, options, onChange, disabled = false,
}: {
  label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  return (
    <DrawerSelect disabled={disabled} label={label} onChange={onChange} value={value} options={options.map((option) => ({ label: option, value: option }))} />
  );
}

type SetupStepProps = {
  setup: CareSetup;
  onChange: (patch: Partial<CareSetup>) => void;
};

export function DutyPlan({ setup, onChange }: SetupStepProps) {
  const [choosingBackup, setChoosingBackup] = useState(false);
  const [draftBackupIds, setDraftBackupIds] = useState<string[]>([]);
  const backups = setup.members.filter((member) => setup.backupIds.includes(member.id));
  const joined = backups.filter((member) => member.status === "joined");
  const pending = backups.filter((member) => member.status === "pending");
  return (
    <div className="care-stack">
      <section className="care-card">
        <h2>First responder on duty</h2>
        <MemberRow member={{ name: caregiverLabel(setup), email: "Care lead" }}><span className="care-chip care-chip--blue">You</span></MemberRow>
        <SetupSelect label="Care shift" value={setup.dutyShift} options={["10:00 AM - 6:00 PM", "6:00 AM - 2:00 PM", "2:00 PM - 10:00 PM", "All day"]} onChange={(dutyShift) => onChange({ dutyShift, dutyEnabled: true })} />
        <SetupSelect label="Repeat" value={setup.dutyRepeat} options={["Every day", "Weekdays", "Weekends"]} onChange={(dutyRepeat) => onChange({ dutyRepeat, dutyEnabled: true })} />
        <p className="care-body-copy">Can share tasks and take duty or backup shifts. Can’t change care circle access or connections.</p>
      </section>
      <section className="care-card care-backup-card">
        <h2>{joined.length ? "Backup responder on duty" : "Choose a backup"}</h2>
        {joined.map((member) => <MemberRow key={member.id} member={member}><span className="care-chip">Added</span></MemberRow>)}
        <p className="care-body-copy">{joined.length ? "Can share tasks and take duty or backup shifts. Can’t change care circle access or connections." : "A backup is asked to help if the person on duty can’t respond."}</p>
        <button className="cs-button cs-button--primary care-inline-button" onClick={() => { setDraftBackupIds(setup.backupIds); setChoosingBackup(true); }} type="button" aria-haspopup="dialog" aria-expanded={choosingBackup}>
          <Image alt="" src="/images/care-circle/backup-plus.svg" height={20} width={20} /> Add a team member as backup
        </button>
        {choosingBackup && (
          <BottomDrawer title="Add member as backup" onClose={() => setChoosingBackup(false)}>
          <div className="care-backup-picker">
            <p className="care-body-copy">Care team member invited</p>
            <div className="care-backup-options">
              {setup.members.map((member) => {
                const selected = draftBackupIds.includes(member.id);
                return (
                  <button aria-pressed={selected} aria-label={`${member.name}, ${member.email}`} className="care-backup-option" key={member.id} onClick={() => setDraftBackupIds((ids) => selected ? ids.filter((id) => id !== member.id) : [...ids, member.id])} type="button">
                    <MemberRow member={member} muted>
                      <span className="care-backup-check">{selected && <Image alt="" src="/images/care-circle/backup-check.svg" width={24} height={24} />}</span>
                    </MemberRow>
                  </button>
                );
              })}
              {!setup.members.length && <p className="care-muted">No invited members yet. Go back to invite your care team first.</p>}
            </div>
            <div className="care-backup-picker__actions">
              <p className="care-body-copy">By continuing, I agree to the terms and conditions.</p>
              <button className="cs-button cs-button--primary care-inline-button" disabled={!setup.members.length} onClick={() => { onChange({ backupIds: draftBackupIds }); setChoosingBackup(false); }} type="button">{draftBackupIds.length ? "Add members" : setup.backupIds.length ? "Save changes" : "Add members"}</button>
            </div>
          </div>
          </BottomDrawer>
        )}
        {pending.length > 0 && <div className="onboarding-invite-divider" />}
        {pending.map((member) => <MemberRow key={member.id} member={{ name: member.name, email: "Available to choose after joining" }}><span className="care-chip care-chip--pending">Pending</span></MemberRow>)}
      </section>
      <CareNotice>{joined.length ? `${joined.map((member) => member.name).join(", ")} ${joined.length === 1 ? "is" : "are"} selected as your backup.` : pending.length ? "Your selected backups are pending. Only you can respond until they join your care circle." : "Without a backup, only you can respond. You can add members as backup later when they join your care circle."}</CareNotice>
    </div>
  );
}

export function CheckInPlan({ setup, onChange }: SetupStepProps) {
  return (
    <div className="care-stack">
      <section className="care-card">
        <div className="care-card__heading">
          <div className="care-check-in-title"><Image alt="" src="/images/care-circle/alarm.png" height={48} width={48} /><h2>Daily check-in</h2></div>
          <button aria-checked={setup.checkInEnabled} aria-label="Daily check-in" className="care-switch" onClick={() => onChange({ checkInEnabled: !setup.checkInEnabled })} role="switch" type="button"><span /></button>
        </div>
        <SetupSelect disabled={!setup.checkInEnabled} label="Reminder time" value={setup.checkInTime} options={["8:00 AM", "9:00 AM", "10:00 AM", "12:00 PM", "6:00 PM", "8:00 PM"]} onChange={(checkInTime) => onChange({ checkInTime })} />
        <SetupSelect disabled={!setup.checkInEnabled} label="Repeat" value={setup.checkInRepeat} options={["Every day", "Weekdays", "Weekends"]} onChange={(checkInRepeat) => onChange({ checkInRepeat })} />
        <p className="care-body-copy">Uses {recipientLabel(setup)}’s local time. No medical questions or daily forms.</p>
      </section>
      <CareNotice>Reminders start only after care receiver connects and agrees. Care receiver can change them or turn them off.</CareNotice>
    </div>
  );
}

export function HouseholdReview({ setup, onEdit }: { setup: CareSetup; onEdit: (step: 1 | 2 | 3 | 4 | 5 | 6) => void }) {
  const backups = setup.members.filter((member) => setup.backupIds.includes(member.id));
  const icons: Record<string, string> = { Sun: "sun-icon.svg", Flower: "flower.svg", Bird: "bird.svg", Leaf: "leaf.svg" };
  const colors: Record<string, string> = { Amber: "#f3d7a2", Sage: "#cfdfd1", Lilac: "#e5dff1", Rose: "#f1dbd6" };
  return (
    <div className="care-stack">
      <section className="care-card care-review">
        <div className="care-card__heading"><h2>{recipientLabel(setup)}’s care circle</h2><button className="care-text-button" onClick={() => onEdit(2)} type="button">Edit</button></div>
        <div className="care-member">
          <span className="care-member__avatar" style={{ background: colors[setup.profileColor] || colors.Amber }}><Image alt="" src={`/images/onboarding/${icons[setup.profileIcon] || icons.Sun}`} height={26} width={26} /></span>
          <span className="care-member__details"><strong>{setup.recipientName || recipientLabel(setup)}</strong><small>{setup.relationship || "Care recipient"}</small></span>
        </div>
        <ReviewSection icon="person" title="Care team" onManage={() => onEdit(4)}>
          <strong>{caregiverLabel(setup)} · care lead</strong>
          <MemberRow member={{ name: setup.caregiverName || caregiverLabel(setup), email: "Care lead" }}><span className="care-chip care-chip--blue">You</span></MemberRow>
          {setup.members.length > 0 && <strong>Invited members · backup</strong>}
          {setup.members.map((member) => <MemberRow key={member.id} member={member} muted={member.status === "pending"}><span className={`care-chip${member.status === "pending" ? " care-chip--pending" : ""}`}>{member.status === "pending" ? "Pending" : "Joined"}</span></MemberRow>)}
          {!setup.members.some((member) => member.status === "joined") && <p className="care-muted">No other members have joined.</p>}
        </ReviewSection>
        <ReviewSection icon="shield" title="Starting duty plan" onManage={() => onEdit(5)}>
          <strong>{setup.dutyEnabled ? `You · ${setup.dutyShift}` : "No duty plan set yet"}</strong>
          {setup.dutyEnabled && <strong>{setup.dutyRepeat}</strong>}
          {backups.length ? backups.map((member) => <p className="care-muted" key={member.id}>{member.name} · {member.status === "pending" ? "backup pending — available after joining" : "backup"}</p>) : <p className="care-muted">No backup yet. Add one from your invited members.</p>}
        </ReviewSection>
        <ReviewSection icon="clock" title="Daily check-in" onManage={() => onEdit(6)}>
          <strong>{setup.checkInEnabled ? `${setup.checkInRepeat} · ${setup.checkInTime}` : "No reminders set yet"}</strong>
          <p className="care-muted">{setup.checkInEnabled ? `Suggested only. Starts after ${recipientLabel(setup)} connects and agrees.` : "You can set a check-in time later."}</p>
        </ReviewSection>
      </section>
      <CareNotice devices>No devices connected. You can explore Ring and other devices later.</CareNotice>
    </div>
  );
}

function ReviewSection({ icon, title, children, onManage }: { icon: string; title: string; children: ReactNode; onManage: () => void }) {
  return (
    <section className="care-review-section">
      <div className="care-card__heading"><h3><Image alt="" src={`/images/care-circle/${icon}.png`} height={18} width={icon === "shield" ? 16 : 18} />{title}</h3><button aria-label={`Manage ${title.toLowerCase()}`} className="care-text-button" onClick={onManage} type="button">Manage</button></div>
      <div className="care-review-section__content">{children}</div>
    </section>
  );
}
