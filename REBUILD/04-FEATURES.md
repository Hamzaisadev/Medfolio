# 04 — Features

Every screen and flow, specified to build from. Each feature lists its route, states, and rules.

Cross-cutting requirements for every screen — do not repeat these per feature, but honour them
everywhere:

- Empty, loading, error, and offline states all designed (`03-DESIGN-SYSTEM.md`).
- No dead ends: every screen has a back path and a clear next action.
- All copy follows §Product voice — name the benefit, never the technology.
- All dates in `Asia/Karachi` via `src/lib/time.ts`.

---

## 1. Auth

**Routes:** `/sign-in`, `/sign-up`, `/forgot-password`

Supabase Auth, email + password. Google OAuth optional and only if it costs nothing extra.

**Rules**
- Session persisted; opening the app while signed in never shows a login flash. Render a
  splash/skeleton until the session resolves.
- A protected route hit without a session redirects to `/sign-in?next=<path>` and returns there
  after login.
- The signup trigger creates the default `profiles` row (`02-DATA-MODEL.md` §Triggers), so no
  screen ever has to handle "signed in but no profile".
- Password rules stated **before** submission, not as an error afterwards.
- Errors are specific: wrong password, unknown email, network down — never "Something went wrong".
- Onboarding after first signup — three short steps, each skippable:
  1. Name + date of birth.
  2. **Allergies and chronic conditions.** Framed as "the two things a doctor most wants to
     know". This is the highest-value data in the app.
  3. Notification permission, with an honest reason ("so we can remind you when a dose is due").

---

## 2. Dashboard

**Route:** `/`

The screen the user sees most. It answers three questions in order: *what do I take now*,
*what do I owe* (pending tests, follow-ups), *what do I do next*.

**Layout, top to bottom**

1. **Greeting + today's date** (in app timezone). Compact — one line.
2. **Next dose card.** The single most important element. Medicine, dose amount, time, and a
   Taken button. If a dose is overdue, it shows here with a muted amber treatment. If nothing is
   due, this collapses to a one-line "Nothing due until 21:00" — it does not become a large
   empty panel.
3. **Today's progress.** `ProgressRing` with the numeric value inside: "4 of 6 taken".
   Tapping goes to `/medicines`.
4. **Primary action: "Scan prescription".** Full-width, unmistakable. This is the app's core
   entry point.
5. **Pending tests**, only when non-empty. Each row: test name, when ordered, and an
   "Upload results" action.
6. **Follow-up reminder**, only when a `visits.follow_up_date` is within 7 days.
7. **Quick actions** row: "I'm feeling unwell", "Upload lab report", "Doctor summary".
8. **Emergency helplines** — a single compact, permanently visible row of three tap-to-call
   buttons (Rescue 1122, Edhi 115, Chhipa 1020). No AI in this path, works offline, one tap.

**Rules**
- Sections with no content are **absent**, not rendered as empty boxes. A new user sees the
  greeting, an empty-state prompt to scan their first prescription, and the helplines.
- Skeleton on load matching final layout — no content jump.
- No "AI Active" badge, no sparkle icons, no technology framing anywhere.

---

## 3. Prescription capture → confirm → save

**Routes:** `/prescriptions/new`, `/prescriptions/review`

The core loop. Get this right before anything else.

### 3a. Capture — `/prescriptions/new`

- Two inputs: **Take photo** (`capture="environment"`) and **Choose file**.
- **Multiple pages supported.** Prescriptions run to 2–3 pages. Show thumbnails, allow reorder
  and remove, cap at 5 pages.
- Accept `image/*` **and** `application/pdf`. PDFs rasterise client-side via `pdfjs-dist`.
- Client-side processing before upload: EXIF strip, orientation correct, resize longest edge to
  2000px, WebP q0.82.
- Show the compressed preview and let the user retake if it is blurry or cropped **before**
  spending an AI call. A guidance line: "Make sure all the writing is inside the frame."
- "Enter manually instead" is always available. The app must be fully usable with no AI.

### 3b. Extraction

- Show a skeleton of the review form with the label "Reading prescription…".
- Server extracts (`05-AI-LAYER.md` §extract-prescription).
- On failure: the review form opens **empty and editable**, with an honest message — "Couldn't
  read the photo. Enter the details below." Never a dead end, never a silent console error.
- Extraction failure and "nothing found on the page" must be **distinguishable** to the user.

