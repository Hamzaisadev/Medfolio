# Medfolio — Comprehensive Theme & Design System Specification

> **Document Version:** 2.0  
> **Status:** Approved Architecture Draft  
> **Design Philosophy:** Medical Grade • Patient Centric • Calm & Trustworthy • Zero-Emoji Policy

---

## 1. Executive Summary & Design Vision

**Medfolio** is not a generic developer tool or a dark-themed B2B SaaS dashboard. It is a **life-critical, personal medical assistant and clinical portfolio** used by patients, caregivers, and doctors.

### The Problem with the Dark SaaS Aesthetic in Healthcare
1. **Clinical Legitimacy:** Traditional health documents, medical dossiers, and clinical tools operate in high-clarity, high-legibility light environments. A pitch-black UI feels like a gaming or crypto app, undermining patient trust.
2. **Cognitive Load & Stress:** Users accessing Medfolio may be sick, anxious, elderly, or managing chronic conditions. Dark high-contrast interfaces induce optical fatigue (halation around bright text) and increase cognitive tension.
3. **Legibility in Real Conditions:** In bright hospital rooms, doctor consultations, or outdoor pharmacy visits, dark mode suffers from heavy glare and reduced glanceability.

### The Medfolio Aesthetic: "Clinical Calm"
- **Pristine, Warm Light Surfaces:** Soft alabaster and subtle warm stone surfaces instead of sterile stark blue-white or muddy grey.
- **Therapeutic Teal & Sapphire:** Carefully tuned OKLCH pigments evoking tranquility, clinical precision, and safety.
- **Zero-Emoji Architecture:** 100% bespoke SVG iconography. Emojis render inconsistently across operating systems and look unprofessional in clinical contexts.
- **Generous Touch Ergonomics:** 44px minimum tap targets (56px for primary dose logging), high-contrast text ratios exceeding WCAG AAA standards.

---

## 2. Color System & OKLCH Palette Architecture

Medfolio utilizes perceptual **OKLCH** color spaces for uniform brightness and predictable contrast.

### 2.1 Brand & Clinical Primaries
| Token | OKLCH Value | Visual Swatch Role | Usage |
| :--- | :--- | :--- | :--- |
| `--color-brand-50` | `oklch(0.979 0.019 186)` | Serene Mist | Subtle card badges, selected tabs, tinted containers |
| `--color-brand-100` | `oklch(0.949 0.044 186)` | Gentle Aquamarine | Input borders on hover, active item highlights |
| `--color-brand-200` | `oklch(0.901 0.078 186)` | Soft Teal | Pill backgrounds, metric cards |
| `--color-brand-500` | `oklch(0.679 0.129 188)` | Vibrant Clinical Teal | Secondary accents, progress rings |
| `--color-brand-600` | `oklch(0.593 0.115 188)` | Primary Clinical Action | Primary buttons, active nav icons, main CTAs |
| `--color-brand-700` | `oklch(0.513 0.097 189)` | Deep Marine | Pressed states, high-contrast headings |
| `--color-brand-900` | `oklch(0.391 0.067 191)` | Clinical Midnight | Brand typography, header accents |

### 2.2 Neutrals (Warm Stone)
| Token | OKLCH Value | Role & Contrast Ratio |
| :--- | :--- | :--- |
| `--color-ink-50` | `oklch(0.985 0.003 75)` | Page canvas & sunken background |
| `--color-ink-100` | `oklch(0.970 0.006 75)` | Hover state on neutral items |
| `--color-ink-200` | `oklch(0.932 0.010 78)` | Card borders & subtle dividers |
| `--color-ink-300` | `oklch(0.872 0.015 78)` | Emphasized borders, input outlines |
| `--color-ink-500` | `oklch(0.560 0.026 74)` | Subtle helper text & timestamps |
| `--color-ink-600` | `oklch(0.452 0.026 72)` | Muted body copy (Meets 4.5:1 on white) |
| `--color-ink-900` | `oklch(0.212 0.020 66)` | Primary text & headlines (Meets 14:1 on white) |

### 2.3 Clinical Diagnostic & Status Tones
Every clinical status token has three coordinated values: **Background**, **Border**, and **Text** to prevent color clash.

