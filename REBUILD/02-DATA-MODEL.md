# 02 — Data Model

Supabase Postgres. Every table is user-scoped and protected by Row Level Security. The browser
holds only the anon key — **RLS is the entire security boundary, so no table may ship without
policies.**

## Conventions

- `snake_case` columns, plural table names.
- Every table: `id uuid primary key default gen_random_uuid()`,
  `created_at timestamptz not null default now()`,
  `updated_at timestamptz not null default now()` (maintained by trigger).
- Every table: `user_id uuid not null references auth.users(id) on delete cascade`.
- Every table: `profile_id uuid not null references profiles(id) on delete cascade`.
  v1 creates exactly one profile per user, but this column is what makes family profiles a
  later feature rather than a migration nightmare. **Do not skip it.**
- Calendar concepts use `date`. Instants use `timestamptz`. Never mix.
- Dose times are `int` minutes since midnight (0–1439), never text.
- Money is `numeric(12,2)` with a separate `currency char(3) default 'PKR'`.
- Enums are Postgres `text` + `check` constraints, not native enums — cheaper to evolve.

## Naming discipline

One concept, one name, everywhere — database, TypeScript, and API payloads identical.
Drift between synonyms (`medicine_name` vs `name`, `date` vs `visit_date`) is how fields get
silently dropped on save. Fixed vocabulary, no exceptions:

| Concept | The only allowed name |
|---|---|
| Medicine's name | `medicine_name` |
| Date a visit happened | `visit_date` |
| Date a dose is scheduled for | `scheduled_date` |
| Time a dose is scheduled for | `scheduled_minutes` |
| Instant a dose was actually taken | `taken_at` |
| Lab test's name | `test_name` |
| Date a report was issued | `report_date` |

## Schema

### `profiles`

The person the records belong to. One row per user in v1.

```sql
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  full_name     text not null,
  relationship  text not null default 'self'
                  check (relationship in ('self','parent','child','spouse','other')),
  date_of_birth date,
  sex           text check (sex in ('male','female','other','undisclosed')),
  blood_group   text check (blood_group in
                  ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  height_cm     numeric(5,1),
  weight_kg     numeric(5,1),
  -- The two most important things to show a doctor. Free text, one per line.
  allergies           text,
  chronic_conditions  text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  is_default    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on profiles (user_id);
```

### `visits`

A consultation. The parent record for a prescription.

```sql
create table visits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  visit_date    date not null,
  doctor_name   text,
  clinic_name   text,
  specialty     text,
  -- The reason the doctor wrote down. NEVER invented by the app or the model.
  diagnosis     text,
  doctor_advice text,
  follow_up_date date,
  visit_cost    numeric(12,2),
  currency      char(3) not null default 'PKR',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on visits (user_id, profile_id, visit_date desc);
```

`doctor_name`, `clinic_name` and `diagnosis` are **nullable on purpose**. If the model could not
read them, they stay null. Never write a placeholder like "Attending Physician" or
"General Checkup" — a fabricated value in a medical record is worse than a blank one.

### `visit_images`

Prescriptions run to multiple pages. One row per page.

```sql
create table visit_images (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  visit_id    uuid not null references visits(id) on delete cascade,
  storage_path text not null,          -- path in the 'medical-images' bucket
  page_number int not null default 1,
  width_px    int,
  height_px   int,
  byte_size   int,
  created_at  timestamptz not null default now(),
  unique (visit_id, page_number)
);
```

Images live in **Supabase Storage**, never as base64 in a column. Store the path; generate a
signed URL on read.

### `medicines`

One row per prescribed (or self-added) medicine course.

