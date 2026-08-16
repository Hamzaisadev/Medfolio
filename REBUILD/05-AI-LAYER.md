# 05 — AI Layer

Google Gemini, model from `process.env.GEMINI_MODEL` (default `gemini-3.5-flash`), called
**only** from serverless functions under `/api`.

## Hard rules

1. **The API key never reaches the browser.** It lives in `GEMINI_API_KEY`, a server-only
   environment variable. Never prefix it `VITE_` — Vite inlines those into the bundle by design.
2. **No generic passthrough endpoint.** One endpoint per task, each with a Zod-validated request
   schema. An endpoint that forwards arbitrary prompts is an open, billable proxy.
3. **Prompts live server-side only.** They are never shipped in client code.
4. **Every request is authenticated.** Verify the Supabase JWT from the `Authorization` header
   and derive `user_id` from it. Never trust a `user_id` in a request body.
5. **Every response is validated against a Zod schema before use.** If validation fails, retry
   once, then return a clean error. Never pass unvalidated model output toward the database.
6. **Use structured output, not text scraping.** Gemini supports a response schema and
   `responseMimeType: 'application/json'`. Use them. Do not regex JSON out of prose.
7. **Send the minimum data required.** See §Context budget.
8. **The app is fully usable with every AI feature failing.** Manual entry is always available.
   AI is an accelerator, never a dependency.
9. **Honest client identity.** Standard SDK headers. Never forge a User-Agent to impersonate
   another client or evade a provider's access controls — that gets accounts terminated.

## Shared server helpers

`api/_lib/gemini.ts`

```ts
import { GoogleGenAI } from '@google/genai';

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash';
const TIMEOUT_MS = 45_000;

export async function generateStructured<T>(opts: {
  systemInstruction: string;
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  responseSchema: object;      // Gemini response schema
  validate: (raw: unknown) => T;   // Zod .parse
  temperature?: number;
}): Promise<T>
```

Behaviour:
- `temperature` defaults to **0** for extraction tasks. Determinism matters when reading dosages.
- One timeout, one retry on transient failure (5xx, 429, timeout) with ~800ms backoff.
  **Never** cascade through a list of models — it multiplies latency and cost for the same
  likely-failing request.
- A validation failure triggers exactly one retry with a corrective instruction appended, then
  fails.
- Log `model`, `latency_ms`, token counts, and outcome. **Never log request content** — it is
  patient data.
- Return typed data plus the raw response so the caller can persist `extraction_audit`.

`api/_lib/auth.ts` — verify the bearer token with the Supabase client, return `user_id`, or
respond 401.

`api/_lib/rateLimit.ts` — see §Cost control.

## Endpoints

### `POST /api/extract-prescription`

The most important call in the product.

**Request:** `{ images: Array<{ mimeType: string; dataBase64: string }> }` — max 5, each ≤ 4 MB.

**System instruction (server-side), in substance:**

> You read photographs of medical prescriptions, including handwritten ones from Pakistan.
> Extract only what is actually written. Return JSON matching the given schema.
>
> Critical rules:
> - **Never invent a diagnosis.** If no reason for the visit is written, return null.
> - **Never guess a medicine name.** If the handwriting is unclear, return your best reading and
>   mark `confidence: "low"`.
> - **Copy frequency and duration verbatim** as written (`BD`, `TDS`, `x5`, `5/7`) into the
>   `*_raw` fields. Do not normalise or interpret them — the application does that.
> - **Never fill in a frequency or duration that is not written.** Return null.
> - Understand English, Urdu, and Roman Urdu.
> - Extract lab tests and investigations the doctor ordered.
> - If nothing is readable, return the empty shape rather than inventing content.

**Response schema:**

```ts
z.object({
  readable: z.boolean(),            // false = nothing legible found (distinct from an error)
  doctor_name: z.string().nullable(),
  clinic_name: z.string().nullable(),
  visit_date: z.string().nullable(),          // as written; the app parses
  diagnosis: z.string().nullable(),
  doctor_advice: z.string().nullable(),
  follow_up: z.string().nullable(),
  medicines: z.array(z.object({
    medicine_name: z.string(),
    strength: z.string().nullable(),
    form: z.string().nullable(),
    dose_amount: z.string().nullable(),
    frequency_raw: z.string().nullable(),     // verbatim — app interprets
    duration_raw: z.string().nullable(),      // verbatim — app interprets
    instructions: z.string().nullable(),
    confidence: z.enum(['high', 'low']),
  })),
  tests_ordered: z.array(z.object({
    test_name: z.string(),
    confidence: z.enum(['high', 'low']),
  })),
})
```

