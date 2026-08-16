# 07 — Build Plan

Your worklist. Work in order — later tasks assume earlier ones. Each task has an **acceptance
check**; run it before moving on. One task per commit.

`npm run verify` must pass before every commit.

Estimates assume a competent agent working uninterrupted. They are for sequencing, not deadlines.

---

## Phase 0 — Foundations

Nothing else works properly until these are right.

### T0.1 — Scaffold the project
Fresh directory. `npm create vite@latest medfolio -- --template react-ts`.
Install the stack in `01-ARCHITECTURE.md` §Stack. Set up `tsconfig` with `strict: true`,
`noUncheckedIndexedAccess: true`, and the `@/*` path alias. Add all scripts from
§Scripts. Create the folder skeleton from §Folder layout with `.gitkeep` files.
`git init`, first commit.

**Accept:** `npm run dev` serves a blank page. `npm run verify` passes. No `tailwind.config.js`
exists.

### T0.2 — Tailwind v4 + design tokens
Install `tailwindcss` + `@tailwindcss/vite`. Create `src/styles/theme.css` with the full
`@theme` block from `03-DESIGN-SYSTEM.md`. Self-host Inter via `@fontsource-variable/inter`.
Set the viewport meta exactly as specified — no `user-scalable=no`.

**Accept:** a token class like `bg-brand-600` renders correctly. No Google Fonts network request
in the network tab. Pinch-zoom works on a phone.

### T0.3 — Lint, format, and the product-voice rule
ESLint with `typescript-eslint`, `react-hooks` (**`rules-of-hooks` as error**),
`jsx-a11y`, and Prettier + `prettier-plugin-tailwindcss`. Write the custom `no-ai-branding` rule
from `03-DESIGN-SYSTEM.md` §Enforcement, including the banned-icon import check.

**Accept:** a test file containing `<span>AI Active</span>` fails lint. A file importing
`Sparkles` from `lucide-react` fails lint. `npm run lint` passes on the real source.

### T0.4 — CI
GitHub Actions: `verify` on every push, `e2e` once Playwright exists. Bundle budget check
failing the build above 250 KB gzipped initial JS.

**Accept:** a deliberately broken type fails CI.

---

## Phase 1 — Domain layer

Build this **before any UI**. It is pure, fast to test, and everything depends on it being right.
Read `06-DOMAIN-RULES.md` fully first.

### T1.1 — `src/lib/time.ts`
`APP_TIMEZONE`, `todayInAppTz(now)`, `toAppDate`, `fromAppDate`, `formatDoseTime(minutes)`,
`parseTimeToMinutes`. **No other file in the project may call `toISOString` or slice a date
string** — add a lint restriction if practical.

**Accept:** unit test asserts that at `2026-08-15T21:30:00Z` (= 02:30 PKT on the 16th),
`todayInAppTz` returns `2026-08-16`. This is the bug that breaks every morning if missed.

### T1.2 — `frequency.ts`
All codes and every listed variant, including Roman Urdu and hourly forms. Unrecognised → `null`.
`defaultDoseTimes` with the meal-relation adjustment.

**Accept:** tests cover every row and every variant in §Frequency. `parseFrequency('xyz')`
returns `null` — not `'BD'`.

### T1.3 — `duration.ts`
**Accept:** `"1 tablet for 5 days"` → 5 days (not 1). `"continue"` → ongoing. `"till review"` →
unknown. A 5-day course starting Monday has `end_date` of Friday.

### T1.4 — `timeBuckets.ts`
**Accept:** a test iterating all 1,440 minute values asserts each maps to exactly one bucket.
Midnight wrap covered.

### T1.5 — `schedule.ts`
**Accept:** PRN generates zero doses. Null duration generates zero. Regeneration is idempotent.
**A test run at 02:00 PKT asserts the first dose date is today, not yesterday.**

### T1.6 — `referenceRange.ts`
**Accept:** every printed format in §Reference ranges parses. Qualitative values give `unknown`
unless comparable. Unparseable input gives `unknown`, never a false out-of-range.

### T1.7 — `testAliases.ts`
**Accept:** `CBC` and `Blood CP` both resolve to `Complete Blood Count`. `Vitamin D` does **not**
match `Vitamin B12`. Ambiguous input returns all candidates rather than picking one.

### T1.8 — `redFlags.ts`
**Accept:** every category in §Red flags fires in English, Roman Urdu, and Urdu script.
`"mild headache since yesterday"` does **not** fire. Zero imports, zero network.

### T1.9 — `activeMedicines.ts` and `adherence.ts`
**Accept:** a finished 5-day course from 2024 is excluded. An ongoing chronic medicine is
included. Future pending doses are excluded from the adherence denominator. PRN excluded.

**Phase 1 gate:** `npm run test` shows every domain file covered, and coverage on `src/domain/`
is ≥ 90%. Do not start UI work before this passes.

---

## Phase 2 — Data layer

### T2.1 — Supabase project and migrations
Create the project. Write migrations `0001`–`0013` exactly as listed in `02-DATA-MODEL.md`
§Migrations. Apply to the linked project.