```
┌──────────────┬───────────────────────────────┬───────────────────────────────┐
│ Status       │ Background / Border           │ Text & Icon Token             │
├──────────────┼───────────────────────────────┼───────────────────────────────┤
│ OK (Normal)  │ bg-ok-bg / border-ok-border   │ text-ok-text (Clinical Green) │
│ WARN (Note)  │ bg-warn-bg / border-warn-bdr  │ text-warn-text (Amber Ochre)  │
│ RISK (Urgent)│ bg-risk-bg / border-risk-bdr  │ text-risk-text (Crimson Red)  │
│ INFO (Guide) │ bg-info-bg / border-info-bdr  │ text-info-text (Deep Cyan)    │
└──────────────┴───────────────────────────────┴───────────────────────────────┘
```

### 2.4 Time-of-Day Schedule Colorways
Medication adherence is organized chronologically. Each slot has a distinct, soothing daylight tone:
- **Morning (06:00 - 11:59):** Warm Amber Sunrise (`oklch(0.980 0.028 85)`)
- **Afternoon (12:00 - 16:59):** Clear Sky Azure (`oklch(0.973 0.021 230)`)
- **Evening (17:00 - 20:59):** Dusk Orchid (`oklch(0.973 0.020 305)`)
- **Night (21:00 - 05:59):** Indigo Starlight (`oklch(0.968 0.016 275)`)

---

## 3. Typography & Patient Readability Scale

- **Primary Font:** Inter Variable (Clean, open counters, highly legible at small sizes)
- **Monospace Font:** JetBrains Mono (For dosages, numeric metrics, timestamp logs, and lab reference values)

```
Scale Token       Size      Line Height   Clinical Application
─────────────────────────────────────────────────────────────────────────────
--text-2xs        12px      1.45          Absolute floor. Micro-labels only.
--text-xs         13px      1.5           Timestamps, helper sub-labels
--text-sm         15px      1.55          Secondary text, dose instructions
--text-base       17px      1.6           Primary body copy & chat messages
--text-lg         19px      1.5           Section headings & card titles
--text-xl         22px      1.4           Modal headers, key metric values
--text-2xl        26px      1.3           Page titles
--text-3xl        32px      1.22          Hero counters, vital displays
```

> [!IMPORTANT]
> **No Micro-Text:** Fonts under 12px (`text-[10px]` or `text-[11px]`) are prohibited across Medfolio to ensure patients with impaired vision can effortlessly read their medication instructions.

---

## 4. Complete SVG Iconography System (Zero Emojis)

All icons are rendered as pure vector SVG components residing in `src/components/ui/icons/index.tsx`. Emojis are strictly banned from UI elements, logs, badges, and headers.

### Available SVG Icon Catalog

