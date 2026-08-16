# 06 — Domain Rules

Clinical and parsing logic. **This is the document to read most carefully** — it encodes
knowledge that is not guessable and that the app's correctness depends on.

Everything here lives in `src/domain/` as **pure functions with no imports** outside `date-fns`.
Every rule below has a matching unit test. If a rule is ambiguous, the function returns
`null`/`unknown` and the UI asks the user — it never guesses.

---

## Frequency shorthand

Pakistani prescriptions use Latin abbreviations. They are written inconsistently — uppercase,
lowercase, with or without dots, sometimes alongside a numeric form. All of these variants must
parse.

`src/domain/frequency.ts`

| Code | Latin | Means | Doses/day | Default times (24h) |
|---|---|---|---|---|
| `OD` | *omni die* | Once daily | 1 | 09:00 |
| `BD` / `BID` | *bis in die* | Twice daily | 2 | 09:00, 21:00 |
| `TDS` / `TID` | *ter die sumendum* | Three times daily | 3 | 08:00, 14:00, 20:00 |
| `QID` / `QDS` | *quater in die* | Four times daily | 4 | 08:00, 12:00, 16:00, 20:00 |
| `QHS` / `HS` | *hora somni* | At bedtime | 1 | 22:00 |
| `PRN` / `SOS` | *pro re nata* | As needed | 0 | **none — see below** |
| `STAT` | *statim* | Immediately, once | 1 | now, once only |
| `WEEKLY` | — | Once a week | — | 09:00 on the start weekday |

### Recognised input variants

Match case-insensitively, tolerate dots and spaces, and accept the plain-language forms users
and models both produce:

```
OD    ← "od", "o.d.", "1x", "once", "once daily", "once a day", "daily", "1 time",
        "din me ek baar", "روزانہ ایک بار"
BD    ← "bd", "b.d.", "bid", "2x", "twice", "twice daily", "twice a day", "12 hourly",
        "q12h", "din me do baar"
TDS   ← "tds", "t.d.s.", "tid", "3x", "thrice", "three times", "8 hourly", "q8h",
        "din me teen baar"
QID   ← "qid", "qds", "4x", "four times", "6 hourly", "q6h"
QHS   ← "hs", "qhs", "at night", "bedtime", "before sleep", "raat ko", "sote waqt"
PRN   ← "prn", "sos", "as needed", "if required", "when necessary", "zaroorat par"
STAT  ← "stat", "immediately", "at once", "abhi"
WEEKLY← "weekly", "once a week", "q7d", "hafte me ek baar"
```

### Rules

1. **Unrecognised input returns `null`.** It does **not** fall back to `BD` or anything else.
   A null `frequency_code` means the confirm screen asks the user to pick.
2. **`PRN`/`SOS` generates no scheduled doses.** As-needed medicines appear in the medicine
   cabinet with a "Take as needed" action that logs an ad-hoc dose at the moment it is taken.
   Never place a PRN medicine on a timed schedule — reminding someone to take an as-needed
   painkiller is wrong.
3. **`STAT` generates exactly one dose**, at the current time, on the start date.
4. **Hourly forms map to their code**, e.g. `q8h` → `TDS`. If an interval does not divide evenly
   into a day (`q5h`), return `CUSTOM` and let the user set times.
5. **The raw string is always preserved** in `medicines.frequency_raw`. Never overwrite what the
   doctor wrote; the interpretation is stored separately.
6. **Default times are user-adjustable.** Store them per medicine so a user who takes their
   morning dose at 07:00 keeps it.

### Meal-relation modifiers

Prescriptions often add these. Capture them into `instructions` and `with_food`, and let them
nudge default times:

| Input | Meaning | `with_food` |
|---|---|---|
| `AC`, *ante cibum*, "before meals", "khane se pehle" | Before food | `false` |
| `PC`, *post cibum*, "after meals", "khane ke baad" | After food | `true` |
| "with food", "with milk", "khane ke sath" | With food | `true` |
| "empty stomach", "nashta se pehle", "khali pait" | Empty stomach | `false` |