```sql
create table medicines (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  profile_id     uuid not null references profiles(id) on delete cascade,
  visit_id       uuid references visits(id) on delete cascade,   -- null = self-added / OTC
  medicine_name  text not null,
  strength       text,                    -- "500 mg"
  form           text,                    -- tablet | capsule | syrup | injection | drops...
  dose_amount    text,                    -- "1 tablet", "5 ml"
  -- Verbatim from the prescription, e.g. "TDS". Interpreted, never overwritten.
  frequency_raw  text,
  frequency_code text check (frequency_code in
                   ('OD','BD','TDS','QID','QHS','PRN','SOS','STAT','WEEKLY','CUSTOM')),
  duration_raw   text,                    -- verbatim, e.g. "5 days"
  duration_days  int check (duration_days > 0),
  start_date     date not null,
  end_date       date,                    -- generated = start + duration - 1; null = ongoing
  instructions   text,                    -- "after meals"
  with_food      boolean,
  is_ongoing     boolean not null default false,   -- true for chronic meds, no end date
  is_otc         boolean not null default false,
  unit_cost      numeric(12,2),
  currency       char(3) not null default 'PKR',
  discontinued_at timestamptz,            -- set when the user stops a course early
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on medicines (user_id, profile_id, start_date desc);
create index on medicines (visit_id);
```

`duration_days` and `frequency_code` are **nullable**. A null means "could not be determined"
and the UI must ask the user. Never default them.

### `doses`

One row per scheduled dose. This table drives the schedule, the reminders, and adherence.

```sql
create table doses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  profile_id       uuid not null references profiles(id) on delete cascade,
  medicine_id      uuid not null references medicines(id) on delete cascade,
  scheduled_date   date not null,
  scheduled_minutes int not null check (scheduled_minutes between 0 and 1439),
  status           text not null default 'pending'
                     check (status in ('pending','taken','skipped','missed')),
  taken_at         timestamptz,
  skipped_reason   text,
  snoozed_until    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (medicine_id, scheduled_date, scheduled_minutes)
);
create index on doses (user_id, profile_id, scheduled_date);
create index on doses (user_id, status, scheduled_date);
```

Notes:
- `scheduled_minutes` is an integer. `21:00` is `1260`. Bucketing compares numbers.
- The unique constraint makes schedule generation **idempotent** — regenerating a schedule can
  never duplicate doses.
- `missed` is derived: a `pending` dose whose date+time is more than a grace window in the past.
  Compute it on read in the domain layer; do not run a cron job to mutate rows.
- Deleting a medicine cascades to its doses. Marking a course discontinued should delete only
  its *future pending* doses, preserving the historical record of what was taken.

### `test_orders`

A test the doctor ordered. The pending-test loop is the most differentiated feature in the
product: doctor orders CBC → app tracks it → patient uploads results → app links them back.

```sql
create table test_orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  profile_id       uuid not null references profiles(id) on delete cascade,
  visit_id         uuid references visits(id) on delete set null,
  test_name        text not null,
  -- Resolved canonical name from the alias table. Used for auto-linking.
  canonical_name   text,
  status           text not null default 'pending'
                     check (status in ('pending','scheduled','completed','cancelled')),
  ordered_date     date not null,
  scheduled_date   date,
  completed_date   date,
  report_id        uuid references reports(id) on delete set null,
  -- 'auto' when matched by the alias rules, 'manual' when the user confirmed the link.
  link_method      text check (link_method in ('auto','manual')),
  estimated_cost   numeric(12,2),
  currency         char(3) not null default 'PKR',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on test_orders (user_id, profile_id, status);
```

An automatic link is always **shown to the user as a reviewable suggestion**, never silently
final. Loose matching that attaches the wrong result to the wrong order is a clinical error.

### `reports`

A lab report document.

```sql
create table reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  title        text not null,
  report_date  date not null,
  lab_name     text,
  report_cost  numeric(12,2),
  currency     char(3) not null default 'PKR',
  source_type  text not null default 'image' check (source_type in ('image','pdf','manual')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on reports (user_id, profile_id, report_date desc);
```

### `report_images`

```sql
create table report_images (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  report_id    uuid not null references reports(id) on delete cascade,
  storage_path text not null,
  page_number  int not null default 1,
  created_at   timestamptz not null default now(),
  unique (report_id, page_number)
);
```

### `report_results`

