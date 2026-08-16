# 03 — Design System

Interface quality is a primary requirement for this product. This document is the contract.
Follow it literally.

## Principles

1. **Calm, not clinical-scary.** A person using this app may be unwell or worried. Generous
   whitespace, restrained colour, no alarm red unless something is genuinely urgent.
2. **Content first, chrome second.** No decorative panels, no gradient-on-gradient, no badge on
   every card. If an element does not help the user act or understand, remove it.
3. **One of everything.** One spacing scale, one radius scale, one shadow scale, one type scale.
   Arbitrary values (`p-[13px]`, `#0d9488`) are a lint error.
4. **Mobile is the design target**, not a responsive afterthought. Compose at 360px.
5. **Every state is designed** — empty, loading, error, offline, and success. A screen without
   all five is unfinished.

## Tailwind v4 setup

Tailwind v4 is CSS-first. There is **no `tailwind.config.js`**. All tokens live in
`src/styles/theme.css`, which is the only stylesheet in the project.

```css
/* src/styles/theme.css */
@import "tailwindcss";

@theme {
  /* ---------- Colour ---------- */
  /* Brand: teal. Medical, calm, not the default SaaS blue. */
  --color-brand-50:  oklch(0.977 0.017 180);
  --color-brand-100: oklch(0.947 0.038 180);
  --color-brand-200: oklch(0.897 0.070 180);
  --color-brand-300: oklch(0.828 0.104 180);
  --color-brand-400: oklch(0.746 0.120 180);
  --color-brand-500: oklch(0.670 0.117 180);
  --color-brand-600: oklch(0.582 0.103 181);   /* primary actions */
  --color-brand-700: oklch(0.505 0.087 182);
  --color-brand-800: oklch(0.437 0.072 183);
  --color-brand-900: oklch(0.386 0.061 184);

  /* Neutrals: slate. Text, borders, surfaces. */
  --color-ink-50:  oklch(0.984 0.003 248);
  --color-ink-100: oklch(0.968 0.007 248);
  --color-ink-200: oklch(0.929 0.013 256);
  --color-ink-300: oklch(0.869 0.020 252);
  --color-ink-400: oklch(0.704 0.040 257);
  --color-ink-500: oklch(0.554 0.046 257);     /* muted text — meets 4.5:1 on white */
  --color-ink-600: oklch(0.446 0.043 257);
  --color-ink-700: oklch(0.372 0.044 257);
  --color-ink-800: oklch(0.279 0.041 260);
  --color-ink-900: oklch(0.208 0.042 266);     /* primary text */

  /* Semantic. Each has bg / border / text tuned for contrast. */
  --color-ok-bg:     oklch(0.979 0.021 166);
  --color-ok-border: oklch(0.905 0.056 165);
  --color-ok-text:   oklch(0.448 0.119 151);
  --color-warn-bg:     oklch(0.987 0.026 102);
  --color-warn-border: oklch(0.905 0.076 96);
  --color-warn-text:   oklch(0.476 0.114 62);
  --color-risk-bg:     oklch(0.971 0.013 18);
  --color-risk-border: oklch(0.885 0.062 18);
  --color-risk-text:   oklch(0.457 0.177 26);
  --color-info-bg:     oklch(0.970 0.014 254);
  --color-info-border: oklch(0.882 0.059 254);
  --color-info-text:   oklch(0.488 0.217 264);

  /* ---------- Type ---------- */
  /* One family. Self-host with @fontsource — do not block first paint on Google Fonts. */
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --text-xs:   0.75rem;   --text-xs--line-height:   1.5;
  --text-sm:   0.875rem;  --text-sm--line-height:   1.5715;
  --text-base: 1rem;      --text-base--line-height: 1.5;
  --text-lg:   1.125rem;  --text-lg--line-height:   1.45;
  --text-xl:   1.25rem;   --text-xl--line-height:   1.4;
  --text-2xl:  1.5rem;    --text-2xl--line-height:  1.3;
  --text-3xl:  1.875rem;  --text-3xl--line-height:  1.2;

  /* ---------- Radius ---------- */
  --radius-sm: 0.375rem;
  --radius-md: 0.625rem;
  --radius-lg: 0.875rem;
  --radius-xl: 1.125rem;

  /* ---------- Elevation ---------- */
  /* Three levels. Nothing floats higher than a modal. */
  --shadow-card:  0 1px 2px 0 oklch(0.208 0.042 266 / 0.04),
                  0 1px 3px 0 oklch(0.208 0.042 266 / 0.06);
  --shadow-raise: 0 4px 6px -1px oklch(0.208 0.042 266 / 0.07),
                  0 2px 4px -2px oklch(0.208 0.042 266 / 0.05);
  --shadow-over:  0 20px 25px -5px oklch(0.208 0.042 266 / 0.10),
                  0 8px 10px -6px oklch(0.208 0.042 266 / 0.06);

  /* ---------- Motion ---------- */
  --ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 140ms;
  --duration-base: 220ms;
}

@layer base {
  html { -webkit-text-size-adjust: 100%; }
  body {
    @apply bg-ink-50 text-ink-900 font-sans antialiased;
  }
  /* Visible focus everywhere. Never remove it. */
  :focus-visible {
    @apply outline-2 outline-offset-2 outline-brand-600;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

**Spacing** uses Tailwind's default 4px scale. Allowed values only: `1 2 3 4 5 6 8 10 12 16 20 24`.

**Dark mode** is out of scope for v1. Do not scatter `dark:` variants; using tokens means it can
be added later in one file.

## Layout

```
Mobile (<768px)          Desktop (≥768px)
┌─────────────────┐      ┌──────────────────────────────┐
│ TopBar    56px  │      │ TopBar  (nav inline)   64px  │
├─────────────────┤      ├──────────────────────────────┤
│                 │      │                              │
│   Page          │      │   Page  (max-w-5xl centred)  │
│   px-4 py-5     │      │   px-8 py-8                  │
│                 │      │                              │
├─────────────────┤      └──────────────────────────────┘
│ BottomNav  64px │
└─────────────────┘
```

- **Exactly one navigation component at each breakpoint.** `BottomNav` renders below 768px,
  `TopBar` links render at 768px and above, and the two never appear together. Verify at 767px
  and 768px explicitly — a mismatched breakpoint pair produces two stacked navs, which is a bug
  that ships easily and looks terrible.
- Bottom nav has **exactly five items**: Home, Medicines, Timeline, Reports, More.
  Five is the maximum that stays tappable at 360px. Search, symptoms, and settings live
  behind "More".
- Content respects safe areas: `pb-[calc(4rem+env(safe-area-inset-bottom))]`.
- Max content width `max-w-5xl`. Reading columns cap at `max-w-2xl`.

## UI primitives

Build these in `src/components/ui/` **before** building any feature. Every one is typed,
keyboard accessible, and has a story in the dev route `/__ui` for visual review.

Use **Radix UI primitives** (`@radix-ui/react-*`) for anything with focus or overlay semantics —
Dialog, Popover, Tabs, Select, Tooltip, Switch — and style them with Tailwind. Do not hand-roll
focus traps or dismiss logic.

| Component | Requirements |
|---|---|
| `Button` | Variants: `primary`, `secondary`, `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. Built-in `loading` state that disables and shows a spinner while preserving width (no layout shift). Min height 44px at `md`. |
| `IconButton` | Requires an `aria-label`. 44px hit area even when the icon is 16px. |
| `Card` | Surface, `--shadow-card`, `--radius-lg`, `border-ink-200`. Optional header/footer slots. No gradients. |
| `Field` | Label + control + hint + error, wired with `htmlFor`/`aria-describedby`/`aria-invalid`. Every input in the app uses it. Errors are text, never colour alone. |
| `Input` `Textarea` `Select` `DateInput` `NumberInput` | 44px min height, 16px font on mobile (smaller triggers iOS zoom). |
| `Badge` | Tones: `neutral`, `ok`, `warn`, `risk`, `info`. Text label always — never a bare coloured dot. |
| `Sheet` | Bottom sheet on mobile, side panel on desktop. Radix Dialog underneath. Escape closes, focus trapped and restored, background scroll locked. |
| `Dialog` | Centred modal for short confirmations only. Anything longer is a Sheet or a page. |
| `ConfirmDialog` | Two modes: simple confirm, and **type-to-confirm** (user types an exact phrase) for destructive actions. |
| `Tabs` | Radix Tabs. Arrow-key navigable. |
| `Skeleton` | Shape-matched placeholders. Use where content will appear; use a spinner only for actions. |
| `EmptyState` | Icon + heading + one sentence + primary action. Every list uses it. |
| `ErrorState` | What failed, in plain language + a Retry button + a manual fallback path where one exists. |
| `Toast` | Bottom on mobile, top-right on desktop. Auto-dismiss 5s; errors persist until dismissed. Never the only channel for an important message. |
| `Stat` | Label + value + optional trend. Used on the dashboard. |
| `ProgressRing` | Adherence percentage. Includes a text value inside — never conveys meaning by arc alone. |
| `Disclaimer` | Small, muted, bordered note. Used under every AI-derived medical statement. |