An empty-stomach medicine should default its morning dose to 07:00 rather than 09:00, and the
UI should surface the instruction on the dose card — it changes what the user does.

```ts
export type FrequencyCode =
  | 'OD' | 'BD' | 'TDS' | 'QID' | 'QHS' | 'PRN' | 'SOS' | 'STAT' | 'WEEKLY' | 'CUSTOM';

/** Returns null when the input cannot be confidently interpreted. Never guesses. */
export function parseFrequency(raw: string | null | undefined): FrequencyCode | null;

/** Dose times as minutes since midnight. Empty array for PRN/SOS. */
export function defaultDoseTimes(code: FrequencyCode, withFood?: boolean): number[];
```

---

## Duration

`src/domain/duration.ts`

Convert a written duration into a day count.

| Input | Days |
|---|---|
| "5 days", "5 din", "x5", "5/7" | 5 |
| "1 week", "1 hafta" | 7 |
| "2 weeks" | 14 |
| "1 month" | 30 |
| "3 months" | 90 |
| "continue", "ongoing", "long term", "lifelong", "regular" | `ongoing` → `is_ongoing = true`, no end date |
| "till review", "until follow-up", "review ke baad" | `null` → ask the user |
| unreadable / absent | `null` → ask the user |

### Rules

1. **Return `null` when unclear. Never default to 5 days.** A wrong duration means a course of
   antibiotics stops early or continues too long. Both are real harm.
2. **Take the number attached to the time unit, not the first number in the string.** "1 tablet
   for 5 days" is 5 days, not 1 day. Anchor the match on the unit word.
3. "x5" and "5/7" are both common shorthand for five days.
4. Chronic-medication phrasings map to `ongoing`, which produces a rolling schedule (generate
   30 days ahead, extend on app open) rather than a fixed end date.
5. `end_date = start_date + duration_days - 1`. A 5-day course starting Monday ends Friday, not
   Saturday. Off-by-one here is visible to the user and erodes trust.

```ts
export type DurationResult =
  | { kind: 'days'; days: number }
  | { kind: 'ongoing' }
  | { kind: 'unknown' };

export function parseDuration(raw: string | null | undefined): DurationResult;
```

---

## Schedule generation

`src/domain/schedule.ts`

Build the dose rows for a medicine.

```ts
export function buildSchedule(input: {
  medicineId: string;
  startDate: string;          // YYYY-MM-DD in app timezone
  durationDays: number | null;
  isOngoing: boolean;
  doseTimes: number[];        // minutes since midnight
  now: Date;                  // injected — never read the clock inside
}): Array<{ scheduled_date: string; scheduled_minutes: number }>;
```

### Rules

1. **Dates are computed in `Asia/Karachi`.** Never `toISOString().split('T')[0]` — that yields
   yesterday for the first five hours of every Pakistani day and makes "today's doses" wrong
   every morning.
2. **Idempotent.** Regenerating for the same medicine produces the same rows; the unique
   constraint `(medicine_id, scheduled_date, scheduled_minutes)` absorbs re-runs.
3. **`durationDays === null` generates nothing.** The confirm screen must resolve the duration
   before a schedule exists.
4. **Ongoing medicines** generate 30 days forward, topped up whenever the app opens.
5. **Doses already in the past are still created** for a back-dated prescription, with status
   `pending`; the domain layer derives `missed` on read. The user can retroactively mark them.
6. Cap generation at **365 days** per medicine as a sanity bound.

---

## Time buckets

`src/domain/timeBuckets.ts`

```ts
export type Bucket = 'morning' | 'afternoon' | 'evening' | 'night';

export function bucketOf(minutes: number): Bucket;
```

| Bucket | Window | Minutes |
|---|---|---|
| `morning` | 05:00 – 11:59 | 300 – 719 |
| `afternoon` | 12:00 – 16:59 | 720 – 1019 |
| `evening` | 17:00 – 20:59 | 1020 – 1259 |
| `night` | 21:00 – 04:59 | 1260 – 1439, 0 – 299 |

### Rules

