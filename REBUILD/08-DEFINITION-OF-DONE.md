# 08 — Definition of Done

Two layers: the **seven product gates** (end-to-end, automated in Playwright) and the
**engineering gates** (per-commit and pre-ship).

Nothing is "done" because the code exists. It is done when its gate passes.

---

## The seven product gates

Automate each in `e2e/`. All seven green in CI is the release condition for v1.

### Gate 1 — Prescription to schedule
A new user signs up, uploads a handwritten prescription photo, corrects two misread fields, and
confirms.

**Passes when:** a visit, its images, its medicines, and the exactly-correct number of dose rows
all exist; `extraction_audit` records the raw response, the confirmed data, and the two edited
field names.

**Fails if:** any field was silently defaulted, or a partial save is possible.

### Gate 2 — Correct schedule in Pakistan time
With the system clock at **02:00 PKT**, the schedule shows *today's* doses.

**Passes when:** the date shown equals `todayInAppTz`, and a twice-daily medicine shows exactly
two doses in two different buckets.

**Fails if:** the date is off by one, or any dose appears in more than one bucket.

### Gate 3 — A reminder actually fires
A dose is scheduled two minutes out. The notification appears. Tapping **Taken** updates the
record without opening the app.

**Passes when:** the dose row reads `taken` with a `taken_at` timestamp, set from the
notification action.

**Fails if:** notifications are only simulated in tests. **Verify this manually on a real Android
phone before shipping.** This is the feature the product's tagline promises.

### Gate 4 — Lab report auto-links to the ordered test
A visit orders a CBC. The user later uploads a CBC report photo.

**Passes when:** the app *suggests* the link, and on confirmation the `test_orders` row is
`completed` with `report_id` set and `link_method = 'auto'`. Range statuses match
`referenceRange.ts` exactly.

**Fails if:** the link happened silently, or a wrong-test match is possible (e.g. Vitamin D
result attaching to a Vitamin B12 order).

### Gate 5 — Data survives a device change
Export to JSON, wipe the browser completely, sign in on a fresh context, import the file.

**Passes when:** the record set is byte-identical in content — every visit, medicine, dose
status, report, result, and image intact.

**Fails if:** anything is lost, duplicated, or silently skipped.

### Gate 6 — The doctor brief is clinically correct
A profile with one finished 5-day course from last year, one ongoing chronic medicine, and one
active current course generates a brief.

**Passes when:** "Currently taking" lists exactly the two genuinely active medicines. The
finished course appears only under finished courses, clearly labelled. Allergies and chronic
conditions are present and prominent.

**Fails if:** a finished course appears as current. This is the failure that destroys credibility
with doctors, who are the growth loop.

### Gate 7 — Emergency help works offline
With the network fully disabled, the user types "chest pain".

**Passes when:** the emergency screen appears immediately with three tap-to-call helplines, and
**no** network request was attempted before the local check ran. The dashboard helpline row is
also reachable in one tap offline.

**Fails if:** anything in this path waits on a network response.

---

## Engineering gates — every commit

`npm run verify` passes, meaning:

- **Typecheck** — `tsc --noEmit` clean, `strict: true`, `noUncheckedIndexedAccess: true`.
- **Lint** — `eslint . --max-warnings 0`, including:
  - `react-hooks/rules-of-hooks` as an **error** — no hook after a conditional return.
  - `no-ai-branding` — no "AI"/"Gemini"/"powered by" in UI strings outside the two allow-listed
    files; no `Sparkles` / `Wand` / `Bot` icon imports.
  - `jsx-a11y` clean.
- **Tests** — `vitest run` green; `src/domain/` coverage ≥ 90%.
- **Build** — succeeds; initial JS chunk ≤ 250 KB gzipped.

---

## Engineering gates — before shipping