## Content patterns

**Dose card** — the most-used component in the app. Requirements:
- Time, medicine name, dose amount, status, and two actions readable at a glance on a 360px screen.
- Taken / Skip are separate buttons, ≥44px, far enough apart that a thumb cannot mis-hit.
- Status is shown by **icon + text + subtle background**, never colour alone.
- Tapping the medicine name opens the medicine detail; tapping the card body does nothing
  (prevents accidental navigation while marking doses).
- An overdue dose is visually distinct but not alarming — muted amber, not red. Being late for
  paracetamol is not an emergency.

**Timeline entry** — icon rail on the left, date, title, summary, expandable detail.
Keep the collapsed height uniform so a long history scans cleanly.

**Lab result row** — test name, value with unit, reference range, and a status badge reading
`Within range` / `Below range` / `Above range` / `Not evaluated`. Out-of-range rows get a left
border in the semantic colour plus the badge text.

## Motion

Restraint. Movement should explain a change, never decorate.

- Route transitions: 140ms opacity only. No slide, no scale.
- Sheets and dialogs: 220ms translate + fade with `--ease-out-soft`.
- Lists: no stagger animation. It delays content on slow phones for no benefit.
- **Confetti and celebratory effects: not in this product.** Marking a dose taken happens up to
  six times a day, every day, and a celebration on each one is noise. A quiet checkmark
  transition is the right feedback.