1. **Buckets are exhaustive and mutually exclusive.** Every minute value maps to exactly one.
   Test this by iterating all 1,440 values and asserting a single match — a dose appearing in
   two sections is an obvious, trust-destroying bug.
2. Bucket by **integer comparison on `scheduled_minutes`**. Never substring-match a formatted
   time string; `"09:00 PM"` contains `"09:"` and so does `"09:00 AM"`.
3. Night wraps midnight. Handle it explicitly.

---

## Reference ranges

`src/domain/referenceRange.ts`

Decide whether a lab value sits inside its printed reference range. **Pure arithmetic — never
ask a model for this.**

```ts
export type RangeStatus = 'within' | 'below' | 'above' | 'unknown';

export function parseRange(text: string | null): { low: number | null; high: number | null };
export function evaluate(value: number | null, low: number | null, high: number | null): RangeStatus;
```

### Formats to support

| Printed form | Interpretation |
|---|---|
| `12.0 - 16.0`, `12–16`, `12 to 16` | low 12, high 16 |
| `< 100`, `<100`, `less than 100`, `upto 100` | high 100 |
| `> 40`, `>= 40`, `greater than 40` | low 40 |
| `0.4 - 4.0 mIU/L` | strip the unit, then parse |
| `Negative`, `Non-reactive`, `Nil`, `Absent` | qualitative — see below |
| `M: 13-17, F: 12-15` | sex-specific — see below |
| absent or unparseable | `unknown` |

### Rules

1. **`unknown` is a first-class result** and displays as "Not evaluated". Never guess a range,
   and never mark something out-of-range because parsing failed.
2. **Qualitative results are not numeric.** Store `value_text` and leave `value_numeric` null;
   status is `unknown` unless the printed range states the expected qualitative value, in which
   case a simple case-insensitive string comparison decides `within` / `above`.
3. **Sex-specific ranges:** if the profile records `sex`, pick the matching band; otherwise
   return `unknown` rather than picking one arbitrarily.
4. **Units are not converted.** If the report's unit differs from a previous report's unit for
   the same test, mark the trend as not comparable and say so on the chart rather than plotting
   incompatible points together. Unit-blind comparison produces clinically wrong charts.
5. **Wording, always:** out-of-range renders as *"Outside the typical range — worth discussing
   with your doctor."* Never "abnormal", never "high"/"low" as a verdict on the person, never
   any implication of diagnosis.
6. `ref_low` / `ref_high` are persisted so charts can draw reference bands.

---

## Test name aliases

`src/domain/testAliases.ts`

Doctors write `CBC`; labs print `Complete Blood Count`. Auto-linking an uploaded report to a
pending test order depends on resolving both to one canonical name.

| Alias | Canonical |
|---|---|
| `CBC`, `Blood CP`, `CP`, `Complete Picture` | Complete Blood Count |
| `Hb`, `HB`, `Haemoglobin` | Hemoglobin |
| `LFT`, `Liver Profile` | Liver Function Test |
| `RFT`, `KFT`, `Renal Profile`, `Kidney Function` | Renal Function Test |
| `HbA1c`, `A1c`, `Glycated Hb` | Glycated Hemoglobin |
| `TSH` | Thyroid Stimulating Hormone |
| `T3`, `T4`, `FT3`, `FT4` | Thyroid Panel |
| `ESR` | Erythrocyte Sedimentation Rate |
| `CRP` | C-Reactive Protein |
| `FBS`, `Fasting Sugar` | Fasting Blood Sugar |
| `RBS`, `Random Sugar` | Random Blood Sugar |
| `OGTT` | Oral Glucose Tolerance Test |
| `Lipids`, `Lipid Profile`, `Cholesterol Profile` | Lipid Profile |
| `UDR`, `Urine DR`, `Urine D/R`, `Urine Complete` | Urine Detailed Report |
| `X-Ray`, `XRay`, `CXR`, `Chest X-Ray` | Chest X-Ray |
| `USG`, `Ultrasound`, `U/S` | Ultrasound |
| `ECG`, `EKG` | Electrocardiogram |
| `Echo` | Echocardiogram |
| `Vit D`, `25-OH Vitamin D` | Vitamin D |
| `Vit B12`, `B12` | Vitamin B12 |
| `S. Creatinine`, `Creat` | Serum Creatinine |
| `S. Electrolytes`, `Electrolytes` | Serum Electrolytes |
| `Dengue NS1`, `NS1` | Dengue NS1 Antigen |
| `Typhidot`, `Widal` | Typhoid Serology |
| `MP`, `Malarial Parasite`, `ICT Malaria` | Malaria Test |
| `HBsAg` | Hepatitis B Surface Antigen |
| `Anti-HCV`, `HCV` | Hepatitis C Antibody |
| `PT/INR`, `INR` | Prothrombin Time / INR |
| `Uric Acid` | Serum Uric Acid |
| `PSA` | Prostate Specific Antigen |
| `Beta HCG`, `B-HCG` | Beta HCG |