**Division of responsibility — important:**
the model reads pixels into strings; **our code does all interpretation**.
`frequency_raw` → `parseFrequency()`, `duration_raw` → `parseDuration()`
(`06-DOMAIN-RULES.md`). Never ask the model for dose times or day counts. Deterministic, tested,
reviewable code owns clinical logic.

`readable: false` must be surfaced differently from a network/parse error — "we couldn't find
prescription text in this photo" vs "the reader is unavailable right now".

### `POST /api/extract-lab-report`

**Request:** `{ images: [...] }` — max 10 pages.

**System instruction, in substance:**

> Extract test results printed on this lab report. Return only values actually printed.
> For each row: test name, value exactly as printed, unit, and reference range as printed.
> **Do not judge whether a value is normal or abnormal** — the application computes that.
> Qualitative results (Negative, Non-reactive, Nil) go in the value field as text.
> If a page contains no test results, return an empty array for it.

**Response schema:**

```ts
z.object({
  readable: z.boolean(),
  title: z.string().nullable(),
  lab_name: z.string().nullable(),
  report_date: z.string().nullable(),
  results: z.array(z.object({
    test_name: z.string(),
    value_text: z.string(),
    unit: z.string().nullable(),
    reference_range: z.string().nullable(),
    confidence: z.enum(['high', 'low']),
  })),
})
```

Note the absence of an `is_out_of_range` field. That is computed by
`src/domain/referenceRange.ts`. Models get range comparison wrong, and it is trivial arithmetic.

### `POST /api/explain-medicine`

**Request:** `{ medicine_name: string }`

**System instruction, in substance:**

> Explain this medicine for a patient in plain language. Two or three short sentences on what it
> is commonly used for, then the most common side effects. Calm and factual — no alarm, no
> dosing advice, no recommendation to start or stop anything.
> If you do not recognise the name, set `known: false` and leave the fields null. Do not guess.

**Response schema:**

```ts
z.object({
  known: z.boolean(),
  summary: z.string().nullable(),
  common_uses: z.string().nullable(),
  common_side_effects: z.array(z.string()),
  cautions: z.string().nullable(),
})
```

**Cache aggressively.** This is the same answer for every user asking about Panadol. Cache in
`localStorage` keyed by normalised name (30-day TTL) and — if a shared cache table is added
later — server-side too. This endpoint should almost never be called twice for the same medicine.

### `POST /api/check-interactions`

**Request:** `{ medicines: string[] }` — from **currently active** medicines only, max 15.
Returns immediately with no interactions if fewer than 2.

**System instruction, in substance:**

> Assess this list of concurrently prescribed medicines for clinically significant, documented
> interactions.
> - Respect the prescriber's judgement. Do **not** flag ordinary, deliberate co-prescriptions
>   (a painkiller alongside an antibiotic).
> - Reserve `severe` for well-documented contraindications.
> - Frame mild and moderate items as practical guidance ("take a few hours apart"), not as risk
>   alerts.
> - If nothing significant, return an empty array.

**Response schema:**

```ts
z.object({
  interactions: z.array(z.object({
    medicines: z.array(z.string()),
    severity: z.enum(['mild', 'moderate', 'severe']),
    summary: z.string(),           // one calm patient-facing sentence
    guidance: z.string(),          // practical action
  })),
})
```

### `POST /api/suggest-specialist`

**Called only after the local red-flag check has already cleared** — it is never the emergency
path (`06-DOMAIN-RULES.md` §Red flags).

**Request:** `{ symptoms: string }`

**System instruction, in substance:**

> Suggest which kind of doctor is most appropriate for these symptoms, understanding English,
> Urdu, and Roman Urdu. Suggest a specialty, not a diagnosis. Explain in one or two sentences why
> that specialty fits. Use specialty names common in Pakistan (General Physician, Cardiologist,
> Pulmonologist, ENT Specialist, Gastroenterologist, Dermatologist, Gynaecologist,
> Orthopaedic Surgeon, Neurologist, Paediatrician).
> If the symptoms suggest urgent in-person care, set `urgency: "urgent"`.

**Response schema:**