- Honour `prefers-reduced-motion` — the base layer above already handles it globally.

## Accessibility — required, not aspirational

- Every interactive element reachable and operable by keyboard, in a sensible tab order.
- `Escape` closes every overlay; focus returns to the trigger.
- All icon-only buttons have `aria-label`.
- Live regions (`aria-live="polite"`) announce async results — extraction finished, dose saved.
- Body text meets **4.5:1**; large text and UI borders meet **3:1**.
- Never disable pinch-zoom. The viewport meta is exactly:
  `<meta name="viewport" content="width=device-width, initial-scale=1" />`
- Form errors are associated with their input and announced.
- Test with the keyboard only, and with a screen reader on the dashboard and the confirm screen
  at minimum.

## Product voice

**This section is a hard requirement.** The owner's explicit instruction is that the interface
must not be plastered with AI branding and markings. The product is a medical records app that
happens to read handwriting.

### The rule

> Name the **benefit to the user**, never the **technology that delivers it**.

The word "AI" appears in the entire product in exactly **two** places:
1. The standard disclaimer sentence under extracted or generated medical content.
2. The privacy policy and settings, where it explains what gets sent where.

Nowhere else. Not in nav, not in headings, not in buttons, not in badges, not in loading text.

### Replacements

| Never write this | Write this instead |
|---|---|
| "AI Active" status badge | *(nothing — delete the concept)* |
| "AI Prescription Verification" | "Check the details" |
| "Ask AI" (nav item) | "Search records" |
| "AI Clinical Triage Active" | "Checking your symptoms" |
| "AI Safety & Info" | "About this medicine" |
| "AI handwriting & verification" | "Reads handwritten prescriptions" |
| "Extract & Verify Prescription" | "Read prescription" |
| "Using our strongest AI to read this carefully…" | "Reading your prescription…" |
| "Lots of people are using Medfolio right now. Switching to another AI…" | "Still working…" |
| "Every AI lane is busy right now." | "Couldn't read it right now. Try again, or enter the details yourself." |
| "Low Confidence — Verify Field" | "Check this" *(neutral tone, not alarm red)* |
| "Powered by Gemini" | *(nothing)* |