*(Dengue, typhoid, malaria and hepatitis tests are included deliberately — they are among the
most frequently ordered tests in Pakistan.)*

### Matching rules for auto-linking

Apply in order; stop at the first hit:

1. Exact match on `canonical_name`.
2. Alias-table match, both sides normalised (lowercase, strip punctuation, collapse whitespace).
3. Exact normalised string match on the raw names.

**Do not use fuzzy or substring matching.** "Vitamin D" must not match "Vitamin B12", and
"Blood Sugar" must not match both fasting and random variants. A wrong link attaches the wrong
result to the wrong order, which is a clinical error.

4. **Any automatic link is presented as a suggestion the user confirms.** Record
   `link_method = 'auto'` only after confirmation; never link silently.
5. When several pending orders match, ask — do not pick the oldest.

---

## Red flags — offline emergency check

`src/domain/redFlags.ts`

**This function must work with no network, and it runs before any AI call.** It is the single
most safety-critical piece of code in the product.

```ts
export type RedFlagResult = {
  isEmergency: boolean;
  matched: string[];        // which categories fired, for display
};

export function checkRedFlags(text: string): RedFlagResult;
```

### Categories and keywords

Match case-insensitively across English, Roman Urdu, and Urdu script:

| Category | Keywords |
|---|---|
| Cardiac | chest pain, chest pressure, chest tightness, pain in chest, seene me dard, seena jakarna, دل کا درد |
| Breathing | can't breathe, cannot breathe, shortness of breath, difficulty breathing, gasping, saans nahi aa rahi, saans phoolna, دم گھٹنا |
| Stroke | face drooping, one side weakness, slurred speech, can't speak, sudden numbness, adha jism sun, falij, فالج |
| Bleeding | heavy bleeding, won't stop bleeding, vomiting blood, blood in vomit, coughing blood, khoon aa raha, خون |
| Consciousness | unconscious, fainted, passed out, unresponsive, seizure, fit, behosh, بے ہوش, dora |
| Anaphylaxis | throat swelling, tongue swelling, can't swallow, severe allergic, whole body rash with breathing |
| Obstetric | heavy bleeding pregnancy, no fetal movement, water broke early, severe abdominal pain pregnancy |
| Infant | baby not breathing, baby blue, baby limp, newborn fever, baby not waking |
| Poisoning | overdose, took too many pills, swallowed poison, zeher, kerosene, phenyl |
| Severe pain | worst headache of my life, sudden severe headache, thunderclap headache |

### Rules

1. **Local first, always.** Run this before the network call. If it fires, show the emergency
   screen immediately — do not wait for, or depend on, any model response.
2. **False positives are acceptable; false negatives are not.** Err toward flagging. The cost of
   an unnecessary emergency screen is a mild annoyance; the cost of a miss is not.
3. **The emergency screen shows tap-to-call helplines** and nothing else competing for
   attention:
   - **Rescue 1122** — `tel:1122` — Medical & ambulance
   - **Edhi Foundation 115** — `tel:115` — Ambulance
   - **Chhipa 1020** — `tel:1020` — Emergency rescue