```
1. CLINICAL & MEDICAL
├── PrescriptionIcon    (Medical Rx scripts)
├── MedicineIcon        (Medication pills & tablets)
├── CapsuleIcon         (Extended-release capsules)
├── SyringeIcon         (Injections & vaccines)
├── LabFlaskIcon        (Blood tests & lab diagnostics)
├── StethoscopeIcon     (Doctor visits & physical exams)
├── DoctorIcon          (Physician profile & specialist directory)
├── HospitalIcon        (Clinics, diagnostic labs & hospitals)
├── EmergencyAmbulanceIcon (Urgent triage & emergency helpline)
├── DropletIcon         (Blood glucose logs & fingerstick readings)
├── HeartPulseIcon      (Blood pressure & cardiac metrics)
├── ActivityIcon        (ECG & vital activity stream)
├── ThermometerIcon     (Body temperature & fever tracker)
├── LungsIcon           (SpO2 oxygen saturation & respiratory data)
├── BrainIcon           (Neurology & cognitive symptoms)
├── BandageIcon         (Symptom triage & wound care)
└── MealIcon            (Before/After food relation for doses)

2. SCHEDULING & TIME
├── SunriseIcon         (Morning slot)
├── SunIcon             (Afternoon slot)
├── SunsetIcon          (Evening slot)
├── MoonIcon            (Night slot)
├── ClockIcon           (Dose intake timestamp)
├── CalendarIcon        (Appointment scheduling)
├── CalendarDaysIcon    (Date pickers & timeline logs)
├── TimerIcon           (Countdown & dose intervals)
├── RepeatIcon          (Daily/weekly medication frequency)
├── BellIcon            (Notification alert)
└── BellOffIcon         (Snoozed or muted reminders)

3. METRICS, VITALS & ACHIEVEMENTS
├── FlameIcon           (Adherence streak counter - replaces 🔥)
├── TargetIcon          (ADA glycemic target range - replaces 🎯)
├── ScaleIcon           (Body weight tracking)
├── TrendingUpIcon      (Upward metric trend)
├── TrendingDownIcon    (Downward metric trend)
├── BarChartIcon        (MAP analytics & dose graphs - replaces 📊)
├── ZapIcon             (Spike & dip warnings - replaces ⚡)
├── TrophyIcon          (Monthly adherence champion - replaces 🏆)
├── MedalIcon           (Achievement milestone badge - replaces 🏅)
├── AwardIcon           (Verified compliance award)
└── StarIcon            (Favorite medications & doctors)

4. NAVIGATION & USER ACTIONS
├── HomeIcon            (Dashboard navigation)
├── SearchIcon          (Record search & drug database)
├── SettingsIcon        (Account & clinical preferences)
├── UserIcon / UsersIcon (Patient profile / Family caregivers)
├── PlusIcon / MinusIcon (Add / remove dose or medication)
├── CheckIcon / CheckCircleIcon (Dose confirmed taken - replaces ✅)
├── XIcon               (Close modal / dismiss alert - replaces ✕)
├── ChevronLeft/Right/Down/UpIcon (Collapsibles & paginations)
├── ArrowLeft/RightIcon (Workflow navigation)
├── EditIcon / TrashIcon (Record modification & deletion)
├── CopyIcon            (Copy verification code / share token)
├── FilterIcon          (Filter records & reports)
├── EyeIcon / EyeOffIcon (Show / hide sensitive health numbers)
└── LogOutIcon          (Secure sign out)

5. DOCUMENTS & SECURITY
├── CameraIcon          (Prescription & lab scanner)
├── ImageIcon           (Document scan thumbnail)
├── FileTextIcon        (Clinical dossier & PDF export)
├── FolderIcon          (Medical records vault)
├── PrinterIcon         (Print clinical dossier - replaces 🖨️)
├── DownloadIcon        (Export health data)
├── UploadIcon          (Import lab results)
├── LinkIcon            (Shareable emergency profile link - replaces 🔗)
├── PhoneIcon           (Emergency helpline dialer - replaces 📞)
├── MicIcon / MicOffIcon (Voice assistant / symptom recording)
├── SparklesIcon        (AI Clinical Assistant intelligence - replaces ✨)
├── LockIcon            (Row-Level Security & HIPAA encryption - replaces 🔒)
├── ShieldIcon          (Data privacy & verification seal - replaces 🛡️)
└── WifiIcon / WifiOffIcon (Offline vault status - replaces 📶)
```

---

## 5. UI Layout & Elevation Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ Level 0: Background Canvas (bg-surface-sunken: warm stone)  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Level 1: Medical Cards (bg-surface: pure white)         │ │
│ │          Border: border-line (1px subtle warm stone)    │ │
│ │          Shadow: shadow-card (tinted warm ambient)      │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Level 2: Interactive Slots & Sub-Cards (bg-surface) │ │ │
│ │ │          Hover: bg-surface-hover                    │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Level 3: Overlays & Modals (bg-surface, shadow-over)       │
│          Backdrop: 40% blur with warm neutral overlay       │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Checklist for Next Steps

1. **Icons:** `src/components/ui/icons/index.tsx` is now complete with all SVG primitives.
2. **Theme Migration:** Migrate remaining pages with raw emoji literals (e.g. `LandingPage.tsx`, `SettingsPage.tsx`, `VitalsTrackerPage.tsx`) to use the dedicated SVG components.
3. **Palette Consolidation:** Ensure all cards and containers reference semantic tokens (`bg-surface`, `text-content`, `border-line`, `bg-ok-bg`, etc.) rather than dark arbitrary hardcoded values.
