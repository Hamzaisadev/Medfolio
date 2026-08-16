# 00 — Brief

## What you are building

Medfolio is a patient-owned health record app for **Pakistani patients**. The user photographs
a handwritten prescription; the app turns it into a medicine schedule that reminds them, tracks
what they actually took, and produces a clean one-page summary they can hand to a doctor at the
next visit.

## The one-sentence thesis

> **Photograph any prescription, never miss a dose, walk into your next appointment with a
> complete history.**

Judge every design and scope decision against that sentence. The prescription →
schedule → reminder → summary loop is the product. Everything else exists to serve it.

## Who the user is

Design for this person specifically, not for a generic "user":

- **Pakistani patient**, mid-range Android phone (assume a 6.1" 720×1600 screen), mobile-first,
  frequently on a slow or intermittent connection.
- **Prescriptions are handwritten**, often in a hurry, and use Latin dosing shorthand —
  `BD`, `TDS`, `OD`, `QID`, `HS`, `PRN`, `SOS`, `STAT`. See `06-DOMAIN-RULES.md`. They get lost.
- **Lab reports arrive as photos or PDFs on WhatsApp.** Both formats must be accepted.
  A lab report routinely runs to 2–3 pages.
- Speaks **English, Urdu, and Roman Urdu**, frequently mixed in a single sentence
  (*"bukhar aur gale me dard"* = fever and throat pain). The app ships in English but the AI
  layer must understand all three, and the UI must not break with Urdu text.
- Healthcare is **largely out of pocket**. Repeating a lab test because the result was lost is
  a real financial loss. Cost visibility matters.
- **One household member typically manages records for parents and children.** v1 ships
  single-profile, but the schema must not make family profiles impossible later — see the
  `profile_id` column in `02-DATA-MODEL.md`.
- Assume **low trust in apps handling medical data**, and assume they will show the doctor
  whatever the app produces. Anything inaccurate is embarrassing at best and harmful at worst.

## Scope — v1 ships all of this

Seven areas. Detailed specs in `04-FEATURES.md`.

| Area | Core capability |
|---|---|
| **Prescription capture** | Photo → extract → **confirm** → schedule + tracked lab-test orders |
| **Medicine schedule** | Today's doses bucketed by time, mark taken/skipped, adherence history, manual/OTC entry, medicine reference info |
| **Reminders** | Real local notifications when a dose is due, with snooze and quiet hours |
| **Lab reports** | Photo/PDF → extract values → range evaluation → auto-link to the ordered test → trend charts |
| **Timeline** | Unified reverse-chronological history of visits, reports, side effects, and test orders |
| **Doctor handoff** | Printable one-page clinical brief + a genuinely revocable, expiring share link |
| **Symptom help** | Offline red-flag emergency check with Pakistani helplines, plus specialist suggestion |
| **Record search** | Natural-language question answering over the user's own records |

## Non-negotiables

Safety and trust properties. Not tradeable for velocity.

1. **The AI proposes; the patient confirms.** Nothing extracted from an image is ever written
   to the schedule without an explicit confirm step, with the original image visible beside the
   extracted fields. Persist what the model said *and* what the user corrected
   (`extraction_audit` in `02-DATA-MODEL.md`) — this is the audit trail for a dosing error.

2. **Never silently default a dosage, frequency, or duration.** If the model cannot read it, or
   the parser cannot interpret it, the field is left empty and marked as needing input. It is
   always better to ask than to invent "5 days, twice daily". An OCR error on a dosage is a
   real-world harm.

3. **Emergency help works with no network.** A local keyword red-flag check
   (`06-DOMAIN-RULES.md` §Red flags) runs *before and independently of* any network call, and
   the Pakistani helplines are reachable from the dashboard in one tap without going through
   any AI flow at all. Never gate an emergency path behind a network response.

4. **Export ships before any nice-to-have.** Full JSON export and import, plus PDF export.
   Medical history must never be trapped in one place with no way out.

5. **No destructive action without type-to-confirm**, and never in primary navigation.
   "Delete all my records" requires typing a phrase, and requires an export first.

6. **Never claim a security property the code does not have.** If a share link cannot be
   revoked, there is no "Revoke" button and no "secure" label. Server-enforced expiry and
   revocation, or no such feature.

7. **The app never diagnoses.** Lab values outside a reference range are described as
   *"outside the typical range — worth discussing with your doctor"*. Never "abnormal",
   never "you have". Every AI-derived medical statement carries a visible disclaimer.

8. **Patient data is never sent anywhere except Supabase and the AI endpoint**, and the AI
   endpoint receives only the minimum needed for the current request — never the full history.
   See `05-AI-LAYER.md` §Context budget.

## Interface requirements

Interface quality is a primary requirement, not a finishing pass. Specifics:

**Must be true of every screen:**
- Mobile-first. Designed at 360px wide, enhanced upward. Touch targets ≥ 44px.
- One spacing scale, one radius scale, one shadow scale, one type scale — from
  `03-DESIGN-SYSTEM.md`. No arbitrary values.
- Every list has a designed **empty state** with a clear next action.
- Every async operation has a **loading state** (skeleton, not a spinner where content will
  appear) and a **visible, actionable error state**. Never fail silently to the console.
- Keyboard accessible, focus visible, `Escape` closes overlays, focus is trapped in modals and
  restored on close.
- Passes contrast at 4.5:1 for body text. State is never communicated by colour alone.
- Pinch-zoom is never disabled.

**Must not be true of any screen:**
- No component-injected `<style>` tags. No global unscoped class names. Tailwind utilities and
  the tokens in `03-DESIGN-SYSTEM.md`, nothing else.
- No dead-end flows. Every screen has a way back and a clear next step.
- No decorative animation on repeated actions. Celebrating every single tap gets old by the
  third dose.

## Product voice requirement

The owner's explicit instruction: the interface must **not** be plastered with AI branding and
markings.

Concretely, none of these exist anywhere in the product:
- Status badges announcing that AI is active or which model is running.
- Sparkle/magic icons used as decoration on features.
- Screens or nav items named after the technology ("Ask AI", "AI Verification").
- Invented copy about model tiers, server load, or "our strongest AI".
- Confidence flags shouting at the user in alarm colours.

The correct framing everywhere is **what the user gets**, not **how it works**:
"Scan prescription", not "AI extraction". "Check these details", not "AI Verification".
The full replacement table and an enforcing lint rule are in `03-DESIGN-SYSTEM.md`
§Product voice. Treat it as a hard requirement.

## Definition of success for v1

A user on a mid-range Android phone with an unreliable connection can:

1. Sign up, photograph a handwritten prescription, correct two misread fields, and confirm.
2. See a correct schedule for today — **in Pakistan Standard Time (UTC+05:00)** — with each
   dose appearing in exactly one time bucket.
3. Receive an actual notification when a dose is due, and mark it taken from that notification.
4. Upload a lab report photo and have it automatically attach to the test their doctor ordered.
5. Export everything to a JSON file, clear the browser completely, sign in on another device,
   and see their records intact.
6. Generate a one-page doctor brief listing only the medicines they are **currently** taking —
   with finished courses correctly excluded.
7. Type "chest pain" with the network disabled and still get the emergency helplines.

If any of those seven fail, v1 is not done. `08-DEFINITION-OF-DONE.md` expands each into a
testable gate.