### 3c. Confirm — `/prescriptions/review`

The safety-critical screen. **Nothing is saved before this step.**

Layout: image on the left (desktop) or in a sticky collapsible panel on top (mobile), fields on
the right/below. The original photo must be visible while checking fields.

- Image viewer: pinch/scroll zoom, rotate, full-screen. A user must be able to read faint
  handwriting.
- **Visit fields:** doctor name, clinic, visit date, diagnosis/reason, doctor's advice,
  follow-up date, visit cost (optional).
- **Medicine list**, each row editable: name, strength, form, dose amount, frequency, duration,
  instructions. Add and remove rows freely.
- **Uncertain fields** get a neutral amber left border and a small "Check this" hint. Not red,
  not a warning banner. Focus lands on the first uncertain field.
- **Fields the parser could not determine are empty and required** — specifically frequency and
  duration. The save button explains what is missing rather than silently defaulting.
  Never write "5 days, twice daily" because parsing failed.
- **Ordered lab tests** section: extracted test names, editable, each with an optional scheduled
  date.
- **Interaction notes**, if any, appear inline as calm guidance — never a blocking modal, never
  alarming (`06-DOMAIN-RULES.md` §Drug interactions).
- Standard disclaimer under the extracted content, once.

**On save (single transaction):**
1. Upload images to Storage; insert `visits` + `visit_images`.
2. Insert `medicines`.
3. Generate `doses` via `src/domain/schedule.ts`.
4. Insert `test_orders` for each named test.
5. Write `extraction_audit` — raw model response, confirmed data, and which fields the user
   edited.
6. Schedule notifications for the new doses.
7. Navigate to the schedule with a summary toast: "Saved — 12 doses scheduled over 5 days."

If any step fails, the whole save fails cleanly with a retry. Never half-save a prescription.

---

## 4. Medicine schedule

**Route:** `/medicines` — three tabs: **Today**, **Cabinet**, **History**

### Today
- Date strip: previous/next day, "Today" jump, and a date picker. Past days are editable
  (retroactive marking); future days are read-only.
- Doses grouped by bucket — Morning / Afternoon / Evening / Night — each **appearing in exactly
  one group** (`06-DOMAIN-RULES.md` §Time buckets). Empty buckets are hidden.
- Each dose card: time, medicine name, dose amount, instruction chip if any ("after meals"),
  status, and Taken / Skip buttons ≥44px and well separated.
- Marking is **optimistic** and **queued offline**, flushed on reconnect. This is the most
  important offline write in the app.
- Skip optionally captures a one-tap reason (forgot / felt better / ran out / side effect).
  "Ran out" offers a refill note; "side effect" opens the side-effect log pre-filled.
- Overdue doses: muted amber, still actionable, sorted in place. Not red.
- Header shows the day's progress ring.
- **No confetti, no celebration animation.** A quiet checkmark transition.

### Cabinet
- Every current medicine as a card: name, strength, frequency in plain words ("twice a day"),
  duration progress ("day 3 of 5"), prescriber, and start date.
- Actions: view detail, log a side effect, discontinue (confirm dialog — removes future pending
  doses, keeps history), edit.
- **PRN medicines** live here with a "Take as needed" action that logs an ad-hoc dose. They never
  appear on the timed schedule.
- "Add a medicine yourself" for OTC/self-added: name, strength, dose, frequency, duration, start
  date. Same domain rules, no AI needed.
- Separate collapsed section: "Finished courses", labelled clearly.

### History
- Reverse-chronological log of every dose with status and timestamp.
- Filter by medicine, by status, by date range. Search by name.
- Adherence summary for the selected range: scheduled / taken / skipped / missed and a
  percentage, with a simple weekly bar chart.
- Neutral tone throughout — information, not judgement.

---

## 5. Medicine detail

**Route:** `/medicines/:name`

- Header: name, strength, form.
- **Prescription context:** who prescribed it, when, for what, duration, and the instruction.
- **What it's for** — plain-language information from `explain-medicine`, cached in
  `localStorage` keyed by normalised name so the same medicine is never fetched twice.
  Under the standard "general information only" disclaimer.
- **Common side effects** as calm, factual chips — not scare copy.
- **Your history with this medicine:** adherence for this medicine, doses taken, side effects
  logged.
- **Log a side effect** — note, severity, timestamp.
- If the medicine is unknown to the model, say so plainly and keep the prescription context
  visible. Never fabricate drug information.