One row per measured value. Normalised so trends are a simple query.

```sql
create table report_results (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  report_id       uuid not null references reports(id) on delete cascade,
  test_name       text not null,
  canonical_name  text,
  value_text      text not null,        -- exactly as printed, e.g. "13.8", "Negative"
  value_numeric   numeric,              -- parsed when numeric; null for qualitative results
  unit            text,
  reference_range text,                 -- as printed, e.g. "12.0 - 16.0"
  ref_low         numeric,              -- parsed bounds, for chart bands
  ref_high        numeric,
  -- Computed by src/domain/referenceRange.ts, NOT taken from the model's opinion.
  range_status    text not null default 'unknown'
                    check (range_status in ('within','below','above','unknown')),
  created_at      timestamptz not null default now()
);
create index on report_results (user_id, canonical_name, created_at);
create index on report_results (report_id);
```

`range_status` is computed by our own pure function from `value_numeric` and the parsed bounds.
Never persist the model's claim about whether a value is out of range — models get this wrong,
and it is trivially computable.

### `side_effects`

```sql
create table side_effects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  medicine_id   uuid references medicines(id) on delete set null,
  medicine_name text not null,          -- denormalised: survives medicine deletion
  note          text not null,
  severity      text check (severity in ('mild','moderate','severe')),
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index on side_effects (user_id, profile_id, occurred_at desc);
```

### `extraction_audit`

The audit trail. **This is a safety requirement, not analytics.** If a dosing error ever
happens, this is the record of whether the model misread it or the user mistyped it.

```sql
create table extraction_audit (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  entity_type    text not null check (entity_type in ('visit','report')),
  entity_id      uuid not null,
  model           text not null,        -- e.g. 'gemini-3.5-flash'
  raw_response   jsonb not null,        -- what the model returned, verbatim
  confirmed_data jsonb not null,        -- what the user confirmed
  edited_fields  text[] not null default '{}',
  created_at     timestamptz not null default now()
);
create index on extraction_audit (user_id, entity_type, entity_id);
```

### `reminder_settings`

```sql
create table reminder_settings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  enabled           boolean not null default true,
  quiet_hours_start int check (quiet_hours_start between 0 and 1439),
  quiet_hours_end   int check (quiet_hours_end between 0 and 1439),
  snooze_minutes    int not null default 10 check (snooze_minutes between 1 and 120),
  lead_minutes      int not null default 0,   -- notify N minutes early
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (profile_id)
);
```

### `shares`

Server-side share tokens. This table is what makes "expiring" and "revocable" **true**.

```sql
create table shares (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  -- SHA-256 of the token. The raw token is shown to the user once and never stored.
  token_hash   text not null unique,
  -- Frozen snapshot, built server-side at creation. The doctor view reads only this.
  snapshot     jsonb not null,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  view_count   int not null default 0,
  last_viewed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index on shares (token_hash);
```

Design requirements — all four matter:

1. **The URL carries only a random opaque token** (32 bytes, base64url). No patient data in the
   URL, ever. URLs leak into browser history, server logs, `Referer` headers, QR-scanner
   history, and messaging-app link previews.
2. **Only the hash is stored.** A database leak does not yield working share links.
3. **Expiry and revocation are checked server-side** in `api/share/[token].ts`. The recipient
   cannot alter them because they never hold the data.
4. **Revoke actually revokes.** Setting `revoked_at` kills that link immediately and permanently.

The snapshot is frozen at creation so a doctor sees a stable document, and it contains only what
`04-FEATURES.md` §Doctor share lists — never the full record set.

## Storage

One private bucket: `medical-images`.

- Path convention: `{user_id}/{entity_type}/{entity_id}/{page}.webp`
- **Never public.** Reads go through short-lived signed URLs (60 minutes).
- Storage RLS: a user may only read and write objects whose path begins with their own `user_id`.
- Client-side before upload: strip EXIF, correct orientation, resize longest edge to **2000px**,
  encode **WebP quality 0.82**. Typical prescription photo lands under 300 KB.
