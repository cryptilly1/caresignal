# CareSignal — Screen list (design)

One product. Full care system. Screens grouped by role, then by shared flows.

**Design bar:** large type for person at home; calm caregiver UI (not a SOC dashboard); one primary action per alert.

---

## A. Person at home

| ID | Screen | Purpose | Primary action |
|----|--------|---------|----------------|
| H1 | **Home — I'm okay** | Daily sign of life | Tap **I'm okay** |
| H2 | **Confirmed** | Feedback after check-in | Done / optional note |
| H3 | **I'm away** | Pause quiet-miss for a day/trip | Set away / overnight |
| H4 | **Who can see me** | Dignity / consent | Review who gets digests vs alerts |
| H5 | **Help** | How this works in plain words | Call care lead (optional) |

**Notes:** H1 is the product for them — one bookmark, one huge button. No calendar maze. No camera feed required.

**Journeys:** J5, J22, J23, J24

---

## B. Care lead (setup & governance)

| ID | Screen | Purpose | Primary action |
|----|--------|---------|----------------|
| L1 | **Household overview** | Members, pact status, who’s on duty now | Enter any area |
| L2 | **Invite member** | Add sibling, neighbor, guest caregiver | Send invite |
| L3 | **Roles & permissions** | Care lead / caregiver / view-only | Save |
| L4 | **Duty calendar** | Assign days/shifts to family | Assign / override today |
| L5 | **One-off assignment** | “Jordan covers Tuesday nurse window” | Assign |
| L6 | **Care pact** | Quiet-by, night window, expected visits, escalation timer | Save pact |
| L7 | **Expected visitors** | Nurse, cleaner, aide schedules | Add / edit |
| L8 | **Playbooks** | Night exit, quiet miss, missed visit — step lists | Edit steps |
| L9 | **Opt out day** | “I’m with them” / hospital / vacation | Activate opt-out |
| L10 | **Duty override** | Force who’s on duty *now* | Override |

**Journeys:** J1–J4, J17, J30

---

## C. On-duty caregiver (daily use)

| ID | Screen | Purpose | Primary action |
|----|--------|---------|----------------|
| C1 | **Today** | Check-in status, next visit, who’s on duty, open alerts | Open alert or assign task |
| C2 | **Alert detail** | What broke the pact + severity + playbook | **I'm on it** |
| C3 | **Playbook runner** | Step-by-step (call → wait → neighbor) | Mark step done |
| C4 | **Assign family member** | Hand a task or mid-incident help | Assign + due time |
| C5 | **Hand off incident** | Transfer ownership to another caregiver | Hand off |
| C6 | **Resolve** | That was fine / Needed check + note | Resolve |
| C7 | **Day digest** | Calm end-of-day summary | Dismiss |
| C8 | **My assignments** | Tasks assigned *to me* | Complete / can’t do |

**Journeys:** J7–J16, J18–J21, J28

---

## D. Backup caregiver

| ID | Screen | Purpose | Primary action |
|----|--------|---------|----------------|
| B1 | **Escalation inbox** | Alerts where on-duty didn’t respond | Take over |
| B2 | **Escalated alert detail** | Same as C2 + “Alex didn’t respond” banner | Follow playbook |
| B3 | **Duty reminder** | “You’re on this weekend” | Acknowledge |

Same resolve/assign patterns as C4–C6.

**Journeys:** J15, J29

---

## E. Assignee (any family member given a task)

| ID | Screen | Purpose | Primary action |
|----|--------|---------|----------------|
| A1 | **Assignment card** | “Call Mom about pharmacy — due 4pm” | Start / Done |
| A2 | **Assignment overdue** | Bumped back to on-duty or care lead | Retry / can’t do |

**Journeys:** J8, J16, J20

---

## F. Shared / system surfaces

| ID | Screen | Purpose | Primary action |
|----|--------|---------|----------------|
| S1 | **Who’s on duty now** | Single source of truth (widget or top bar) | — |
| S2 | **Incident timeline** | One thread: signal → alert → assigns → escalate → resolve | View |
| S3 | **Ring event log** | Raw/door events matched to expected / ignore / alert | Open linked incident |
| S4 | **Linked alerts** | Quiet miss + door soon after = related stack | Treat as one or split |
| S5 | **Permissions denied** | View-only tried to resolve | Ask care lead |
| S6 | **TV DoorSense** (`/tv`) | Side overlay while watching; remote picks response | Tell caregiver / help / dismiss |

**Journeys:** J25–J28

---

## Alert types → which detail screen

All use **C2 / B2** with different titles and default playbooks (L8):

| Alert type | Example copy | Journeys |
|------------|--------------|----------|
| Unusual night exit | Door activity at 1:40am | J9 |
| Unusual door activity | Repeated doorbell / unknown pattern | J10 |
| Long door open | Door may still be open | J11 |
| Rest-window exit | Exit during rest period | J12 |
| Unusual quiet | No sign of life by 12:30 | J13 |
| Expected visit missed | Nurse didn’t show | J14 |

---

## Demo path (screens to design first)

Priority for hackathon UI polish:

1. **H1** I'm okay  
2. **C1** Today (green day)  
3. **C2 + C3** Quiet miss + playbook  
4. **C4** Assign sibling  
5. **B1 + B2** Escalation to backup  
6. **C2** Night exit (odd hours)  
7. **C6** That was fine  
8. **L4 + S1** Who’s on tomorrow  

Setup screens L1–L10 can be simpler / wizard-style for the demo.

---

## Screen count summary

| Role | Screens |
|------|---------|
| Person at home | 5 |
| Care lead | 10 |
| On-duty caregiver | 8 |
| Backup | 3 |
| Assignee | 2 |
| Shared | 5 |
| **Total** | **~33** (many are variants of alert/resolve) |

**MVP design set (~12):** H1–H3, L4, L6, L8, C1–C4, C6, B1–B2, S1–S2