### Security
- [ ] `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` appear nowhere in `dist/` — verify by grep.
- [ ] No environment variable holding a secret is prefixed `VITE_`.
- [ ] RLS enabled on every table, with the cross-user isolation test passing.
- [ ] `shares` has no anon access; the public share read goes only through the server function.
- [ ] Share URLs contain an opaque token and no patient data.
- [ ] Revoking a share link makes it immediately and permanently dead.
- [ ] Storage bucket is private; reads use short-lived signed URLs.
- [ ] Every `/api` route verifies the JWT and derives `user_id` from it, never from the body.
- [ ] Rate limiting active on all AI endpoints.
- [ ] No request content (patient data) is written to logs.
- [ ] No forged User-Agent or header spoofing anywhere.

### Correctness
- [ ] Every `06-DOMAIN-RULES.md` function has tests, including the mandatory cases listed there.
- [ ] No date handling outside `src/lib/time.ts`.
- [ ] No dose time stored or compared as a formatted string.
- [ ] No clinical default applied silently — unparseable frequency or duration always asks.
- [ ] `range_status` computed locally, never taken from the model.
- [ ] Auto-linking is exact/alias only, never fuzzy, and always user-confirmed.
- [ ] Active medicines filtered by date and discontinuation, everywhere they are shown.

### Interface
- [ ] No `<style>` element in any component; no global hand-written class names.
- [ ] No hardcoded colours or arbitrary Tailwind values.
- [ ] Every list has an empty state; every async view has loading and error states.
- [ ] No `alert()`, `confirm()`, or `prompt()` anywhere.
- [ ] Exactly one nav visible at every viewport width — checked at 767px and 768px.
- [ ] No destructive action within one tap of primary navigation.
- [ ] Type-to-confirm on both destructive actions, each offering export first.
- [ ] No confetti or celebration animation on repeated actions.
- [ ] Pinch-zoom enabled; viewport meta has no `user-scalable=no` or `maximum-scale`.
- [ ] Zero automated axe violations on every route.
- [ ] Every flow completable with keyboard only; focus visible and restored after overlays.
- [ ] Body text ≥ 4.5:1 contrast; no state conveyed by colour alone.
- [ ] No component file over ~250 lines.

### Product voice
- [ ] The word "AI" appears only in the disclaimer constants and the privacy policy.
- [ ] No status badge announcing AI, no model names, no "powered by".
- [ ] No sparkle, wand, magic, or robot icons anywhere.
- [ ] Nav reads "Search records", not "Ask AI".
- [ ] No invented progress narration about model tiers, traffic, or effort.
- [ ] Uncertain fields use neutral amber and "Check this" — never red, never "Low Confidence".
- [ ] The standard disclaimer appears under every extracted or generated medical statement.
- [ ] Out-of-range wording is "outside the typical range — worth discussing with your doctor".
- [ ] The share feature is never described as "secure"; copy states what is shared and until when.

### Resilience
- [ ] Every AI feature has a working manual fallback; the app is fully usable with AI down.
- [ ] Extraction failure is distinguishable from "nothing readable in the photo".
- [ ] Marking a dose works offline and syncs on reconnect.
- [ ] App shell opens offline.
- [ ] `ErrorBoundary` at the shell with real recovery, not a white screen.
- [ ] No user-facing failure handled only by `console.error`.

### Operational
- [ ] `README` gets a fresh clone to a running app using only its own instructions.
- [ ] `.env.example` complete and committed; `.env` git-ignored.
- [ ] Migrations apply cleanly from an empty database.
- [ ] Generated Supabase types committed and current.
- [ ] CI green on `verify` and `e2e`.
- [ ] Production deploy verified: AI calls work, no secrets in the bundle, share links work.

---

## What "not done" looks like

Reject the work — regardless of how much is built — if any of these are true:

- A dose appears in two time buckets, or "today" is wrong in the early morning.
- A frequency or duration was defaulted because parsing failed.
- The doctor brief lists a finished course as current.
- The emergency path waits on a network call.
- A share link cannot be revoked, or carries patient data in the URL.
- A user can lose data with no export path.
- Any secret is reachable from the browser.
- The UI says "AI" outside the two allowed places, or uses a sparkle icon.
- A screen has no empty, loading, or error state.

Each of these is a specific, predictable failure mode for this product. They are listed because
they are the ones most likely to happen — not hypotheticals.