---

## 6. Reminders

**No route — background system.** This is the feature the product's tagline promises, so it must
actually work.

- **Permission flow:** requested at a moment that makes sense (after the first prescription is
  saved, or in onboarding), with a stated reason. Never on cold app open. If denied, the app
  keeps working and offers an in-app "due now" banner instead, with a path to re-enable.
- **Service worker** schedules and shows notifications. On dose time: medicine name, dose amount,
  and two actions — **Taken** and **Snooze**. Acting from the notification updates the record
  without opening the app.
- **Snooze** default 10 minutes, configurable 1–120.
- **Quiet hours:** doses due inside the window are not notified; they surface as an in-app
  banner instead. Configurable per profile.
- **Lead time:** optionally notify N minutes early.
- Settings expose a **"Send a test notification"** button — the only reliable way for a user to
  confirm it works on their phone.
- Be honest about platform limits: on iOS Safari, notifications require the app to be installed
  to the home screen. Detect it and explain it, once, rather than silently failing.
- **Never** notify for a PRN medicine.

---

## 7. Lab reports

**Routes:** `/reports`, `/reports/new`

### Upload — `/reports/new`
- Accept images **and PDFs**, multi-page, same compression pipeline as prescriptions.
- If pending test orders exist, ask up front: "Is this the result for CBC (ordered 3 Aug)?"
  Pre-selecting the target makes linking accurate and skips the guessing.
- Extract values (`05-AI-LAYER.md` §extract-lab-report).
- **Confirm screen** with the image beside the values: test name, value, unit, reference range —
  all editable. Add and remove rows.
- **Range status is computed by our own code**, not taken from the model
  (`06-DOMAIN-RULES.md` §Reference ranges). Each row shows a badge: Within range / Below range /
  Above range / Not evaluated.
- **Auto-link suggestion:** if a value's canonical name matches a pending order, show
  "This looks like the result for CBC — link it?" with confirm/dismiss. Never link silently.
- On save: `reports`, `report_images`, `report_results`, plus `test_orders` updated to
  `completed` with `report_id` and `link_method` where confirmed. Write `extraction_audit`.

### List — `/reports`
- Cards by date: title, lab, date, count of values, and a count of out-of-range values.
- Tap opens the full result table plus the original image.
- **Trends:** for any test with 2+ numeric results over time, a line chart with a shaded
  reference band, so a line has clinical meaning. Points outside the band are marked.
  If units differ between reports, do not plot them together — say the results are not
  comparable and show them as separate series.
- Out-of-range wording is always *"outside the typical range — worth discussing with your
  doctor"*.
- Charts and PDF rendering are lazy-loaded chunks.

---

## 8. Timeline

**Route:** `/timeline`

One reverse-chronological history of everything.

- Entry types: visit, lab report, side effect, test order, and course started/finished.
- Filter chips: All / Visits / Reports / Tests / Side effects. Counts on each.
- Date range filter, plus text search across doctor, diagnosis, medicine, and test names.
- Visit entries expand to show medicines prescribed, tests ordered, the advice, and a thumbnail
  of the prescription.
- **Edit and delete** available on every record, with confirmation. An app that cannot correct a
  mistake is not trustworthy.
- Groups by month with sticky headers.
- Paginate or virtualise — a two-year history must stay smooth on a mid-range phone.

---

## 9. Doctor handoff

**Routes:** `/settings/share` (management), `/share/:token` (public view)

Two distinct deliverables.

### 9a. Printable brief
- A one-page A4 clinical summary, generated client-side, print-optimised (`@media print`).
- Sections, in order:
  1. Patient — name, age, sex, blood group, **allergies**, **chronic conditions**.
  2. **Currently taking** — from `activeMedicines` only (`06-DOMAIN-RULES.md` §Active).
  3. Recently finished (last 30 days), clearly labelled as finished.
  4. Recent visits — last 5, with dates, doctors, and reasons.
  5. Out-of-range lab values — last 90 days, with values, ranges, and dates.
  6. Pending tests.
  7. Logged side effects.
- Footer: generated date, "patient-reported record", and a note that it is not a medical
  document issued by a clinician.
- Actions: Print / Save as PDF.
- **Correctness is the point.** A finished antibiotic course listed as current is the failure
  mode that destroys trust with the exact audience the product needs.