**Accept:** `supabase db push` succeeds from a clean database. Every table exists with its
constraints.

### T2.2 — RLS policies and the isolation test
Enable RLS on every table with the four policies each. `shares` gets **no** anon access.
Storage policies restrict to the user's own path prefix.

**Accept:** an automated test creating two users asserts user B cannot read, update, or delete
any of user A's rows across every table. This test is mandatory — RLS gaps are silent until
they are a breach.

### T2.3 — Generated types and the client
`npm run db:types`. Single Supabase browser client in `src/lib/supabase/client.ts`.

**Accept:** `src/lib/supabase/types.ts` is generated and committed; typecheck passes.

### T2.4 — Repositories
One file per table in `src/lib/db/`. Typed functions only — no React, no component imports.

**Accept:** no file outside `src/lib/db/` and `src/features/*/api/` imports the Supabase client.

### T2.5 — Query layer
TanStack Query provider, sensible defaults, IndexedDB persistence, and an offline mutation queue
for dose marking.

**Accept:** mark a dose taken with the network disabled, reload — the change survives and syncs
on reconnect.

---

## Phase 3 — Shell and UI kit

### T3.1 — UI primitives
Every component in `03-DESIGN-SYSTEM.md` §UI primitives, using Radix for overlay/focus
semantics. Add a dev-only `/__ui` route rendering all of them in every state.

**Accept:** `/__ui` shows each primitive in default, hover, focus, disabled, loading, and error
states. Keyboard-only navigation works throughout. Escape closes overlays and focus returns to
the trigger.

### T3.2 — App shell and routing
React Router with all routes from `01-ARCHITECTURE.md` §Routing. `AppShell` with `TopBar` and
`BottomNav`. Route-level lazy loading. `ErrorBoundary` at the shell level with a real recovery
UI. `/share/:token` uses its own minimal layout outside the shell.

**Accept:** **at 767px exactly one nav is visible; at 768px exactly one nav is visible.** Never
two. Deep links work on refresh. A thrown render error shows the boundary, not a white screen.

### T3.3 — Auth and onboarding
Sign in, sign up, forgot password, route guards, session resolution without a login flash, and
the three-step onboarding from `04-FEATURES.md` §1.

**Accept:** a signed-in user reloading never sees the sign-in screen. A protected deep link
redirects to sign-in and returns after login. Signup creates the profile row automatically.

---

## Phase 4 — The core loop

This is the product. Everything before it was setup.

### T4.1 — Image pipeline
`src/lib/files/`: EXIF strip, orientation correction, resize to 2000px, WebP q0.82,
`pdfjs-dist` rasterisation, Supabase Storage upload with signed-URL reads.

**Accept:** a 6 MB portrait phone photo uploads under 300 KB, correctly oriented. A 3-page PDF
becomes 3 images.

### T4.2 — `/api/extract-prescription`
The endpoint per `05-AI-LAYER.md`: JWT verification, rate limit, Zod request and response
schemas, structured output, one retry, no content logging.

**Accept:** a real prescription photo returns valid structured data. A malformed request gets
400. No auth header gets 401. `GEMINI_API_KEY` appears nowhere in the client bundle
(grep `dist/`).

### T4.3 — Capture screen
`/prescriptions/new` per `04-FEATURES.md` §3a — multi-page, camera and file, PDF support,
preview with retake, and "enter manually instead".

**Accept:** 3 pages can be added, reordered, and removed. Manual entry reaches the review screen
with no AI call made.

### T4.4 — Confirm screen
`/prescriptions/review` per §3c. Image viewer beside editable fields. Uncertain fields get the
neutral "Check this" treatment. **Missing frequency or duration blocks save with a clear
explanation** rather than defaulting.

**Accept:** a prescription with unreadable frequency cannot be saved until the user picks one,
and no default was silently applied. First uncertain field receives focus. Amber, never red.

### T4.5 — Save transaction
Visit + images + medicines + doses + test orders + `extraction_audit`, all-or-nothing, then
navigate with a summary toast.

**Accept:** a forced mid-save failure leaves **no** partial records. A successful save produces
the exactly correct number of dose rows for the frequency and duration.

### T4.6 — Schedule: Today
Date strip, buckets, dose cards, optimistic marking, offline queue, skip reasons, overdue
treatment, progress ring. **No confetti.**

**Accept:** a BD medicine shows exactly 2 doses, in 2 different buckets, never duplicated.
Marking works offline. Past days are editable, future days read-only.

### T4.7 — Schedule: Cabinet + manual add
Current medicines, PRN "take as needed", discontinue, finished-courses section, and the
self-added medicine form.

**Accept:** discontinuing removes future pending doses and keeps history. A PRN medicine never
appears on the timed schedule.

### T4.8 — Reminders
Service worker, permission flow with reason, scheduling, notification actions (Taken / Snooze),
quiet hours, lead time, test-notification button, iOS install detection.

**Accept:** a notification fires at the scheduled minute; tapping **Taken** updates the record
without opening the app; quiet hours suppress it into an in-app banner; the test button works.
**This is the feature the product promises — verify it on a real phone, not just desktop.**