```ts
z.object({
  specialty: z.string(),
  reasoning: z.string(),
  urgency: z.enum(['routine', 'soon', 'urgent']),
})
```

The server also runs the red-flag keyword check independently as a backstop; if it fires, the
response includes `emergency: true` regardless of the model's view. Defence in depth on the one
path where a miss matters.

### `POST /api/ask-records`

**Request:**

```ts
z.object({
  question: z.string().max(500),
  context: z.object({          // assembled CLIENT-side, deliberately narrow
    medicines: z.array(...).max(30),
    recent_doses: z.array(...).max(60),
    visits: z.array(...).max(10),
    results: z.array(...).max(40),
  }),
  history: z.array(z.object({ role: z.enum(['user','assistant']), content: z.string() }))
             .max(6),
})
```

**System instruction, in substance:**

> Answer the patient's question using only the records provided. Never invent a medical event
> that is not in the records. If the records do not contain the answer, say so plainly and
> suggest what they could log. Use short paragraphs, lists, or a simple table. Never give
> diagnostic or dosing advice.

Plain text response, rendered as markdown-lite. See §Context budget for how `context` is built.

### Share endpoints

`POST /api/share/create` — builds the snapshot server-side from the user's records, generates 32
random bytes as a base64url token, stores **only** its SHA-256 hash with `expires_at`, returns
the raw token once.

`GET /api/share/[token]` — hashes the incoming token, looks up the row, rejects if missing,
expired, or revoked, increments `view_count`, returns only the snapshot. Uses the service-role
key; no anon RLS access to `shares`.

`POST /api/share/revoke` — sets `revoked_at`. Authenticated, owner only.

These three are not AI endpoints but belong to the same server boundary and follow the same
rules: authenticate, validate, never trust the client.

## Context budget

The dominant token cost in an app like this comes from lazily stuffing the patient's entire
history into a prompt on every message. Do not do that. Rules:

1. **Structured search runs first.** For `/search`, attempt a local query over medicines,
   visits, reports, and doses before any model call. Medicine names, test names, and dates are
   answered locally, instantly, offline, at zero cost. Most questions are of this kind.
2. **Retrieve, then ask.** When a model call is needed, select only the relevant slice:
   - Mentioned medicine names → those medicines and their recent doses.
   - Mentioned test names → those results, most recent 10.
   - Date references → records in that window.
   - Otherwise → last 30 days only.
3. **Hard caps enforced server-side** by the Zod schema above. A request exceeding them is
   rejected, not silently truncated.
4. **Never send images with a text question.**
5. **Cap conversation history at 6 turns**, and send summaries rather than full record dumps for
   earlier turns.
6. **Send fields, not rows.** Strip `id`, `user_id`, `created_at`, `updated_at`, and storage
   paths before serialising. They cost tokens and mean nothing to the model.
7. Target: a `/search` request stays under **8k input tokens**. If a request would exceed that,
   narrow the retrieval — do not raise the cap.

## Cost control

- **Rate limit per user** in `api/_lib/rateLimit.ts`: 30 AI requests/hour, 150/day.
  On exceed, return 429 with a plain message and the reset time. Manual entry still works.
- **Cache `explain-medicine`** as described; it should be near-zero-cost after warm-up.
- **Never call an endpoint speculatively.** Interaction checks run on an explicit action or a
  debounced change of ≥1.5s — not on every keystroke.
- **Compress images before upload** (2000px, WebP q0.82). Image tokens dominate extraction cost.
  Never send an uncompressed phone photo.
- **`temperature: 0` and tight `maxOutputTokens`** per endpoint — 2048 for extraction, 1024 for
  explanations, 1536 for answers.
- **One retry maximum.** No model cascades.
- Record token counts per request in logs so cost is observable from day one.

## Error handling

Map failures to honest, actionable messages. Never a raw provider error, never a silent console
log.

| Condition | User sees |
|---|---|
| Network unreachable | "You're offline. You can still enter the details yourself." |
| 429 from provider or our limiter | "Too many requests just now. Try again in a few minutes — or enter the details yourself." |
| Timeout | "That took too long. Try again, or enter the details yourself." |
| Validation failed twice | "Couldn't read this reliably. Please enter the details yourself." |
| `readable: false` | "We couldn't find prescription text in this photo. Try a clearer photo, or enter the details yourself." |

Every message names a next step, and manual entry is always among them. No invented narration
about model tiers, queues, traffic, or effort.
