# 01 — Architecture

## Stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| Language | TypeScript | `~5.9` | `strict: true`. Medical field names must not drift. |
| UI | React | `^19.2` | |
| Build | Vite | `^8.2` | |
| Styling | Tailwind CSS | `^4.3` | CSS-first `@theme`. No `tailwind.config.js`. |
| Tailwind plugin | `@tailwindcss/vite` | `^4.3` | First-party Vite integration; do not use PostCSS. |
| Routing | React Router | `^7.18` | Declarative mode. Real URLs, not hash strings. |
| Server state | TanStack Query | `^5.101` | Caching, invalidation, offline retry. |
| Forms | React Hook Form + Zod resolver | `^7` / `^5` | |
| Validation | Zod | `^4.4` | One schema per boundary; infer TS types from it. |
| Backend | Supabase JS | `^2.112` | Postgres + Auth + Storage + RLS. |
| AI SDK | `@google/genai` | `^2.17` | Server-side only. |
| Charts | Recharts | `^3` | Trend charts with reference bands. |
| Icons | `lucide-react` | `^1.30` | |
| Dates | `date-fns` + `date-fns-tz` | `^4` / `^3` | Timezone correctness is mandatory — see §Time. |
| PDF | `pdfjs-dist` | `^5` | Rasterise PDF lab reports client-side before upload. |
| Animation | `motion` | `^12` | Sparingly. See `03-DESIGN-SYSTEM.md` §Motion. |
| Testing | Vitest + Testing Library | `^4` / `^17` | |
| E2E | Playwright | `^1` | The seven success gates in `08`. |
| Lint | ESLint + `typescript-eslint` | `^9` / `^8` | Plus the custom rule in §Product voice. |
| Format | Prettier + `prettier-plugin-tailwindcss` | `^3` / `^0.6` | |
| Hosting | Vercel | — | Static SPA + `/api` serverless functions. |

Pin what you install. Run `npm install <pkg>@latest` and commit the lockfile; if a major
version has moved past what is listed here, use the newer one and note it in the commit.

## Non-negotiable architectural rules

1. **Secrets never reach the browser.** The Gemini API key and the Supabase service-role key
   exist only in serverless function environment variables. Vite inlines every `VITE_`-prefixed
   variable into the client bundle by design — so a secret must never be named `VITE_*`.
   Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public, and the anon key is safe
   only because RLS is enforced (see `02-DATA-MODEL.md`).

2. **All AI calls go through `/api`.** The client never talks to Gemini directly. One endpoint
   per task, each with a validated request schema — not a generic passthrough that forwards
   arbitrary prompts.

3. **No component injects CSS.** No `<style>` elements in components, no global stylesheet of
   hand-written class names. Tailwind utilities plus the `@theme` tokens only.

4. **Data access is centralised.** Components never import the Supabase client. They call hooks
   from `src/features/*/api/`, which call repository functions in `src/lib/db/`. This keeps
   queries testable and makes the eventual family-profiles change a single-layer edit.

5. **Every external boundary is Zod-validated on the way in.** AI responses, Supabase rows,
   URL params, imported JSON files. Parse, don't assume.

6. **Pure domain logic lives in `src/domain/` and imports nothing.** No React, no Supabase, no
   `Date.now()` passed implicitly — the current time is always an argument. This is what makes
   the clinical rules in `06-DOMAIN-RULES.md` unit-testable, and they must be tested.

7. **No feature imports from another feature.** Cross-feature sharing goes through
   `src/components/ui/`, `src/domain/`, or `src/lib/`.

## Folder layout

