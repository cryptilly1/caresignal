# CareSignal — Home screen map

**Home = `/today`** (caregiver’s main screen).  
Bottom shelf is how you move. Demo/Setup are secondary.

---

## Bottom shelf (5 tabs)

| Tab | Goes to | When you press it |
|-----|---------|-------------------|
| **Home** | `/today` | Opens the care dashboard for Mom |
| **Check-in** | `/home` | Opens Mom’s big **I’m okay** button |
| **Alerts** | `/escalation` | Open + escalated alerts; badge = count |
| **Family** | `/assignments` | Tasks assigned to people |
| **You** | `/setup` | Duty calendar, pact rules, who you’re viewing as |

Header **✦** = Demo injector (hackathon only). Not a main tab.

---

## Home page sections (top → bottom)

### 1. Title
- **Mom** (care recipient)
- Subline: who’s on duty / backup

### 2. Status pills (read-only snapshot)
| Pill | Meaning |
|------|---------|
| Sign of life | Okay / Waiting / Paused |
| On duty | Who gets alerts first today |
| Alerts | How many need attention |
| Backup | Who gets it if on-duty ignores |

*Tapping a pill does nothing yet (status only).*

### 3. Actions (primary buttons)
| Button | What happens |
|--------|----------------|
| **I’m okay** | Opens Check-in screen (Mom taps to check in) |
| **Assign family** | Opens Family / tasks |
| **Who’s on duty** | Opens You / Setup (duty calendar) |

### 4. Alerts list
| Action | What happens |
|--------|----------------|
| Tap an alert card | Opens that alert’s playbook |
| On alert: **I’m on it** | You own it; stops auto-escalate |
| **Mark step done** | Advances playbook |
| **Assign** | Creates a task for another family member |
| **That was fine** / **Needed check** | Closes the alert |
| No acknowledge in time | Moves to **Alerts** tab as escalated (backup) |

### 5. Door grid
| Action | What happens |
|--------|----------------|
| Shows recent Ring fixtures | Labels: alert / expected / ignore |
| Empty tiles | Placeholder until Demo injects events |

---

## Role reminder

| Viewing as | Use Home for |
|------------|----------------|
| **Alex / Sam / Jordan** | Watch status, open alerts, assign, escalate |
| **Mom** | Mostly use **Check-in** tab |
| **Mira** | Backup / neighbor in playbooks |