4. **These numbers are also reachable from the dashboard in one tap**, without going through the
   symptom flow at all.
5. The keyword list is data, not logic — keep it in one exported constant so it can be reviewed
   by someone with medical training.

---

## Active medicines

`src/domain/activeMedicines.ts`

Which medicines is the person **currently** taking? This drives the doctor brief and the share
snapshot, so correctness matters clinically: a physician reading that a patient is on a
medication they finished two years ago may make a real prescribing decision on it — duplicate
therapy, or a missed interaction.

```ts
export function isActive(medicine: Medicine, today: string): boolean;
export function activeMedicines(medicines: Medicine[], today: string): Medicine[];
```

A medicine is active when **all** hold:

1. `discontinued_at` is null.
2. `start_date <= today`.
3. `is_ongoing === true`, **or** `end_date >= today`.

### Rules

- **Never build this list by de-duplicating names across all visits with no date filter.** That
  is how finished courses leak into a doctor-facing summary.
- Dedupe by `medicine_name` **only among genuinely active courses**, keeping the most recent
  `start_date`.
- The doctor brief separates **Currently taking** from **Recently finished (last 30 days)** —
  the second is clinically useful context and must be labelled as finished, not active.

---

## Adherence

`src/domain/adherence.ts`

```ts
export function adherence(doses: Dose[], range: { from: string; to: string }): {
  scheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  percentage: number;      // taken / scheduled, rounded; 0 when scheduled === 0
};
```

### Rules

1. A `pending` dose more than **4 hours** past its scheduled time counts as `missed` when
   derived on read. Do not mutate rows on a schedule.
2. Future pending doses are excluded from the denominator — a day that hasn't happened cannot
   lower adherence.
3. `PRN` medicines are excluded from adherence entirely; there is no expected count.
4. Percentage is `taken / scheduled`; skipped doses count against it, since a deliberate skip is
   still a dose not taken.
5. Present adherence as information, never as judgement. No red "you failed" framing — a missed
   dose count with a neutral tone. Guilt drives people out of health apps.

---

## Drug interactions

The model may propose interaction warnings, but the presentation rules are ours:

1. **Only flag genuinely significant interactions.** Do not warn about ordinary co-prescriptions
   a doctor has deliberately written together — paracetamol plus an antibiotic does not need a
   warning banner.
2. **Respect the prescriber.** Framing is *"worth mentioning to your doctor or pharmacist"*,
   never *"your doctor made a mistake"*.
3. `severe` severity is reserved for well-documented contraindications. Anything mild or
   moderate is presented as practical guidance ("take these a few hours apart"), not a risk
   alert.
4. Only check among **currently active** medicines (see above). Interactions with a course
   finished last year are noise.
5. Always accompanied by the standard disclaimer, and never blocks saving a prescription.

---

## Testing requirements

Every function above has a unit test file. Non-negotiable cases:

- `frequency.ts` — every code, every listed variant, and unrecognised input returning `null`.
- `duration.ts` — "1 tablet for 5 days" → 5 (not 1); ongoing phrasings; unknown returning
  `unknown`; the `end_date` off-by-one.
- `timeBuckets.ts` — all 1,440 minute values map to exactly one bucket; the midnight wrap.
- `schedule.ts` — **a case run at 02:00 Pakistan time asserting the date is today, not
  yesterday**; idempotent regeneration; PRN generating zero doses; null duration generating zero.
- `referenceRange.ts` — every printed format; qualitative values; unparseable input →
  `unknown`; mismatched units flagged not compared.
- `testAliases.ts` — canonical resolution both directions; "Vitamin D" does **not** match
  "Vitamin B12"; ambiguous multi-match returns all candidates.
- `redFlags.ts` — every category fires, in all three language forms; and a plain "mild headache
  since yesterday" does **not** fire.
- `activeMedicines.ts` — a finished 5-day course from two years ago is **excluded**; an ongoing
  chronic medicine is included; a discontinued medicine is excluded.
- `adherence.ts` — future doses excluded from the denominator; PRN excluded; the 4-hour missed
  threshold boundary.