```
medfolio/
├─ api/                              # Vercel serverless functions
│  ├─ _lib/
│  │  ├─ gemini.ts                   # Gemini client + retry/timeout. Server only.
│  │  ├─ auth.ts                     # Verify Supabase JWT from Authorization header
│  │  ├─ schemas.ts                  # Zod: request + response shape per endpoint
│  │  └─ rateLimit.ts                # Per-user quota (see 05-AI-LAYER §Cost control)
│  ├─ extract-prescription.ts
│  ├─ extract-lab-report.ts
│  ├─ explain-medicine.ts
│  ├─ check-interactions.ts
│  ├─ suggest-specialist.ts
│  ├─ ask-records.ts
│  └─ share/
│     ├─ create.ts                   # Mint an opaque share token
│     ├─ [token].ts                  # Public read of a live share
│     └─ revoke.ts
│
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                        # Router + providers only. No business logic.
│  ├─ routes.tsx
│  │
│  ├─ domain/                        # PURE. No imports outside this folder + date-fns.
│  │  ├─ frequency.ts                # BD/TDS/OD/... → dose times      (06 §Frequency)
│  │  ├─ duration.ts                 # "5 days"/"1 week" → day count   (06 §Duration)
│  │  ├─ schedule.ts                 # Build a dose schedule from a prescription
│  │  ├─ timeBuckets.ts              # Dose time → morning|afternoon|evening|night
│  │  ├─ referenceRange.ts           # Lab value vs reference range     (06 §Ranges)
│  │  ├─ testAliases.ts              # CBC ↔ Complete Blood Count       (06 §Aliases)
│  │  ├─ redFlags.ts                 # Offline emergency keywords       (06 §Red flags)
│  │  ├─ activeMedicines.ts          # Currently-active courses only    (06 §Active)
│  │  ├─ adherence.ts                # Taken / missed / streak maths
│  │  └─ __tests__/                  # Every file above has a test file. Mandatory.
│  │
│  ├─ features/
│  │  ├─ auth/                       # Sign in, sign up, session, guards
│  │  ├─ prescriptions/              # Capture → confirm → save
│  │  ├─ schedule/                   # Today's doses, mark taken, adherence
│  │  ├─ reminders/                  # Permission flow, scheduling, snooze
│  │  ├─ reports/                    # Lab upload, extraction, trends
│  │  ├─ timeline/                   # Unified history
│  │  ├─ doctor/                     # Printable brief + share links
│  │  ├─ symptoms/                   # Red-flag check + specialist suggestion
│  │  ├─ search/                     # Ask-your-records
│  │  └─ settings/                   # Profile, export/import, danger zone
│  │     └─ (each feature: components/ | api/ (hooks) | schemas.ts | index.ts)
│  │
│  ├─ components/
│  │  ├─ ui/                         # Button, Card, Sheet, Dialog, Field, Badge,
│  │  │                              # Skeleton, EmptyState, ErrorState, Toast, Tabs...
│  │  └─ layout/                     # AppShell, TopBar, BottomNav, PageHeader
│  │
│  ├─ lib/
│  │  ├─ supabase/
│  │  │  ├─ client.ts                # Single browser client instance
│  │  │  └─ types.ts                 # GENERATED. Do not hand-edit.
│  │  ├─ db/                         # Repository fns: one file per table
│  │  ├─ ai/                         # Typed fetch wrappers for /api. No prompts here.
│  │  ├─ files/                      # Image compression, PDF→image, EXIF orientation
│  │  ├─ export/                     # JSON export/import, PDF generation
│  │  ├─ time.ts                     # ALL date handling. See §Time.
│  │  └─ notifications/              # Service worker registration + scheduling
│  │
│  ├─ hooks/
│  └─ styles/
│     └─ theme.css                   # Tailwind @import + @theme tokens. Only CSS file.
│
├─ supabase/migrations/              # Numbered, forward-only SQL
├─ public/
│  ├─ manifest.webmanifest
│  └─ sw.js                          # Service worker: offline shell + notifications
├─ e2e/                              # Playwright: the 7 gates from 08
└─ .env.example
```

## Routing

Real paths. No hash routing. Every screen is linkable and the browser back button works.

| Path | Screen | Auth |
|---|---|---|
| `/` | Dashboard | required |
| `/sign-in`, `/sign-up` | Auth | public |
| `/prescriptions/new` | Capture | required |
| `/prescriptions/review` | Confirm extracted details | required |
| `/medicines` | Schedule (tabs: Today / Cabinet / History) | required |
| `/medicines/:name` | Medicine detail | required |
| `/reports` | Lab reports + trends | required |
| `/reports/new` | Upload | required |
| `/timeline` | Unified history | required |
| `/symptoms` | Symptom help | required |
| `/search` | Ask your records | required |
| `/settings` | Profile, export, danger zone | required |
| `/share/:token` | **Public** doctor view — no session, no app shell | public |