### Loading copy

Say what is happening, in three words or fewer where possible. Never invent narrative about
server load, model tiers, queues, or how hard the system is trying:

- "Reading prescription…"
- "Reading report…"
- "Checking symptoms…"
- "Saving…"

If an operation exceeds ~8 seconds, add one honest line: "This is taking longer than usual."
That is the entire escalation vocabulary.

### Icon discipline

- **Never use sparkle / magic-wand / robot icons.** They are the visual equivalent of an
  "AI Active" badge.
- Icons are literal: a pill for medicines, a flask for lab tests, a stethoscope for visits, a
  camera for capture, a clock for schedule.
- One icon set (`lucide-react`), one stroke width (2), sizes from {16, 20, 24} only.

### Confidence handling

When the model is unsure about a field, the correct treatment is **quiet and functional**, not
an alarm:

- Give the field a neutral amber left border and a small "Check this" hint below it.
- Do not use red. Red means danger; a possibly-misread strength is not danger, it is a field
  that needs a glance.
- Auto-focus the first uncertain field on the confirm screen so the user starts where the
  attention is needed.
- Never block saving because of low confidence — the user is the authority on their own
  prescription.

### The disclaimer

One sentence, used verbatim wherever extracted or generated medical content appears:

> *Details were read from your photo and may contain errors. Always check against the original
> prescription.*

And for medicine information screens:

> *General information only — not medical advice. Follow your doctor's instructions.*

Render both with the `Disclaimer` primitive: small, muted, bordered. Present but not shouting.

### Enforcement

Add a custom ESLint rule `no-ai-branding` that fails the build when a JSX text node or string
literal in `src/` matches:

```
/\b(AI|A\.I\.|Gemini|GPT|LLM|artificial intelligence|powered by|our strongest|machine learning)\b/i
```

Allow-list exactly two files: the disclaimer constants module and the privacy policy content.
Also fail on imports of `Sparkles`, `Wand`, `Wand2`, or `Bot` from `lucide-react`.

This rule is the reason the requirement survives contact with a hundred future commits.

## Anti-patterns — automatic rejection

Any of these in a pull request means the work is not done:

- A `<style>` element inside a component, or any global hand-written class names.
- Hardcoded colours or arbitrary Tailwind values (`bg-[#0d9488]`, `p-[13px]`).
- A list without an empty state, or an async view without loading and error states.
- `console.error` as the only handling of a user-facing failure.
- `alert()`, `confirm()`, or `prompt()` anywhere.
- Two navigation bars visible at any viewport width.
- A destructive action reachable in one tap from primary navigation.
- Text below 4.5:1 contrast, or state communicated by colour alone.
- `user-scalable=no` or `maximum-scale` in the viewport meta.
- A component file over ~250 lines — split it.
- Sparkle icons, "AI" in UI copy, or invented progress narration.