### 9b. Share link
- "Create share link" calls `POST /api/share/create`, which builds the snapshot **server-side**,
  stores only the token hash, and returns the raw token **once**.
- The URL is `/share/<opaque-token>` — no patient data in the URL, ever.
- User picks an expiry: 1 hour / 24 hours / 7 days. Enforced server-side.
- Show a QR code (small payload, so it always renders) plus a copy button.
- **Active links list**: created time, expiry, view count, last viewed, and a **Revoke** button
  that genuinely and permanently kills that link.
- `/share/:token` is a standalone public page: clean clinical layout, no app shell, no
  navigation, read-only, no session. Expired or revoked shows a plain message.
- Copy must state exactly what is shared and for how long. **Never label it "secure"** — say
  what it is: "a read-only summary, viewable until 3 Aug 6:00 PM, revocable any time."

---

## 10. Symptom help

**Route:** `/symptoms`

**The red-flag check runs locally, first, always** (`06-DOMAIN-RULES.md` §Red flags).

Flow:
1. Text input plus one-tap common symptoms. Voice input optional; if used, set language to
   `ur-PK` when Urdu is detected — do not pin to `en-US`.
2. **On submit, run `checkRedFlags` locally before any network call.**
3. If it fires: show the emergency screen immediately — helplines, tap-to-call, and clear "seek
   care now" guidance. No AI, no waiting, works fully offline.
4. If it does not fire: optionally call `suggest-specialist` for a specialty suggestion with
   reasoning, plus a "Find nearby" link to a maps search.
5. If the network call fails, say so and still offer: log a visit manually, or see the helplines.
6. Disclaimer, prominent: this helps you choose who to see, it is not a diagnosis.
7. Exit path to "I saw a doctor — log the prescription".

Screen title is "Feeling unwell?" — not "AI Triage".

---

## 11. Search your records

**Route:** `/search`

Natural-language questions about the user's own records ("when did I last take Panadol?",
"what was my hemoglobin in June?").

- **Structured search first.** Before calling any model, run a local search over medicines,
  visits, reports, and doses. Many queries — a medicine name, a test name, a date — are answered
  instantly, offline, with zero token cost. Show those results directly.
- Only fall through to `ask-records` for genuinely conversational queries.
- **Context is strictly budgeted** (`05-AI-LAYER.md` §Context budget). Never serialise the whole
  history into a prompt; retrieve only the relevant slice.
- Answers render as clean text, lists, and tables. Medicine names in an answer link to the
  medicine detail.
- Every answer states what it was based on ("from 3 visits and 2 reports") so the user can tell
  when the app has not found something.
- If records do not contain the answer, say so plainly. Never fill the gap with invention.
- Suggested starter questions on the empty state.
- Nav label: **"Search records"**.

---

## 12. Settings

**Route:** `/settings`

Sections:

- **Profile** — name, DOB, sex, blood group, height, weight, **allergies**, **chronic
  conditions**, emergency contact. Allergies and conditions get prominent placement; they matter
  most on the doctor brief.
- **Reminders** — enable, quiet hours, snooze, lead time, send test notification.
- **Share links** — active links, revoke (see §9b).
- **Data**
  - **Export everything** — JSON download (`02-DATA-MODEL.md` §Export). Also PDF export of the
    full history.
  - **Import** — file picker, validation, merge or replace choice.
  - Storage usage summary.
- **About** — app version, medical disclaimer, privacy policy (what is stored, what is sent to
  the AI endpoint, what is never sent), contact.
- **Danger zone** — visually separated, at the bottom.
  - Delete all records: requires typing an exact phrase, **and** offers export first.
  - Delete account: same, plus explicit warning it is irreversible.
  - Neither is ever reachable from primary navigation.

---

## 13. Cost tracking

Not a separate screen; woven through, because healthcare is out of pocket for this user.

- Optional cost field on visits, medicines, and reports.
- A monthly summary in Settings → Data: spend by category and total.
- Never required, never nagged about.

---

## Priority order

If time runs short, ship in this order. Everything above 6 is required for a usable product.

1. Auth + profile
2. Prescription capture → confirm → save
3. Schedule (Today + Cabinet)
4. Reminders
5. Export / import
6. Lab reports + auto-link
7. Timeline + edit/delete
8. Doctor brief + share
9. Symptom help
10. Search
11. Trends, adherence history, cost tracking