- PDF lab reports: rasterise page-by-page with `pdfjs-dist` at ~200 DPI, then treat each page as
  an image. Cap at 10 pages and tell the user if a document exceeds it.

## Row Level Security

Enable RLS on **every** table. The pattern for all user-scoped tables:

```sql
alter table visits enable row level security;

create policy "own rows: select" on visits for select
  using (auth.uid() = user_id);
create policy "own rows: insert" on visits for insert
  with check (auth.uid() = user_id);
create policy "own rows: update" on visits for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on visits for delete
  using (auth.uid() = user_id);
```

Repeat for `profiles`, `visit_images`, `medicines`, `doses`, `test_orders`, `reports`,
`report_images`, `report_results`, `side_effects`, `extraction_audit`, `reminder_settings`,
`shares`.

**`shares` is special:** the public doctor view must read a row *without* a session. Do not solve
this with a permissive policy. Grant no anon access at all; `api/share/[token].ts` uses the
service-role key, hashes the incoming token, checks `expires_at` and `revoked_at`, increments
`view_count`, and returns only the snapshot. Access control lives in that function.

Write a test that asserts a second user cannot read the first user's rows. RLS misconfiguration
is silent until it is a breach.

## Triggers

```sql
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
```

Attach `before update` on every table with an `updated_at`.

Also: a trigger on `auth.users` insert that creates the user's default `profiles` row, so the
app never has to handle a signed-in user with no profile.

## TypeScript types

Generate from the live schema; never hand-write row types:

```bash
npm run db:types    # supabase gen types typescript --linked > src/lib/supabase/types.ts
```

Regenerate after every migration and commit the result. Hand-authored types drift from the
schema, which is exactly the class of bug this rebuild exists to eliminate.

Layer Zod schemas on top for boundary validation and derive domain types from those:

```ts
// src/features/prescriptions/schemas.ts
export const medicineInput = z.object({
  medicine_name: z.string().min(1, 'Medicine name is required'),
  strength: z.string().optional(),
  dose_amount: z.string().optional(),
  frequency_code: z.enum(['OD','BD','TDS','QID','QHS','PRN','SOS','STAT','WEEKLY','CUSTOM'])
    .nullable(),
  duration_days: z.number().int().positive().nullable(),
  start_date: z.string().date(),
  instructions: z.string().optional(),
});
export type MedicineInput = z.infer<typeof medicineInput>;
```

## Export and import format

Versioned, self-describing, and complete enough to fully reconstruct an account.

```json
{
  "format": "medfolio.export",
  "version": 1,
  "exported_at": "2026-08-15T09:00:00Z",
  "app_timezone": "Asia/Karachi",
  "profiles": [], "visits": [], "medicines": [], "doses": [],
  "test_orders": [], "reports": [], "report_results": [],
  "side_effects": [], "reminder_settings": [],
  "images": [{ "path": "...", "data_base64": "..." }]
}
```

Import rules:
- Validate the whole file with Zod **before writing anything**. Reject with a clear message
  naming the offending field.
- Reject unknown `version` values rather than guessing.
- Offer **merge** (skip rows whose id already exists) or **replace** (requires type-to-confirm).
- Import inside a transaction where possible; on failure, leave existing data untouched.
- Round-trip must be lossless: export → wipe → import produces an identical record set. This is
  an automated test, not a manual check.

## Migrations

Numbered, forward-only, one concern each, in `supabase/migrations/`:

```
0001_extensions.sql          -- pgcrypto for gen_random_uuid
0002_profiles.sql
0003_visits_and_images.sql
0004_medicines_and_doses.sql
0005_reports_and_results.sql
0006_test_orders.sql
0007_side_effects.sql
0008_extraction_audit.sql
0009_reminder_settings.sql
0010_shares.sql
0011_storage_bucket_and_policies.sql
0012_triggers.sql
0013_rls_policies.sql
```

Never edit a migration that has been applied to the linked project. Add a new one.