### T4.9 — Export and import
JSON export including images, import with Zod validation, merge or replace, PDF full-history
export.

**Accept:** **export → wipe the database → import produces an identical record set**, verified by
an automated round-trip test. A malformed file is rejected with a message naming the bad field,
and existing data is untouched.

**Phase 4 gate:** a user can scan a prescription, get a correct schedule, be reminded, mark
doses, and export everything. That is a usable product. Ship it before continuing.

---

## Phase 5 — Reports and history

### T5.1 — `/api/extract-lab-report`
Per `05-AI-LAYER.md`. No `is_out_of_range` field — ranges are computed locally.

**Accept:** a multi-page report returns all rows with values and ranges as printed.

### T5.2 — Report upload and confirm
Pre-select the pending test order, editable value rows, locally computed range badges, and the
auto-link **suggestion** flow.

**Accept:** an uploaded CBC suggests linking to the pending CBC order and links only after
confirmation. Range badges match `referenceRange.ts`, not the model. Wording is "outside the
typical range", never "abnormal".

### T5.3 — Reports list and trends
Cards, full result tables, and lazy-loaded trend charts with reference bands. Mismatched units
are shown as separate, non-comparable series.

**Accept:** two hemoglobin results in the same unit plot as one line with a shaded band.
Two results in different units do not plot together and say why.

### T5.4 — Timeline
Unified feed, filters, date range, text search, expandable visits, month grouping, and **edit and
delete on every record type**.

**Accept:** every record type can be edited and deleted with confirmation. A 200-record history
scrolls smoothly on a throttled mobile profile.

### T5.5 — Medicine detail
Prescription context, cached plain-language info, side effects, per-medicine history, and the
side-effect log.

**Accept:** the same medicine is fetched once and served from cache after. An unknown medicine
says so rather than inventing information.

---

## Phase 6 — Handoff, symptoms, search

### T6.1 — Printable doctor brief
One-page A4, print-optimised, using `activeMedicines` only, with allergies and chronic conditions
prominent.

**Accept:** a finished 5-day course from last year does **not** appear under "Currently taking".
It appears under finished courses only if within 30 days. Print preview is one clean page.

### T6.2 — Share links
`create` / `[token]` / `revoke` endpoints, standalone public view, expiry choice, QR, active-link
list with view counts, and working revocation.

**Accept:** the URL contains only an opaque token and no patient data. Revoking makes the link
immediately dead. An expired link shows the expiry message. Editing the token in the URL yields
nothing. The word "secure" appears nowhere in the copy.

### T6.3 — Symptom help
Local red-flag check first, emergency screen with helplines, then the optional specialist
suggestion. Dashboard helplines row.

**Accept:** **with the network fully disabled**, typing "chest pain" shows the emergency screen
with tap-to-call helplines. No AI call is made before the local check runs.

### T6.4 — Search your records
Local structured search first, model fallback with strict context budgeting, markdown-lite
rendering, source attribution.

**Accept:** "when did I last take Panadol?" is answered locally with **no** network request.
A conversational query's request payload stays under 8k input tokens. Nav label reads
"Search records".

### T6.5 — Settings
Profile, reminders, share management, data export/import, about with disclaimer and privacy
policy, and the danger zone.

**Accept:** deleting all records requires typing the exact phrase and offers export first.
Neither destructive action is reachable from primary navigation.

---

## Phase 7 — Hardening

### T7.1 — PWA and offline
Manifest, icons, service-worker app shell, persisted query cache, offline indicator, queued
writes.

**Accept:** with the network disabled, the app opens and today's schedule and cabinet are
readable. Installs to an Android home screen.

### T7.2 — Accessibility pass
Keyboard-only walkthrough of every screen. Screen-reader pass on dashboard and confirm screen.
Contrast audit. Live regions on async results.

**Accept:** `jsx-a11y` clean, zero automated axe violations on every route, and every flow
completable with keyboard only.

### T7.3 — Performance pass
Route splitting, lazy charts and PDF, image lazy-loading, list virtualisation, bundle audit.

**Accept:** initial JS under 250 KB gzipped. Lighthouse mobile performance ≥ 90 on the dashboard.

### T7.4 — E2E suite
Playwright covering the seven gates in `08-DEFINITION-OF-DONE.md`.

**Accept:** all seven pass in CI.

### T7.5 — Ship
README with real setup instructions, `.env.example`, deploy to Vercel with environment variables
set, verify the production build end to end.

**Accept:** a fresh clone plus `.env` reaches a working local app by following the README alone.
Production has working AI calls and no secret in the client bundle.

---

## Sequencing notes

- **Do not start UI before Phase 1 passes.** Building screens on unverified clinical logic is how
  a dose ends up in two time buckets and "today" ends up wrong every morning — both invisible
  until a user notices.
- **Phase 4 is shippable.** Stop there and validate with a real user before Phase 5.
- **Never skip a task's acceptance check.** They are written to catch the specific failures this
  product is prone to.
- If a task turns out to be larger than expected, split it and note the split — do not silently
  compress the acceptance criteria.