`/share/:token` must be a **separate route with its own minimal layout**, not the app shell
with pieces conditionally hidden. It renders server-fetched data only.

## Time — read this carefully

Pakistan is **UTC+05:00** with no daylight saving. Naive use of
`new Date().toISOString().split('T')[0]` yields *yesterday's* date for the first five hours of
every Pakistani day. That single mistake makes "today's doses" wrong every morning, which
breaks the core product loop.

Rules:

- **All date handling goes through `src/lib/time.ts`.** Nothing else may call `toISOString`,
  `getTimezoneOffset`, or construct a date string by slicing.
- `APP_TIMEZONE = 'Asia/Karachi'`, exported as a constant.
- `todayInAppTz(now: Date): string` returns `YYYY-MM-DD` in app time — use it everywhere
  "today" is needed.
- Store **timestamps** (`timestamptz`) for events that happen at an instant (dose taken,
  record created). Store **plain dates** (`date`) for calendar concepts (visit date, dose
  scheduled date). Never mix the two.
- Store dose times as **minutes since midnight (`int`, 0–1439)**, never as a display string
  like `"09:00 PM"`. Bucketing by number comparison is correct; substring matching on a
  formatted string is not — `"09:00 PM"` and `"09:00 AM"` both contain `"09:"`, which is how a
  single dose ends up rendered in two different sections.
- Format for display at the edge, in the component, from the numeric value.
- Every domain function that needs the current time **takes it as a parameter**. This is what
  makes the timezone behaviour testable — tests must include a case at 02:00 PKT.

## Data flow

```
Component
  → feature hook (TanStack Query)        e.g. useTodaysDoses()
    → repository fn (src/lib/db/)        e.g. doses.listForDate()
      → Supabase client                  RLS enforces user isolation
```

```
Component
  → feature hook (mutation)              e.g. useExtractPrescription()
    → typed fetch (src/lib/ai/)          POST /api/extract-prescription
      → serverless fn                    validates JWT, rate-limits, calls Gemini,
                                         validates response against Zod, returns
```

The client sends the image and receives structured, validated fields. Prompts live server-side
only — never in the bundle.

## Offline behaviour

The app is a PWA. Required:

- **App shell cached** by the service worker; opening the app with no network shows the UI, not
  a browser error page.
- **Reads served from the TanStack Query cache** persisted to IndexedDB, so today's schedule and
  the medicine cabinet are readable offline.
- **Writes queued** while offline — specifically marking a dose taken or skipped — and flushed
  on reconnect. This is the single most important offline write; a user marking a dose in a
  basement must not lose it.
- **Red-flag emergency check and the helpline numbers are fully local**, bundled, never fetched.
- AI features degrade with a clear, honest message: the feature needs a connection, the record
  can still be entered manually.

## Environment variables

`.env.example` (commit this; never commit `.env`):

```bash
# ---- Client (public, inlined into the bundle) ----
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# ---- Server only (serverless functions; NEVER prefixed VITE_) ----
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
```

`GEMINI_MODEL` is read from the environment with `gemini-3.5-flash` as the fallback default.
Do not hardcode a model id anywhere else in the codebase.

## Scripts

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit",
  "lint": "eslint . --max-warnings 0",
  "format": "prettier --write .",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test",
  "db:types": "supabase gen types typescript --linked > src/lib/supabase/types.ts",
  "verify": "npm run typecheck && npm run lint && npm run test && npm run build"
}
```

`npm run verify` must pass before every commit. Treat a failure as a blocker, not a warning.

## Quality gates in CI

GitHub Actions on every push: `verify`, then `e2e`. Both must be green.
Also enforce:

- `tsc` with `strict: true`, `noUncheckedIndexedAccess: true`.
- ESLint with `--max-warnings 0`, including `react-hooks/rules-of-hooks` as an **error**
  (hooks must never sit after a conditional return).
- The custom `no-ai-branding` rule from `03-DESIGN-SYSTEM.md` §Product voice.
- A bundle size budget: fail the build if the initial JS chunk exceeds **250 KB gzipped**.
  Route-level code splitting is expected; charts, PDF rendering, and the AI-dependent screens
  are all lazy-loaded.
